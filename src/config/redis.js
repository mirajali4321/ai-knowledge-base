const { Redis } = require("ioredis");
const config = require("./index");

const redisConnection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // required by BullMQ
});

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

module.exports = redisConnection;
