const openaiClient = require("../config/openai");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");
const summaryService = require("./summary.service");
const Document = require("../models/document.model");
const mongoose = require("mongoose");

// ── Intent Classification ─────────────────────────────────────────
const classifyMessage = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `Classify the user's message into one of five types:
- "chitchat": greetings, small talk, thanks
- "metadata": questions about the knowledge base itself (list files, how many docs)
- "general": pure general knowledge clearly unrelated to any uploaded documents (history, geography, math, famous people)
- "document_op": user wants a full action on a SPECIFIC named document (summary, overview, explain a specific file)
- "question": anything that COULD be answered from uploaded documents — when in doubt use this

IMPORTANT: Always prefer "question" over "general" unless you are certain the topic cannot be in any document.

Reply ONLY with valid JSON:
{ "type": "chitchat" | "metadata" | "general" | "document_op" | "question" }`,
      },
      { role: "user", content: question },
    ],
    temperature: 0,
    max_tokens: 20,
  });

  const raw = response.choices[0].message.content.trim();
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const type = JSON.parse(cleaned).type;
    return [
      "chitchat",
      "metadata",
      "general",
      "document_op",
      "question",
    ].includes(type)
      ? type
      : "question";
  } catch (err) {
    return "question";
  }
};

// ── Chitchat ──────────────────────────────────────────────────────
const getChitchatResponse = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a friendly knowledge base assistant. The user sent a greeting or small talk.
Reply warmly and naturally like a normal conversation.
Only mention documents if it naturally fits — don't force it every time.
Keep it brief — 1-2 sentences max.`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.5,
    max_tokens: 100,
  });
  return response.choices[0].message.content;
};

// ── Metadata ──────────────────────────────────────────────────────
const getMetadataResponse = async ({ question, userId }) => {
  const documents = await Document.find({
    owner: new mongoose.Types.ObjectId(userId),
    status: "ready",
  })
    .select("title originalName createdAt chunkCount mimeType size")
    .lean();

  if (documents.length === 0) {
    return "You don't have any documents in your knowledge base yet. Upload a PDF or text file to get started!";
  }

  const docList = documents
    .map((d, i) => {
      const size = d.size ? `${(d.size / 1024).toFixed(1)} KB` : null;
      const type = d.mimeType ?? null;
      const extras = [type, size].filter(Boolean).join(", ");
      return `${i + 1}. ${d.originalName} (uploaded ${new Date(d.createdAt).toDateString()}${extras ? ` | ${extras}` : ""} | chunks: ${d.chunkCount ?? "N/A"})`;
    })
    .join("\n");

  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a helpful knowledge base assistant. Answer the user's question using ONLY the factual document information below.

Documents in knowledge base:
${docList}

Total documents: ${documents.length}

IMPORTANT RULES:
- Only state facts you know — filename, upload date, size, type, chunk count
- Never guess what a document is about based on its filename
- If asked what a document covers, say you would need to search inside it to know
- Be friendly and concise`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });
  return response.choices[0].message.content;
};

// ── General Knowledge ─────────────────────────────────────────────
const getGeneralKnowledgeResponse = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a knowledge base assistant. Your purpose is to help users get answers from their uploaded documents.

