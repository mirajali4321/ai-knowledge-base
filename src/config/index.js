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
};

const requiredKeys = [
  ["db.uri", config.db.uri],
  ["jwt.accessSecret", config.jwt.accessSecret],
  ["jwt.refreshSecret", config.jwt.refreshSecret],
];

requiredKeys.forEach(([key, value]) => {
  if (!value) {
    console.error(`Missing required config: ${key}`);
    process.exit(1);
  }
});

module.exports = config;
