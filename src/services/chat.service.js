const openaiClient = require("../config/openai");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");

const chat = async ({ prompt, systemPrompt }) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content:
          systemPrompt ||
          "You are a helpful assistant. Answer clearly and concisely.",
      },
      { role: "user", content: prompt },
    ],
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

const queryDocument = async ({ question, documentId, userId }) => {
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

  const context = relevantChunks
    .slice(0, 3)
    .map((chunk, i) => `[${i + 1}] ${chunk.text.slice(0, 500)}`)
    .join("\n\n");

  const systemPrompt = `You are a helpful assistant that answers questions based strictly on the provided document context.

Rules:
- Only answer from the context provided below
- If the answer is not in the context, say "I don't have enough information in this document to answer that"
- Be concise and accurate
- Do not make up information

Context:
${context}`;

  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
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
