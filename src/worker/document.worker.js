const { Worker } = require("bullmq");
const redisConnection = require("../config/redis");
const fileProcessorService = require("../services/fileProcessor.service");
const embeddingService = require("../services/embedding.service");
const Document = require("../models/document.model");
const { getIO } = require("../config/socket");

const documentWorker = new Worker(
  "document-processing",
  async (job) => {
    const { documentId, userId } = job.data;

    // fetch document from DB
    const document = await Document.findById(documentId);
    if (!document) throw new Error("Document not found");
    //emmit start
    getIO().to(userId).emit("document:progress", {
      documentId,
      status: "processing",
      percent: 10,
      message: "Extracting text from document...",
    });

    // step 1 — extract text and chunk
    const { chunks, totalChunks } = await fileProcessorService.processFile({
      s3Key: document.s3Key,
      mimeType: document.mimeType,
    });

    // emit chunking done
    getIO()
      .to(userId)
      .emit("document:progress", {
        documentId,
        status: "processing",
        percent: 40,
        message: `Document split into ${totalChunks} chunks...`,
      });

    // step 2 — generate embeddings
    const embeddedChunks =
      await embeddingService.generateChunkEmbeddings(chunks);

    // emit embeddings done
    getIO().to(userId).emit("document:progress", {
      documentId,
      status: "processing",
      percent: 80,
      message: "Generating embeddings...",
    });

    // step 3 — save to DB
    document.chunks = embeddedChunks;
    document.chunkCount = totalChunks;
    document.status = "ready";
    document.errorMessage = null;
    await document.save();

    // emit complete
    getIO().to(userId).emit("document:complete", {
      documentId,
      status: "ready",
      percent: 100,
      message: "Document ready to query!",
    });

    return { documentId, chunkCount: totalChunks };
  },
  {
    connection: redisConnection,
    concurrency: 2, // process 2 documents simultaneously
  },
);

documentWorker.on("failed", async (job, err) => {
  // emit failure to user
  try {
    getIO().to(job.data.userId).emit("document:failed", {
      documentId: job.data.documentId,
      status: "failed",
      message: err.message,
    });
  } catch (e) {
    console.error("Socket emit failed:", e.message);
  }
  console.error(
    `Document ${job.data.documentId} processing failed:`,
    err.message,
  );

  // update document status to failed in DB
  await Document.findByIdAndUpdate(job.data.documentId, {
    status: "failed",
    errorMessage: err.message,
  });
});

module.exports = documentWorker;
