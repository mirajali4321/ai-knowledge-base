const geminiClient = require("../config/gemini");
const config = require("../config");

// ── Generate embedding for a single text ──────────────────────────
const generateEmbedding = async (text) => {
  const model = geminiClient.getGenerativeModel({
    model: config.gemini.embeddingModel,
  });

  const result = await model.embedContent(text);
  return result.embedding.values; // array of numbers
};

// ── Generate embeddings for multiple chunks ───────────────────────
const generateChunkEmbeddings = async (chunks) => {
  const model = geminiClient.getGenerativeModel({
    model: config.gemini.embeddingModel,
  });

  const requests = chunks.map((chunk) => ({
    content: { parts: [{ text: chunk.text }] },
  }));

  const result = await model.batchEmbedContents({ requests });

  const embeddedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: result.embeddings[index].values,
  }));

  return embeddedChunks;
};

module.exports = { generateEmbedding, generateChunkEmbeddings };
