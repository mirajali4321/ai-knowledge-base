const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const config = require("../config");

const protect = asyncHandler(async (req, res, next) => {
  // ── Get token from header ─────────────────────────────────────
  let accessToken;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  }

  if (!accessToken) {
    throw new ApiError(401, "Access denied. No token provided");
  }

  // ── Verify token ──────────────────────────────────────────────
  const decoded = jwt.verify(accessToken, config.jwt.accessSecret);
  // if token is invalid or expired, jwt.verify throws automatically
  // asyncHandler catches it and passes to error middleware

  // ── Find user ─────────────────────────────────────────────────
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  // ── Attach user to request ────────────────────────────────────
  req.user = user;
  next();
});

module.exports = { protect };
