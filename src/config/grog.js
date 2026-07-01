const Groq = require("groq-sdk");
const config = require("./index");

const groqClient = new Groq({
  apiKey: config.groq.apiKey,
});

module.exports = groqClient;
