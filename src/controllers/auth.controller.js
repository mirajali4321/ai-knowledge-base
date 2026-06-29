const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const authService = require("../services/auth.service");
const config = require("../config");

// ── Cookie options ────────────────────────────────────────────────
const cookieOptions = {
  httpOnly: true, // not accessible via JavaScript — prevents XSS
  secure: config.app.env === "production", // HTTPS only in production
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// ── Register ──────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const result = await authService.register({ name, email, password });

  res
    .status(201)
    .cookie("refreshToken", result.refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        201,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "User registered successfully",
      ),
    );
});

// ── Login ─────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.login({ email, password });

  res
    .status(200)
    .cookie("refreshToken", result.refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "Login successful",
      ),
    );
});

// ── Refresh token ─────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  // get refresh token from cookie or body
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  const result = await authService.refresh(incomingRefreshToken);

  res
    .status(200)
    .cookie("refreshToken", result.refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          accessToken: result.accessToken,
        },
        "Token refreshed successfully",
      ),
    );
});

// ── Logout ────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);

  res
    .status(200)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// ── Get current user ──────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new ApiResponse(200, { user: req.user }, "User fetched successfully"),
    );
});

module.exports = { register, login, refresh, logout, getMe };
