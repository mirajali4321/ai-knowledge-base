const Document = require("../models/document.model");
const embeddingService = require("./embedding.service");
const config = require("../config");

const mongoose = require("mongoose");

const searchSimilarChunks = async ({ query, documentId, userId }) => {
  const queryEmbedding = await embeddingService.generateEmbedding(query);

  // convert to ObjectId explicitly
  const docId = new mongoose.Types.ObjectId(documentId);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const results = await Document.aggregate([
    {
      $vectorSearch: {
        index: config.vectorSearch.indexName,
        path: "chunks.embedding",
        queryVector: queryEmbedding,
        numCandidates: config.vectorSearch.numCandidates,
        limit: config.vectorSearch.limit,
        filter: {
          _id: { $eq: docId },
          owner: { $eq: ownerId },
        },
      },
    },
    {
      $project: {
        _id: 0,
        text: "$chunks.text",
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
};
const searchAllUserDocuments = async ({ query, userId }) => {
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const results = await Document.aggregate([
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
      $project: {
        _id: 0,
        text: "$chunks.text",
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
};

module.exports = { searchSimilarChunks, searchAllUserDocuments };
