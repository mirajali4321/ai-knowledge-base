const { Server } = require("socket.io");
const config = require("./index");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.app.clientUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // user joins their own room using userId
    socket.on("join", (userId) => {
      socket.join(userId);
    });

    socket.on("disconnect", () => {});
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initSocket, getIO };
