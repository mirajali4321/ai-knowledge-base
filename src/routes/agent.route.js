const express = require("express");
const router = express.Router();
const agentController = require("../controllers/agent.controller");
const { protect } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: AI Agent endpoints
 */

/**
 * @swagger
 * /agent/query:
 *   post:
 *     summary: Ask a question — agent decides to search documents or answer directly
 *     tags: [Agent]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 example: What is Miraj's experience?
 *     responses:
 *       200:
 *         description: Agent query answered successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/query", protect, agentController.query);

module.exports = router;
