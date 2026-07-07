const openaiClient = require("../config/openai");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");

// ── Step 1 — Generate optimized search query ──────────────────────
const generateSearchQuery = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a search query optimizer for a knowledge base system.
Your job is to rephrase the user's question into the best possible search query to find relevant information from uploaded documents.

Reply ONLY with valid JSON:
{ "query": "the optimized search query" }

- Make the query concise and keyword focused
- Reply with JSON only, no explanation, no markdown`,
      },
      {
        role: "user",
        content: question,
      },
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

// ── Polite not found response ─────────────────────────────────────
const getNotFoundResponse = async (question) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a polite and helpful knowledge base assistant. 
The user asked a question that is not covered in any of their uploaded documents.
Generate a warm, polite response that:
- Acknowledges their question
- Explains gently that this topic is not covered in their uploaded documents
- Suggests they upload a relevant document if they want answers about this topic
- Keeps it brief — 2-3 sentences maximum
- Never sounds robotic or dismissive`,
      },
      {
        role: "user",
        content: question,
      },
    ],
    temperature: 0.3,
    max_tokens: 150,
  });

  return response.choices[0].message.content;
};

// ── Agent ─────────────────────────────────────────────────────────
const runAgent = async ({ question, userId }) => {
  // step 1 — optimize the search query
  const route = await generateSearchQuery(question);

  // step 2 — search knowledge base
  const chunks = await vectorSearchService.searchAllUserDocuments({
    query: route.query || question,
    userId,
  });
  console.log("chunks found:", chunks.length);
  console.log("top score:", chunks[0]?.score);

  // step 3 — check relevance score
  // if no chunks or best score below threshold — not relevant
  const RELEVANCE_THRESHOLD = 0.5;
  const hasRelevantChunks =
    chunks.length > 0 && chunks[0].score >= RELEVANCE_THRESHOLD;

  if (!hasRelevantChunks) {
    const politeResponse = await getNotFoundResponse(question);
    return {
      answer: politeResponse,
      toolUsed: "search_knowledge_base",
      chunksUsed: 0,
      relevant: false,
    };
  }

  // step 4 — build context from relevant chunks
  const context = chunks
    .slice(0, 3)
    .map((c, i) => `[${i + 1}] ${c.text.slice(0, 500)}`)
    .join("\n\n");

  // step 5 — generate final answer
  const systemPrompt = `You are a helpful and friendly knowledge base assistant.
Answer the user's question based strictly on the context from their uploaded documents below.

Rules:
- Only answer from the context provided
- If the answer is partially in the context, answer what you can and politely mention the limitation
- If the answer is not in the context at all, generate a warm polite response saying this topic is not covered in their documents
- Be conversational, friendly and concise
- Never make up information

Context:
${context}`;

  const finalResponse = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      { role: "system", content: systemPrompt },
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
