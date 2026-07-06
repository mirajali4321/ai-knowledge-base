const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./index");

const geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);

const getEmbeddingModel = () =>
  geminiClient.getGenerativeModel({
    model: config.gemini.embeddingModel,
  });

module.exports = { geminiClient, getEmbeddingModel };
