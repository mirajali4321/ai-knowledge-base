const groqClient = require("../config/grog");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");

const chat = async ({ prompt, systemPrompt }) => {
  const messages = [
    {
      role: "system",
      content:
        systemPrompt ||
        "You are a helpful assistant. Answer clearly and concisely.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await groqClient.chat.completions.create({
    model: config.groq.model,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });

  return {
    message: response.choices[0].message.content,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
  };
};

// ── RAG query ─────────────────────────────────────────────────────
const queryDocument = async ({ question, documentId, userId }) => {
  // step 1 — find relevant chunks via vector search
  const relevantChunks = await vectorSearchService.searchSimilarChunks({
    query: question,
    documentId,
    userId,
  });

  if (relevantChunks.length === 0) {
    return {
      answer:
        "I could not find any relevant information in the document to answer your question.",
      chunks: [],
    };
  }

  // step 2 — build context from retrieved chunks
  const context = relevantChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.text}`)
    .join("\n\n");

  // step 3 — build system prompt with context
  const systemPrompt = `You are a helpful assistant that answers questions based strictly on the provided document context.

Rules:
- Only answer from the context provided below
- If the answer is not in the context, say "I don't have enough information in this document to answer that"
- Be concise and accurate
- Do not make up information

Context:
${context}`;

  // step 4 — send to Groq for final answer
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const response = await groqClient.chat.completions.create({
    model: config.groq.model,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });

  return {
    answer: response.choices[0].message.content,
    chunksUsed: relevantChunks.length,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
  };
};

module.exports = { chat, queryDocument };
