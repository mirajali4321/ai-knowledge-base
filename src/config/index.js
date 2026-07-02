const config = {
  app: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  },
  db: {
    uri: process.env.MONGO_URI,
  },
  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    embeddingModel: "gemini-embedding-001",
  },
};

const requiredKeys = [
  ["db.uri", config.db.uri],
  ["jwt.accessSecret", config.jwt.accessSecret],
  ["jwt.refreshSecret", config.jwt.refreshSecret],
  ["groq.apiKey", config.groq.apiKey],
  ["gemini.apiKey", config.gemini.apiKey],
];

requiredKeys.forEach(([key, value]) => {
  if (!value) {
    console.error(`Missing required config: ${key}`);
    process.exit(1);
  }
});

module.exports = config;
