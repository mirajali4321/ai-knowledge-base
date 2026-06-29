const mongoose = require("mongoose");

// ── Chunk sub-schema (embedded) ───────────────────────────────────
const chunkSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number], // array of numbers — vector from OpenAI
      default: [],
    },
    index: {
      type: Number, // position of chunk in original document
      required: true,
    },
  },
  { _id: true },
);

// ── Document schema ───────────────────────────────────────────────
const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    originalName: {
      type: String, // original filename user uploaded
      required: true,
    },
    mimeType: {
      type: String,
      enum: ["application/pdf", "text/plain"],
      required: true,
    },
    size: {
      type: Number, // file size in bytes
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
    },
    chunks: [chunkSchema], // embedded chunks array
    chunkCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String, // stores error if processing fails
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ── Indexes ───────────────────────────────────────────────────────
documentSchema.index({ owner: 1 }); // fetch all docs by user
documentSchema.index({ owner: 1, createdAt: -1 }); // fetch user docs sorted by newest
documentSchema.index({ status: 1 }); // filter docs by status
documentSchema.index({ title: "text" }); // text search on title

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
