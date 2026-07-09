const openaiClient = require("../config/openai");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");
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
Reply warmly and briefly, and invite them to ask a question about their uploaded documents.`,
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
const matchDocument = async (question, userId) => {
  const documents = await Document.find({
    owner: new mongoose.Types.ObjectId(userId),
    status: "ready",
  })
    .select("_id title originalName")
    .lean();

  if (documents.length === 0) return null;

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
        content: `You are a document matcher. Match the user's message to the closest document from the list below.

Return null if:
- The user is asking a general question with no document reference
- You are not confident about the match

Available documents:
${docList}

Reply ONLY with valid JSON:
{ "documentId": "the _id of the matching document or null" }

Examples of when to return null:
- "what is cloud computing" → null
- "what is JWT" → null

Examples of when to return id:
- "give me summary of sample_test" → match to sample_test
- "what is hmfinal about" → match to hmfinal
- "summarize my cloud document" → match to cloud-related document`,
      },
      { role: "user", content: question },
    ],
    temperature: 0,
    max_tokens: 50,
  });

  const raw = response.choices[0].message.content.trim();
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned).documentId;
  } catch (err) {
    return null;
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
    const specificDocumentId = await matchDocument(question, userId);

    if (!specificDocumentId) {
      return {
        answer:
          "I couldn't identify which document you're referring to. Could you mention the document name clearly?",
        toolUsed: "document_op",
        chunksUsed: 0,
        relevant: false,
      };
    }

    const chunks = await vectorSearchService.searchSimilarChunks({
      query: "introduction overview main topics key points summary",
      documentId: specificDocumentId,
      userId,
    });

    if (chunks.length === 0) {
      return {
        answer:
          "I found the document but couldn't extract enough content. Please try again.",
        toolUsed: "document_op",
        chunksUsed: 0,
        relevant: false,
      };
    }

    const context = chunks
      .slice(0, 10)
      .map((c, i) => `[${i + 1}] ${c.text.slice(0, 500)}`)
      .join("\n\n");

    const finalResponse = await openaiClient.chat.completions.create({
      model: config.openai.chatModel,
      messages: [
        {
          role: "system",
          content: `You are a helpful knowledge base assistant.
The user wants to perform an action on a specific document.
Use the document content below to fulfill their request.
Be thorough, friendly and well structured.

Document content:
${context}`,
        },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return {
      answer: finalResponse.choices[0].message.content,
      toolUsed: "document_op",
      chunksUsed: chunks.length,
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
