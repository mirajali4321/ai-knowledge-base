const Document = require("../models/document.model");
const embeddingService = require("./embedding.service");
const config = require("../config");

const mongoose = require("mongoose");

// normalized to 0-1 the same way Atlas's $meta: "vectorSearchScore" is for a
// cosine-metric index — (1 + cosine) / 2 — so RELEVANCE_THRESHOLD keeps the
// same meaning it always had.
const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return (1 + cosine) / 2;
};

// $vectorSearch on an array field can only tell us WHICH document has a
// matching chunk, not project the matched chunk's text (it returns the
// whole chunks array) — so we re-rank each candidate document's chunks
// ourselves to pick the actual best-matching snippet(s).
const topChunksFromDocument = (queryEmbedding, doc, topK) =>
  doc.chunks
    .map((chunk) => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      documentId: doc._id.toString(),
      documentName: doc.originalName,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

const searchSimilarChunks = async ({
  query,
  documentId,
  userId,
  topK = 5,
}) => {
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  const docId = new mongoose.Types.ObjectId(documentId);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const doc = await Document.findOne({ _id: docId, owner: ownerId })
    .select("_id originalName chunks")
    .lean();

  if (!doc) return [];

  return topChunksFromDocument(queryEmbedding, doc, topK);
};

const searchAllUserDocuments = async ({ query, userId, topK = 5 }) => {
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const hits = await Document.aggregate([
    {
      $vectorSearch: {
        index: config.vectorSearch.indexName,
        path: "chunks.embedding",
        queryVector: queryEmbedding,
        numCandidates: config.vectorSearch.numCandidates,
        limit: config.vectorSearch.limit,
        filter: {
          owner: { $eq: ownerId },
        },
      },
    },
    {
      $project: { _id: 1 },
    },
  ]);

  const documentIds = [...new Set(hits.map((h) => h._id.toString()))];
  if (documentIds.length === 0) return [];

  const docs = await Document.find({ _id: { $in: documentIds } })
    .select("_id originalName chunks")
    .lean();

  const allChunks = docs.flatMap((doc) =>
    topChunksFromDocument(queryEmbedding, doc, topK),
  );

  return allChunks.sort((a, b) => b.score - a.score).slice(0, topK);
};

module.exports = { searchSimilarChunks, searchAllUserDocuments };
