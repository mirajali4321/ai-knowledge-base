const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { protect } = require("../middlewares/auth.middleware");

// all document routes are protected
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management endpoints
 */

/**
 * @swagger
 * /documents/upload-url:
 *   post:
 *     summary: Get presigned URL to upload document to S3
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filename, mimeType, size]
 *             properties:
 *               filename:
 *                 type: string
 *                 example: my-document.pdf
 *               mimeType:
 *                 type: string
 *                 example: application/pdf
 *               size:
 *                 type: number
 *                 example: 102400
 *     responses:
 *       201:
 *         description: Presigned URL generated successfully
 *       400:
 *         description: Invalid file type or size
 *       401:
 *         description: Unauthorized
 */
router.post("/upload-url", documentController.initiateUpload);

/**
 * @swagger
 * /documents/{id}/confirm:
 *   post:
 *     summary: Confirm file upload is complete
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Upload confirmed successfully
 *       404:
 *         description: Document not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/confirm", documentController.confirmUpload);

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all documents for logged in user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Documents fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", documentController.getUserDocuments);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Get a single document with download URL
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document fetched successfully
 *       404:
 *         description: Document not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:id", documentController.getDocument);

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:id", documentController.deleteDocument);

module.exports = router;
