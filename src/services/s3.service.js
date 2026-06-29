const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const s3Client = require("../config/s3");
const config = require("../config");

// ── Generate presigned upload URL ─────────────────────────────────
const generateUploadUrl = async ({ filename, mimeType, userId }) => {
  const key = `documents/${userId}/${uuidv4()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    ContentType: mimeType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes to upload
  });

  return { presignedUrl, key };
};

// ── Generate presigned download URL ──────────────────────────────
const generateDownloadUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour to download
  });

  return presignedUrl;
};

// ── Delete file from S3 ───────────────────────────────────────────
const deleteFile = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
  });

  await s3Client.send(command);
};

module.exports = { generateUploadUrl, generateDownloadUrl, deleteFile };
