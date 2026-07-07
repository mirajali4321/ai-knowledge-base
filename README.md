# AI Knowledge Base API

A production-grade backend system that allows users to upload documents and query them using natural language. Built with a full RAG (Retrieval-Augmented Generation) pipeline, an AI agent with intelligent routing, and background job processing.

**Live API:** `http://13.235.42.230/api-docs`

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Key Design Decisions](#key-design-decisions)

---

## Features

- **JWT Authentication** — register, login, refresh tokens, protected routes
- **Document Upload** — direct S3 upload via presigned URLs, no server memory used
- **RAG Pipeline** — PDF/text extraction, chunking, OpenAI embeddings, MongoDB Atlas vector search
- **AI Agent** — intelligent query routing with relevance scoring, polite fallback responses
- **Background Jobs** — BullMQ + Redis queue for async document processing
- **Rate Limiting** — global and per-route limits with Nginx reverse proxy
- **Swagger Docs** — full interactive API documentation at `/api-docs`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + Express.js |
| Database | MongoDB Atlas |
| Vector Search | MongoDB Atlas Vector Search |
| File Storage | AWS S3 (presigned URLs) |
| Embeddings | OpenAI text-embedding-3-small (1536 dimensions) |
| LLM Chat | OpenAI gpt-4o-mini |
| LLM Routing | OpenAI gpt-4o-mini (JSON routing) |
| Job Queue | BullMQ + Redis Cloud |
| Deployment | AWS EC2 + PM2 + Nginx |
| Auth | JWT (access + refresh tokens) |

---

## Architecture

### System Overview

```
Client
  │
  ▼
Nginx (port 80)
  │
  ▼
Express API (port 8000)
  ├── Auth routes       → JWT auth system
  ├── Document routes   → S3 upload + MongoDB
  ├── Chat routes       → Direct LLM chat
  └── Agent routes      → RAG pipeline
         │
         ├── BullMQ Queue → Background Worker
         │                      │
         │                      ▼
         │               Document Processing
         │               (extract → chunk → embed)
         │
         ├── OpenAI Embeddings (text-embedding-3-small)
         ├── MongoDB Atlas Vector Search
         └── OpenAI Chat (gpt-4o-mini)
```

### RAG Pipeline

```
Document Upload:
PDF/TXT → S3 → BullMQ Job → Worker → Extract Text →
Chunk (400 chars, 80 overlap) → OpenAI Embed → Store in MongoDB

Query:
User Question → OpenAI Routing Decision →
Search Query → OpenAI Embed → Atlas Vector Search →
Relevance Check (score > 0.5) → Top 3 Chunks →
OpenAI gpt-4o-mini → Answer
```

### Agent Routing

```
User Question
    │
    ▼
OpenAI generates optimized search query (JSON)
    │
    ▼
MongoDB Atlas Vector Search (cosine similarity)
    │
    ▼
Relevance Score Check
    ├── Score > 0.5 → Answer from document context
    └── Score < 0.5 → Polite "not in your documents" response
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas account (free M0 cluster)
- AWS account (S3 bucket)
- Redis Cloud account (free tier)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/mirajTechtimize/ai-knowledge-base.git
cd ai-knowledge-base

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Fill in your values

# Start development server
npm run dev
```

---

## Environment Variables

```env
# App
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database
MONGO_URI=mongodb+srv://...

# JWT
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=

# OpenAI
OPENAI_API_KEY=

# Groq (optional - fallback LLM)
GROQ_API_KEY=

# Gemini (optional - fallback embeddings)
GEMINI_API_KEY=

# Redis
REDIS_URL=redis://...

# Production only
EC2_IP=
```

---

## API Documentation

Full interactive Swagger documentation available at `/api-docs`.

### Endpoints Overview

**Auth**
```
POST /api/v1/auth/register     — Register new user
POST /api/v1/auth/login        — Login
POST /api/v1/auth/refresh      — Refresh access token
POST /api/v1/auth/logout       — Logout
GET  /api/v1/auth/me           — Get current user
```

**Documents**
```
POST /api/v1/documents/upload-url      — Get S3 presigned upload URL
POST /api/v1/documents/:id/confirm     — Confirm upload complete
POST /api/v1/documents/:id/process     — Queue document for processing
GET  /api/v1/documents                 — List all user documents
GET  /api/v1/documents/:id             — Get document + download URL
DELETE /api/v1/documents/:id           — Delete document
```

**Chat**
```
POST /api/v1/chat              — Direct LLM chat
POST /api/v1/chat/query        — RAG query on specific document
```

**Agent**
```
POST /api/v1/agent/query       — AI agent query across all documents
```

### Document Upload Flow

```
1. POST /documents/upload-url  → get presigned URL + documentId
2. PUT presignedUrl            → upload file directly to S3 (client-side)
3. POST /documents/:id/confirm → mark upload complete
4. POST /documents/:id/process → queue for processing (returns immediately)
5. GET  /documents/:id         → poll until status = 'ready'
6. POST /agent/query           → query the processed document
```

---

## Project Structure

```
ai-knowledge-base/
├── src/
│   ├── config/
│   │   ├── index.js          # Centralized config from env vars
│   │   ├── db.js             # MongoDB connection
│   │   ├── redis.js          # Redis connection
│   │   ├── s3.js             # AWS S3 client
│   │   ├── openai.js         # OpenAI client
│   │   ├── groq.js           # Groq client
│   │   ├── gemini.js         # Gemini client
│   │   └── swagger.js        # Swagger config
│   ├── controllers/          # Request/response handlers
│   ├── services/             # Business logic
│   │   ├── auth.service.js
│   │   ├── document.service.js
│   │   ├── fileProcessor.service.js
│   │   ├── embedding.service.js
│   │   ├── vectorSearch.service.js
│   │   ├── s3.service.js
│   │   ├── chat.service.js
│   │   └── agent.service.js
│   ├── models/               # MongoDB schemas
│   ├── routes/               # Express routers + Swagger JSDoc
│   ├── middlewares/          # Auth, error, validation
│   ├── validators/           # express-validator rules
│   ├── queues/               # BullMQ queue definitions
│   ├── workers/              # BullMQ job processors
│   └── utils/                # ApiError, ApiResponse, asyncHandler
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

---

## Key Design Decisions

**Why presigned URLs for uploads?**
Files upload directly from client to S3 — the server never handles file bytes. This keeps the API lightweight, avoids memory spikes, and scales without server changes.

**Why BullMQ for document processing?**
Embedding 100+ chunks requires multiple API calls and takes 10-30 seconds. Synchronous processing would block the request and timeout. BullMQ processes documents in the background — the API returns immediately with a job ID, and the client polls for status.

**Why RAG over fine-tuning?**
Users upload different documents frequently and need answers grounded in specific content. RAG retrieves relevant chunks at query time without retraining. Fine-tuning would require retraining the model for every new document — impractical for a dynamic knowledge base.

**Why relevance scoring?**
After vector search, chunks below a 0.5 cosine similarity score are rejected. This prevents the LLM from hallucinating answers when the question has no relevant content in the uploaded documents.

**Why separate embedding and chat models?**
OpenAI `text-embedding-3-small` is optimized for semantic similarity — it produces consistent vectors for retrieval. `gpt-4o-mini` is optimized for instruction following and generation. Using the right model for each task improves both quality and cost efficiency.

---

## Deployment

The API is deployed on AWS EC2 (Ubuntu 24.04) with:
- **PM2** — process manager, auto-restart on crash, survives server reboots
- **Nginx** — reverse proxy, handles port 80 → 8000 forwarding
- **MongoDB Atlas** — managed cloud database, no server maintenance
- **Redis Cloud** — managed Redis, handles BullMQ job persistence
- **AWS S3** — scalable file storage with lifecycle policies

---

*Built by Muhammad Miraj Ali — Techtimize*
