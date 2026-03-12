STEP 8 — AI Onboarding Chat for Repositories
Objective

Provide an assistant interface that answers natural-language questions about a repository using the RepoLens analysis artifacts. The assistant should behave like a senior engineer: cite files, show short excerpts, and point to exact file paths. All responses must include sources (file paths and short code snippets ≤ 25 words).

High-level design

Use embeddings + semantic search over fileSummaries and analysis.json before calling the LLM.

Retrieve top-N relevant files (N=10), then build a focused prompt with metadata (summary, small code excerpt if available).

LLM answers using only retrieved context; produce a short answer (1–6 sentences) + sources list.

Expose via API: POST /chat/:repoId with { query, topK }.

Required environment variables
EMBEDDING_PROVIDER    # e.g., 'bge' | 'nomic' | 'local'
EMBEDDING_API_KEY
LLM_PROVIDER
LLM_API_KEY
Pipeline (call flow)

Accept user query.

Run embedding for query.

Retrieve top-K file summaries by cosine similarity from ./data/results/<repoId>/embeddings/*.json.

For each retrieved file include: path, summary, first 3 comment lines, up to 5 relevant code lines (if available).

Build LLM prompt using template (below).

Call LLM with generate() through ai/providers.ts.

Return JSON:

{
  "answer": "string",
  "sources": [
    { "path": "src/authController.ts", "excerpt": "async function loginUser(req, res)..." }
  ],
  "confidence": 0.87
}
Prompt templates (use verbatim unless optimizing)
Retrieval-augmented answer prompt
You are a senior software engineer. Answer the user's question about this repository concisely (1-6 sentences).
You MUST only use information from the provided context files. For each claim add a source array with {path, short_excerpt}.

User question:
{{query}}

Context files (max 10):
{{#each files}}
- PATH: {{path}}
  SUMMARY: {{summary}}
  EXCERPT: {{excerpt}}
{{/each}}

Output JSON:
{
  "answer":"...",
  "sources":[ { "path":"", "excerpt":"" }, ... ],
  "confidence":0.0
}
Follow-up clarifying prompt (if needed)
User asked: {{query}}. The top retrieved files are ambiguous about authentication vs authorization. Ask a single clarifying question limited to 15 words if needed; otherwise answer directly.
Implementation details

Use vector store (file-based): store embeddings as ./data/results/<repoId>/embeddings/<file>.json.

Use Faiss or simple in-memory cosine (for MVP implement numpy-like cosine in JS).

Cache query embeddings and retrieval sets for 24 hours.

Enforce LLM token budget: truncate long import lists; do not include full files.

Rate-limit: max 4 concurrent chat requests per repo.

API

POST /chat/:repoId — body { query: string, topK?: number }

Returns the answer, sources, confidence, and used_files.

UI integration

Add ChatPanel in frontend:

Input box

Results show answer, list of source cards with "open file" buttons that jump to FileDetails panel and highlight lines.

Security & privacy

Never include secrets in context.

If a retrieved snippet contains process.env or string-looking tokens, redact before sending to LLM.

Log queries (optionally) to ./data/logs/chat/<repoId>.log.

Tests & acceptance

Unit test: mock embeddings/provider; for query "where is authentication?" the API returns answer containing authController and at least one source path.

Integration: run chat against tests/fixtures/simple-sample and assert response JSON valid and sources non-empty.

Manual: ask chat "Where is authentication?" and confirm UI link opens authController.ts.

PR instructions

Branch: feature/ai-chat

Title: feat(ai): retrieval-augmented onboarding chat

Include sample traces in PR comment (example query + response).