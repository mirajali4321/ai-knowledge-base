const Document = require("../models/document.model");
const s3Service = require("./s3.service");
const ApiError = require("../utils/ApiError");
const fileProcessorService = require("./fileProcessor.service");
const embeddingService = require("./embedding.service");
const documentQueue = require("../queues/document.queue");

// ── Get presigned upload URL + create document record ─────────────
const initiateUpload = async ({ filename, mimeType, size, userId }) => {
  // validate file type
  const allowedTypes = ["application/pdf", "text/plain"];
  if (!allowedTypes.includes(mimeType)) {
    throw new ApiError(400, "Only PDF and text files are allowed");
  }

  // validate file size — 10MB max
  const maxSize = 10 * 1024 * 1024;
  if (size > maxSize) {
    throw new ApiError(400, "File size cannot exceed 10MB");
  }

  // generate presigned URL from S3
  const { presignedUrl, key } = await s3Service.generateUploadUrl({
    filename,
    mimeType,
    userId,
  });

  // create document record in DB with status 'uploaded'
  const document = await Document.create({
    owner: userId,
    title: filename.replace(/\.[^/.]+$/, ""), // remove extension for title
    originalName: filename,
    mimeType,
    size,
    s3Key: key,
    status: "uploaded",
  });

  return { presignedUrl, document };
};

// ── Confirm upload complete ───────────────────────────────────────
const confirmUpload = async ({ documentId, userId }) => {
  const document = await Document.findOne({
    _id: documentId,
    owner: userId,
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  if (document.status !== "uploaded") {
    throw new ApiError(400, "Document is not in uploaded state");
  }

  document.status = "processing";
  await document.save();

  return document;
};

// ── Get all documents for a user ──────────────────────────────────
const getUserDocuments = async ({ userId, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [documents, total] = await Promise.all([
    Document.find({ owner: userId })
      .select("-chunks") // exclude chunks — too large
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Document.countDocuments({ owner: userId }),
  ]);

  return {
    documents,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── Get single document ───────────────────────────────────────────
const getDocument = async ({ documentId, userId }) => {
  const document = await Document.findOne({
    _id: documentId,
    owner: userId,
  }).select("-chunks");

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  // generate fresh download URL
  const downloadUrl = await s3Service.generateDownloadUrl(document.s3Key);

  return { document, downloadUrl };
};

// ── Delete document ───────────────────────────────────────────────
const deleteDocument = async ({ documentId, userId }) => {
  const document = await Document.findOne({
    _id: documentId,
    owner: userId,
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  // delete from S3 first
  await s3Service.deleteFile(document.s3Key);

  // then delete from DB
  await Document.findByIdAndDelete(documentId);
};

// ── Process document — extract text and chunk ─────────────────────

const processDocument = async ({ documentId, userId }) => {
  const document = await Document.findOne({
    _id: documentId,
    owner: userId,
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  if (document.status !== "processing") {
    throw new ApiError(
      400,
      `Document is in '${document.status}' state. Only 'processing' documents can be processed`,
    );
  }

  // add job to queue — returns immediately
  const job = await documentQueue.add("process-document", {
    documentId: documentId.toString(),
    userId: userId.toString(),
  });

  return {
    jobId: job.id,
    documentId,
    status: "processing",
    message: "Document processing started in background",
  };
};

module.exports = {
  initiateUpload,
  confirmUpload,
  getUserDocuments,
  getDocument,
  deleteDocument,
  processDocument,
};
