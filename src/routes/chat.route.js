const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { protect } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat endpoints
 */

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Send a prompt and get a response
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: What is RAG?
 *               systemPrompt:
 *                 type: string
 *                 example: You are a helpful assistant
 *     responses:
 *       200:
 *         description: Chat response generated
 *       401:
 *         description: Unauthorized
 */
router.post("/", protect, chatController.chat);

module.exports = router;