The user asked a general question not related to their documents.
Politely let them know this is outside the scope of their knowledge base.
Keep it warm, brief — 2 sentences max.
Suggest they upload relevant documents if they want answers on this topic.
Never answer the actual question.`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.3,
    max_tokens: 100,
  });
  return response.choices[0].message.content;
};

// ── Document Matcher ──────────────────────────────────────────────
const matchDocuments = async (question, userId) => {
  const documents = await Document.find({
    owner: new mongoose.Types.ObjectId(userId),
    status: "ready",
  })
    .select("_id title originalName")
    .lean();

  if (documents.length === 0) return { matchAll: false, matches: [] };

  const docList = documents
    .map(
      (d, i) =>
        `${i + 1}. id:${d._id} | title:${d.title} | file:${d.originalName}`,
    )
    .join("\n");

  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a document matcher. The user's message may reference one or MULTIPLE documents by name, or ALL of their documents collectively.

If the user refers to their whole knowledge base collectively (e.g. "all my documents", "every document", "all of them", "everything I've uploaded") rather than naming specific files, set matchAll to true and leave matches empty.

Otherwise, for each specific document reference you find in the message, match it to the closest document from the list below.

Be tolerant of imperfect references — typos, misspellings, missing/extra spaces, underscores vs spaces, missing file extensions, abbreviations, or partial titles all still count as a match to the closest document. Judge by resemblance (shared words, similar spelling, small edit distance), not exact string equality.

Set documentId to null for a reference only if it bears no real resemblance to any document in the list — i.e. it looks like a genuinely different/unrelated name, not just a misspelling of one that's there.

If the user is asking a general question with no document reference at all, set matchAll to false and reply with an empty matches array.

Available documents:
${docList}

Reply ONLY with valid JSON:
{ "matchAll": true | false, "matches": [ { "reference": "the name/phrase the user used to refer to it", "documentId": "the _id of the matching document or null" } ] }

Examples:
- "what is cloud computing" → { "matchAll": false, "matches": [] }
- "give me summary of sample_test" → { "matchAll": false, "matches": [one match, documentId of sample_test] }
- "summarize hmfinal.pdf, learning.pdf and sample_test.pdf" → { "matchAll": false, "matches": [three matches, one per named file, documentId null for any with no close match] }
- "give me a summary of all my documents" → { "matchAll": true, "matches": [] }
- "give me summary of samole test doc" (typo) → { "matchAll": false, "matches": [one match, documentId of the document titled "Sample Test Doc" — treat as a misspelling, not a miss] }`,
      },
      { role: "user", content: question },
    ],
    temperature: 0,
    max_tokens: 300,
  });

  const raw = response.choices[0].message.content.trim();
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      matchAll: parsed.matchAll === true,
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    };
  } catch (err) {
    return { matchAll: false, matches: [] };
  }
};

// ── Search Query Optimizer ────────────────────────────────────────
const generateSearchQuery = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a search query optimizer for a knowledge base system.
Rephrase the user's question into the best possible search query to find relevant information.

Reply ONLY with valid JSON:
{ "query": "the optimized search query" }

- Make the query concise and keyword focused
- Reply with JSON only, no explanation, no markdown`,
      },
      { role: "user", content: question },
    ],
    temperature: 0,
    max_tokens: 100,
  });

  const raw = response.choices[0].message.content.trim();
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return { query: question };
  }
};

// ── Not Found Response ────────────────────────────────────────────
const getNotFoundResponse = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a polite knowledge base assistant.
The user asked a question not covered in their uploaded documents.
Generate a warm, polite 2-3 sentence response acknowledging their question,
explaining it's not in their documents, and suggesting they upload a relevant document.`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.3,
    max_tokens: 150,
  });
  return response.choices[0].message.content;
};

