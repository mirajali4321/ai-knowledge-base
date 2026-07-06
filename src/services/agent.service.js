const groqClient = require("../config/grog");
const config = require("../config");
const vectorSearchService = require("./vectorSearch.service");

// ── Step 1 — Routing decision ─────────────────────────────────────
const decideRoute = async (question) => {
  const response = await groqClient.chat.completions.create({
    model: config.groq.model,
    messages: [
      {
        role: "system",
        content: `You are a routing assistant. Given a user question, decide whether to search a knowledge base or answer directly.

Reply ONLY with valid JSON in one of these two formats:
{ "tool": "search_knowledge_base", "query": "the search query to use" }
{ "tool": "answer_directly" }

Rules:
- Use search_knowledge_base for ANY question about specific documents, plans, people, schedules, policies, or domain-specific information
- Use answer_directly ONLY for pure general knowledge like math, basic science, or common definitions
- When in doubt, always use search_knowledge_base
- Reply with JSON only, no explanation, no markdown`,
      },
      {
        role: "user",
        content: question,
      },
    ],
    temperature: 0,
    max_tokens: 100,
  });

  const raw = response.choices[0].message.content.trim();

  try {
    // strip markdown code blocks if present
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // if parsing fails default to search
    return { tool: "search_knowledge_base", query: question };
  }
};

// ── Agent — single pass ───────────────────────────────────────────
const runAgent = async ({ question, userId }) => {
  // ── Step 1 — Decide route ─────────────────────────────────────
  const route = await decideRoute(question);

  // ── Step 2 — Execute decision ─────────────────────────────────
  let context = null;
  let toolUsed = route.tool;

  if (route.tool === "search_knowledge_base") {
    const chunks = await vectorSearchService.searchAllUserDocuments({
      query: route.query || question,
      userId,
    });

    if (chunks.length > 0) {
      context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
    }
  }

  // ── Step 3 — Generate final answer ────────────────────────────
  const systemPrompt = context
    ? `You are a helpful assistant. Answer based strictly on the context below.
If the answer is not in the context, say "I don't have enough information in your documents to answer that."

Context:
${context}`
    : "You are a helpful assistant. Answer clearly and concisely from your general knowledge.";

  const finalResponse = await groqClient.chat.completions.create({
    model: config.groq.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    temperature: 0.2,
    max_tokens: 1024,
  });

  return {
    answer: finalResponse.choices[0].message.content,
    toolUsed,
    chunksUsed: context ? context.split("\n\n").length : 0,
  };
};

module.exports = { runAgent };
