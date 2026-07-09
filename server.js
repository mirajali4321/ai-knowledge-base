require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const config = require("./src/config");
const { initSocket } = require("./src/config/socket");
require("./src/config/redis");
require("./src/worker/document.worker"); // start worker

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION - shutting down:", err.message);
  process.exit(1);
});

connectDB().then(() => {
  const server = app.listen(config.app.port, () => {
    initSocket(server);
    console.log(
      `Server running in ${config.app.env} mode on port ${config.app.port}`,
    );
  });

  process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION - shutting down:", err.message);
    server.close(() => process.exit(1));
  });
});
