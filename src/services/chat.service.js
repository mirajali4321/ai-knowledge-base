const groqClient = require("../config/grog");
const config = require("../config");

const chat = async ({ prompt, systemPrompt }) => {
  const messages = [
    {
      role: "system",
      content:
        systemPrompt ||
        "You are a helpful assistant. Answer clearly and concisely.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await groqClient.chat.completions.create({
    model: config.groq.model,
    messages,
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

module.exports = { chat };
