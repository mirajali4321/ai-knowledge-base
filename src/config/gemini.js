const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./index");

const geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);

module.exports = geminiClient;
