RepoLens — Agent Instructions (OVERVIEW)
Goal

Automate building the RepoLens MVP — an AI tool that analyzes any GitHub repository and generates architecture insight + visual maps. Deliver a working CLI + API + React UI that performs the core pipeline end-to-end.

Constraints & priorities

Finish a minimal end-to-end MVP (clone → parse → summarize → infer → visualize) first.

Use only free or user-supplied provider keys (Groq, NVIDIA NIM, or other free models). Agent must be provider-agnostic.

Strict TypeScript. All functions, modules, endpoints must include comments explaining each method and key lines (user preference).

Open source MIT license.

No secrets committed to git. Use environment variables for keys/tokens.

Branching: use feature/<short-task> for work. Create PRs to main with descriptive title.

Commit message format: feat(<area>): short description — #task or fix(<area>): short description.

PR template: short summary, how I tested, commands to run, risk & next steps.

Deliverables (MVP)

CLI: npx repolens <repo-url> that launches local server and runs analysis.

Backend API: Express or Fastify with endpoints:

POST /analyze-repo (repo URL)

GET /repo-graph/:id

GET /repo-summary/:id

Parser: repo clone, file scanner, dependency graph builder, function extractor.

AI layer: file summarizer, architecture inference, cluster detection, critical file ranking.

Frontend: React + React Flow visualization with node click → details panel.

Tests: unit tests for parser, graph builder. Integration smoke test: analyze a small public repo.

README with demo commands, screenshots placeholders, and contribution guide.

Quality rules

Add JSDoc/TSDoc for all exported functions.

All external API calls must use a single ai/providers.ts adapter so providers can be swapped.

Add caching for LLM results to ./data/cache (simple file cache).

Use ESLint + Prettier; TypeScript strict: true.

Reporting & PR workflow for agent

For each finished feature: create a branch, commit, push, open PR with tests passing (local).

PR description must include commands to reproduce and one example repo used for testing.

Use small incremental PRs; do not accumulate huge changes.