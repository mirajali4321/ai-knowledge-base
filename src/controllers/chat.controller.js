const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const chatService = require("../services/chat.service");

const chat = asyncHandler(async (req, res) => {
  const { prompt, systemPrompt } = req.body;

  const result = await chatService.chat({ prompt, systemPrompt });

  res.status(200).json(new ApiResponse(200, result, "Chat response generated"));
});

const query = asyncHandler(async (req, res) => {
  const { question, documentId } = req.body;

  const result = await chatService.queryDocument({
    question,
    documentId,
    userId: req.user._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, result, "Query answered successfully"));
});

module.exports = { chat, query };
