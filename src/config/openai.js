const OpenAI = require("openai");
const config = require("./index");

const openaiClient = new OpenAI({
  apiKey: config.openai.apiKey,
});

module.exports = openaiClient;
