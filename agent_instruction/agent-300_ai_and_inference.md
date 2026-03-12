STEP 3 — AI Layer: Summaries, Clustering, Architecture Inference
Objective

Create an AI adapter and services that:

Summarize single file responsibilities.

Cluster files into features.

Infer architecture and request flows.

Rank critical files.

Required env variables (repeated here for clarity)
LLM_PROVIDER      # 'groq' | 'nim' | 'openai'
LLM_API_KEY
EMBEDDING_PROVIDER    # optional
EMBEDDING_API_KEY     # optional
CACHE_DIR=./data/cache
Design constraints

Provider-agnostic adapter ai/providers.ts that exposes:

generate(prompt, options): Promise<string>

embed(text): Promise<number[]> (optional)

Use summaries only (never send full file content to LLM). Construct compact metadata payload per file:

filename, imports, exports, top-level function names, top-level comments (first 3 comment lines) and relative path.

Use chunking: batch 20 files per request when doing cluster-level reasoning.

Cache all LLM responses to CACHE_DIR keyed by sha256(prompt).

Prompts (agent must use these templates verbatim unless optimizing)
File summary prompt (single file)
You are an expert senior engineer. Given compact file metadata, produce a single concise sentence describing the file's responsibility and a 1-line list of probable features it belongs to.

File: {{filename}}
Imports: {{imports}}
Exports: {{exports}}
Functions: {{functions}}
Top comments: {{comments}}

Output JSON:
{"summary":"...", "likely_features":["auth","api","db"]}

Token budget per prompt: aim ≤ 400 tokens. Save result JSON.

Architecture inference prompt (cluster-level)
You are a system architect. Given these file summaries and the dependency edges, infer the overall architecture style (choose from: MVC, layered, microservices, hexagonal, monolith) and produce:
- architectureType: string
- briefExplanation: 2-3 sentences
- mainLayers: ordered list (e.g., ["frontend","api","services","database"])
- sampleRequestFlow: a short flow using filenames (3-6 steps)

Input: { summaries: [...], edges: [...] }
Output JSON as described.

Budget: ≤ 2000 tokens.

Feature mapping prompt
Given clusters of files, produce a human-friendly feature label and 1-line description for each cluster.
Input: cluster files with summaries.
Output array: [{clusterName, description, representativeFile}]
Embeddings & retrieval (optional but recommended)

Compute embeddings for file summaries and support semantic search to locate relevant files for a natural language query (e.g., "where is authentication?").

Use local embedding model if possible, otherwise use provider. Cache embeddings.

Critical-file ranking algorithm

Compute graph centrality: degree, betweenness.

Combine centrality with heuristic: files with many incoming edges + service-like names + summary containing "service" or "controller" get boosted.

Output top 10 files with score (0–1).

Storage & outputs

Save AI artifacts to ./data/results/<repo-hash>/ai.json:

{
  "fileSummaries": [{ "path":"", "summary":"", "features":[""] }],
  "clusters":[{ "name":"auth", "files":["..."] }],
  "architecture":{ "architectureType":"layered", "explanation":"", "mainLayers":[] },
  "criticalFiles":[{ "file":"", "score":0.91 }]
}
Tests & acceptance

Using tests/fixtures/simple-sample produce meaningful ai.json with:

at least one feature cluster labeled correctly (e.g., "auth").

architectureType not empty and consistent with sample (layered/monolith).

each file has a non-empty summary.

Unit tests should mock ai/providers.ts to return deterministic responses.

Safety / cost controls

Rate limit: max 5 concurrent LLM requests.

Prompt token caps: enforce using simple heuristics (truncate long imports lists, only include top 20 imports).

If provider returns error, retry twice with exponential backoff then fail gracefully and record error in ai.json.

PR instructions

Branch: feature/ai-inference

Title: feat(ai): file summarizer, clustering, architecture inference, ranking

Include one sample ai.json for the tests/fixtures/simple-sample.