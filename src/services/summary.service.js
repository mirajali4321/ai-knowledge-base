const openaiClient = require("../config/openai");
const config = require("../config");

const MAX_INPUT_CHARS = 12000; // keep prompt within a comfortable context budget

const generateDocumentSummary = async (text) => {
  const response = await openaiClient.chat.completions.create({
    model: config.openai.chatModel,
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that writes whole-document summaries for a knowledge base.
Summarize the document below in 4-6 sentences, covering its main topic, purpose and key points.
Be factual — only use information present in the text. Do not add commentary about the summary itself.`,
      },
      { role: "user", content: text.slice(0, MAX_INPUT_CHARS) },
    ],
    temperature: 0.3,
    max_tokens: 350,
  });

  return response.choices[0].message.content.trim();
};

module.exports = { generateDocumentSummary };
