const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const errorMiddleware = require("./middlewares/error.middleware");
//swagger
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
//routes
const authRoutes = require("./routes/auth.route");
const documentRoutes = require("./routes/document.route");
const chatRoutes = require("./routes/chat.route");
const agentRoutes = require("./routes/agent.route");

const app = express();

// ── Security ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin: function (origin, callback) {
      callback(null, true); // allow all origins
    },
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      error: {
        message: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
        statusCode: 429,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // only 20 attempts per 15 min on auth endpoints
  message: {
    success: false,
    message: "Too many auth attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Body parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ── Health check ──────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    environment: config.app.env,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/agent", agentRoutes);

// ── Swagger documentation ─────────────────────────────────────────
app.use(
  "/api-docs",
  swaggerUi.serveFiles(swaggerSpec, {}),
  swaggerUi.setup(swaggerSpec),
);

// ── Global error handler (always last) ───────────────────────────
app.use(errorMiddleware);

module.exports = app;
