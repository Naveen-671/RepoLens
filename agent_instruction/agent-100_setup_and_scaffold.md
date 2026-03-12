STEP 1 — Setup & Project Scaffold
Objective

Create the project repo skeleton, CI, dev environment, and basic server + web placeholders.

Required environment variables (agent must read from runtime, not commit)
GITHUB_TOKEN            # for pushing branches / creating PRs (scope: repo)
LLM_PROVIDER            # 'groq' | 'nim' | 'openai' (string)
LLM_API_KEY             # API key for chosen LLM provider
EMBEDDING_PROVIDER      # optional: 'bge' | 'nomic' | 'local'
EMBEDDING_API_KEY       # if required
NODE_ENV=development
NODE_OPTIONS=--max_old_space_size=4096

Agent must verify all required env vars before making remote calls. If missing, fail fast with clear message.

Tooling / versions

Node >= 18

npm or pnpm

TypeScript >= 5.x

React 18

Use simple-git, ts-morph, fast-glob, react-flow-renderer, express or fastify, axios, jest or vitest

Add husky precommit hooks to run lint/tests.

Tasks (ordered)

Initialize monorepo folder repolens/ with package.json, tsconfig.json (strict).

Create folders: cli/, parser/, ai/, graph/, server/, web/, data/, tests/, scripts/.

Add basic server skeleton: server/src/index.ts → returns 200 OK on /health.

Add CLI skeleton: cli/index.ts with function run(repoUrl).

Add README placeholder and LICENSE (MIT).

Create ESLint + Prettier configs.

Setup simple CI (GitHub Actions): on PR run pnpm install && pnpm build && pnpm test.

Add an initial sample-repo test case in tests/fixtures/simple-sample — a tiny repo with 3 files (frontend → api → service) for end-to-end smoke tests.

Commands the agent must create and test locally

Install: pnpm install

Build: pnpm build (transpile TS)

Start server (dev): pnpm dev -> runs backend and frontend in dev mode

CLI run sample: node ./dist/cli/index.js tests/fixtures/simple-sample (should complete quickly and produce data/results/<hash>.json)

Acceptance criteria

npm run start starts backend that responds at GET /health with {status: "ok"}.

node ./dist/cli/index.js <sample-repo-path> completes and saves a JSON artifact in ./data/results/.

ESLint and TypeScript compile cleanly.

PR instructions

Branch: feature/setup-scaffold

Title: chore(setup): monorepo scaffold & CI

PR body: steps to run locally, env variables required, sample output path.