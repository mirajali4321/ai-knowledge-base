const { Queue } = require("bullmq");
const redisConnection = require("../config/redis");

const documentQueue = new Queue("document-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // retry 3 times if job fails
    backoff: {
      type: "exponential",
      delay: 5000, // wait 5s, then 10s, then 20s between retries
    },
    removeOnComplete: 100, // keep last 100 completed jobs
    removeOnFail: 50, // keep last 50 failed jobs
  },
});

module.exports = documentQueue;
