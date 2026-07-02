const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { protect } = require("../middlewares/auth.middleware");
const { query } = require("../controllers/chat.controller");

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

/**
 * @swagger
 * /chat/query:
 *   post:
 *     summary: Ask a question about a document (RAG)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, documentId]
 *             properties:
 *               question:
 *                 type: string
 *                 example: What is Miraj's experience?
 *               documentId:
 *                 type: string
 *                 example: 6a4654b6ad240826d1f38a0a
 *     responses:
 *       200:
 *         description: Query answered successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/query", protect, query);

module.exports = router;
