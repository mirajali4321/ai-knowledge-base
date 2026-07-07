const { Worker } = require("bullmq");
const redisConnection = require("../config/redis");
const fileProcessorService = require("../services/fileProcessor.service");
const embeddingService = require("../services/embedding.service");
const Document = require("../models/document.model");

const documentWorker = new Worker(
  "document-processing",
  async (job) => {
    const { documentId, userId } = job.data;

    console.log(`Processing job ${job.id} for document ${documentId}`);

    // fetch document from DB
    const document = await Document.findById(documentId);
    if (!document) throw new Error("Document not found");

    // update progress
    await job.updateProgress(10);

    // step 1 — extract text and chunk
    const { chunks, totalChunks } = await fileProcessorService.processFile({
      s3Key: document.s3Key,
      mimeType: document.mimeType,
    });

    await job.updateProgress(40);

    // step 2 — generate embeddings
    const embeddedChunks =
      await embeddingService.generateChunkEmbeddings(chunks);

    await job.updateProgress(80);

    // step 3 — save to DB
    document.chunks = embeddedChunks;
    document.chunkCount = totalChunks;
    document.status = "ready";
    document.errorMessage = null;
    await document.save();

    await job.updateProgress(100);

    console.log(`Job ${job.id} completed — ${totalChunks} chunks processed`);

    return { documentId, chunkCount: totalChunks };
  },
  {
    connection: redisConnection,
    concurrency: 2, // process 2 documents simultaneously
  },
);

documentWorker.on("completed", (job) => {
  console.log(`Document ${job.data.documentId} processing completed`);
});

documentWorker.on("failed", async (job, err) => {
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
