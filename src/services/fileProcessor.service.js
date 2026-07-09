const pdfParse = require("pdf-parse");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");
const config = require("../config");

// ── Download file from S3 ─────────────────────────────────────────
const downloadFromS3 = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: s3Key,
  });

  const response = await s3Client.send(command);

  // convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

// ── Extract text from file ────────────────────────────────────────
const extractText = async (buffer, mimeType) => {
  if (mimeType === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
};

// ── Split text into overlapping chunks ───────────────────────────
const chunkText = (text, chunkSize = 400, overlap = 80) => {
  // clean up text — remove excessive whitespace and newlines
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length === 0) {
    throw new Error("No text content found in document");
  }

  const chunks = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleanText.length) {
    const endIndex = Math.min(startIndex + chunkSize, cleanText.length);
    let chunkText = cleanText.slice(startIndex, endIndex);

    // try to end at a sentence boundary if possible
    if (endIndex < cleanText.length) {
      const lastPeriod = chunkText.lastIndexOf(".");
      const lastSpace = chunkText.lastIndexOf(" ");
      const boundary =
        lastPeriod > chunkSize * 0.6 ? lastPeriod + 1 : lastSpace;
      if (boundary > 0) {
        chunkText = chunkText.slice(0, boundary).trim();
      }
    }

    chunks.push({
      text: chunkText,
      embedding: [], // empty for now — filled in Day 14-15
      index: chunkIndex,
    });

    chunkIndex++;
    // move forward by chunkSize minus overlap
    startIndex += chunkSize - overlap;
  }

  return chunks;
};

// ── Full pipeline ─────────────────────────────────────────────────
const processFile = async ({ s3Key, mimeType }) => {
  // step 1 — download from S3
  const buffer = await downloadFromS3(s3Key);

  // step 2 — extract text
  const text = await extractText(buffer, mimeType);

  // step 3 — chunk text
  const chunks = chunkText(text);

  return { chunks, totalChunks: chunks.length, fullText: text };
};

module.exports = { processFile };