// ── Main Agent ────────────────────────────────────────────────────
const runAgent = async ({ question, userId }) => {
  // ── Intent Classification ─────────────────────────────────────
  const messageType = await classifyMessage(question);

  // ── Chitchat ──────────────────────────────────────────────────
  if (messageType === "chitchat") {
    return {
      answer: await getChitchatResponse(question),
      toolUsed: "chitchat",
      chunksUsed: 0,
      relevant: false,
    };
  }

  // ── Metadata ──────────────────────────────────────────────────
  if (messageType === "metadata") {
    return {
      answer: await getMetadataResponse({ question, userId }),
      toolUsed: "get_kb_metadata",
      chunksUsed: 0,
      relevant: true,
    };
  }

  // ── General Knowledge ─────────────────────────────────────────
  if (messageType === "general") {
    return {
      answer: await getGeneralKnowledgeResponse(question),
      toolUsed: "general_knowledge",
      chunksUsed: 0,
      relevant: false,
    };
  }

  // ── Document Operation ────────────────────────────────────────
  if (messageType === "document_op") {
    const { matchAll, matches } = await matchDocuments(question, userId);

    let matched;
    let unmatched;

    if (matchAll) {
      const allDocuments = await Document.find({
        owner: new mongoose.Types.ObjectId(userId),
        status: "ready",
      })
        .select("_id originalName")
        .lean();

      matched = allDocuments.map((d) => ({
        reference: d.originalName,
        documentId: d._id.toString(),
      }));
      unmatched = [];
    } else {
      matched = matches.filter((m) => m.documentId);
      unmatched = matches.filter((m) => !m.documentId).map((m) => m.reference);
    }

    if (matched.length === 0) {
      let answer;
      if (matchAll) {
        answer =
          "You don't have any documents in your knowledge base yet. Upload a PDF or text file to get started!";
      } else if (unmatched.length > 0) {
        answer = `I couldn't find these documents in your knowledge base: ${unmatched.join(", ")}. Could you check the names and try again?`;
      } else {
        answer =
          "I couldn't identify which document you're referring to. Could you mention the document name clearly?";
      }

      return {
        answer,
        toolUsed: "document_op",
        chunksUsed: 0,
        relevant: false,
      };
    }

    const uniqueMatched = [
      ...new Map(matched.map((m) => [m.documentId, m])).values(),
    ];

    // documents already carry a summary generated once at upload time —
    // reuse it instead of re-fetching chunks and re-summarizing every call
    const summaryById = new Map(
      (
        await Document.find({
          _id: { $in: uniqueMatched.map((m) => m.documentId) },
        })
          .select("_id summary")
          .lean()
      ).map((d) => [d._id.toString(), d.summary]),
    );

    const docsWithContent = (
      await Promise.all(
        uniqueMatched.map(async (m) => {
          const cachedSummary = summaryById.get(m.documentId);
          if (cachedSummary) {
            return {
              reference: m.reference,
              content: cachedSummary,
              chunksUsed: 0,
            };
          }

          // fallback for documents processed before summaries were cached —
          // generate it once now and persist it so future calls hit the cache
          const chunks = await vectorSearchService.searchSimilarChunks({
            query: "introduction overview main topics key points summary",
            documentId: m.documentId,
            userId,
          });

          if (chunks.length === 0) return null;

          const combinedText = chunks.map((c) => c.text).join(" ");
          const generatedSummary =
            await summaryService.generateDocumentSummary(combinedText);

          await Document.findByIdAndUpdate(m.documentId, {
            summary: generatedSummary,
          });

          return {
            reference: m.reference,
            content: generatedSummary,
            chunksUsed: chunks.length,
          };
        }),
      )
    ).filter(Boolean);

    if (docsWithContent.length === 0) {
      return {
        answer:
          "I found the document(s) but couldn't extract enough content. Please try again.",
        toolUsed: "document_op",
        chunksUsed: 0,
        relevant: false,
      };
    }

    const context = docsWithContent
      .map((d) => `=== Document: ${d.reference} ===\n${d.content}`)
      .join("\n\n");

    const totalChunks = docsWithContent.reduce(
      (sum, d) => sum + d.chunksUsed,
      0,
    );

    const finalResponse = await openaiClient.chat.completions.create({
      model: config.openai.chatModel,
      messages: [
        {
          role: "system",
          content: `You are a helpful knowledge base assistant.
The user wants to perform an action on one or more specific documents.
Use the document content below — grouped by document — to fulfill their request.
If multiple documents are present, address each one separately with a clear heading.
Be thorough, friendly and well structured.${
            unmatched.length > 0
              ? `\nNote: these referenced documents could not be found in the knowledge base: ${unmatched.join(", ")}. Briefly mention this at the end.`
              : ""
          }

Document content:
${context}`,
        },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    return {
      answer: finalResponse.choices[0].message.content,
      toolUsed: "document_op",
      chunksUsed: totalChunks,
      relevant: true,
    };
  }

  // ── Semantic Search (question) ────────────────────────────────
  const route = await generateSearchQuery(question);

  const chunks = await vectorSearchService.searchAllUserDocuments({
    query: route.query || question,
    userId,
  });

  console.log("chunks found:", chunks.length);
  console.log("top score:", chunks[0]?.score);

  const RELEVANCE_THRESHOLD = 0.5;
  const hasRelevantChunks =
    chunks.length > 0 && chunks[0].score >= RELEVANCE_THRESHOLD;

  if (!hasRelevantChunks) {
    return {
      answer: await getNotFoundResponse(question),
      toolUsed: "search_knowledge_base",
      chunksUsed: 0,
      relevant: false,
    };
  }

  const context = chunks
    .slice(0, 5)
    .map((c, i) => `[${i + 1}] ${c.text.slice(0, 500)}`)
    .join("\n\n");

  const finalResponse = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a helpful and friendly knowledge base assistant.
Answer the user's question based strictly on the context from their uploaded documents below.

Rules:
- Only answer from the context provided
- If the answer is partially in the context, answer what you can and politely mention the limitation
- If the answer is not in the context at all, say this topic is not covered in their documents
- Be conversational, friendly and concise
- Never make up information

Context:
${context}`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.2,
    max_tokens: 1024,
  });

  return {
    answer: finalResponse.choices[0].message.content,
    toolUsed: "search_knowledge_base",
    chunksUsed: chunks.length,
    relevant: true,
  };
};

module.exports = { runAgent };
