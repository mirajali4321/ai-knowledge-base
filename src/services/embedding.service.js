// const { getEmbeddingModel } = require("../config/gemini");

// const generateEmbedding = async (text) => {
//   const model = getEmbeddingModel();
//   const result = await model.embedContent(text);
//   return result.embedding.values;
// };

// const generateChunkEmbeddings = async (chunks) => {
//   const model = getEmbeddingModel();
//   const BATCH_SIZE = 100;
//   const embeddedChunks = [];

//   // split chunks into batches of 100
//   for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
//     const batch = chunks.slice(i, i + BATCH_SIZE);

//     const requests = batch.map((chunk) => ({
//       content: { parts: [{ text: chunk.text }] },
//     }));

//     const result = await model.batchEmbedContents({ requests });

//     const embedded = batch.map((chunk, index) => ({
//       ...chunk,
//       embedding: result.embeddings[index].values,
//     }));

//     embeddedChunks.push(...embedded);

//     // small delay between batches to avoid rate limiting
//     if (i + BATCH_SIZE < chunks.length) {
//       await new Promise((resolve) => setTimeout(resolve, 200));
//     }
//   }

//   return embeddedChunks;
// };

// module.exports = { generateEmbedding, generateChunkEmbeddings };
//gemini setup

// open ai setup

const openaiClient = require("../config/openai");
const config = require("../config");

const generateEmbedding = async (text) => {
  const response = await openaiClient.embeddings.create({
    model: config.openai.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
};

const generateChunkEmbeddings = async (chunks) => {
  const BATCH_SIZE = 100;
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await openaiClient.embeddings.create({
      model: config.openai.embeddingModel,
      input: batch.map((chunk) => chunk.text),
    });

    const embedded = batch.map((chunk, index) => ({
      ...chunk,
      embedding: response.data[index].embedding,
    }));

    embeddedChunks.push(...embedded);
  }

  return embeddedChunks;
};

module.exports = { generateEmbedding, generateChunkEmbeddings };
