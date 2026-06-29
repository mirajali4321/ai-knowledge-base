const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const config = require("../config");

// ── Token generation ──────────────────────────────────────────────
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
};

const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  return { accessToken, refreshToken };
};

// ── Register ──────────────────────────────────────────────────────
const register = async ({ name, email, password }) => {
  // check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "Email already registered");
  }

  // create user — password gets hashed by pre('save') hook
  const user = await User.create({ name, email, password });

  // generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // save refresh token to DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
};

// ── Login ─────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  // explicitly select password since select: false in schema
  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  // generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // save new refresh token to DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
};

// ── Refresh token ─────────────────────────────────────────────────
const refresh = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  // verify the token
  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // find user and check token matches what we stored
  const user = await User.findById(decoded.id).select("+refreshToken");
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token mismatch or user not found");
  }

  // generate new tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // save new refresh token
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// ── Logout ────────────────────────────────────────────────────────
const logout = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    { $unset: { refreshToken: 1 } }, // remove refresh token from DB
    { new: true },
  );
};

module.exports = { register, login, refresh, logout };
