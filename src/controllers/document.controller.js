const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const documentService = require("../services/document.service");

// ── Get presigned upload URL ──────────────────────────────────────
const initiateUpload = asyncHandler(async (req, res) => {
  const { filename, mimeType, size } = req.body;

  const result = await documentService.initiateUpload({
    filename,
    mimeType,
    size,
    userId: req.user._id,
  });

  res
    .status(201)
    .json(new ApiResponse(201, result, "Upload URL generated successfully"));
});

// ── Confirm upload complete ───────────────────────────────────────
const confirmUpload = asyncHandler(async (req, res) => {
  const result = await documentService.confirmUpload({
    documentId: req.params.id,
    userId: req.user._id,
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { document: result },
        "Upload confirmed successfully",
      ),
    );
});

// ── Get all documents ─────────────────────────────────────────────
const getUserDocuments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const result = await documentService.getUserDocuments({
    userId: req.user._id,
    page,
    limit,
  });

  res
    .status(200)
    .json(new ApiResponse(200, result, "Documents fetched successfully"));
});

// ── Get single document ───────────────────────────────────────────
const getDocument = asyncHandler(async (req, res) => {
  const result = await documentService.getDocument({
    documentId: req.params.id,
    userId: req.user._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, result, "Document fetched successfully"));
});

// ── Delete document ───────────────────────────────────────────────
const deleteDocument = asyncHandler(async (req, res) => {
  await documentService.deleteDocument({
    documentId: req.params.id,
    userId: req.user._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Document deleted successfully"));
});

module.exports = {
  initiateUpload,
  confirmUpload,
  getUserDocuments,
  getDocument,
  deleteDocument,
};
