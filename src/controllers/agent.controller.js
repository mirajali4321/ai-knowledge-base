const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const agentService = require("../services/agent.service");

const query = asyncHandler(async (req, res) => {
  const { question } = req.body;

  const result = await agentService.runAgent({
    question,
    userId: req.user._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, result, "Agent query answered successfully"));
});

module.exports = { query };
