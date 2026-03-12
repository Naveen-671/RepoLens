# RepoLens

RepoLens is an AI-powered repository analysis and architecture visualization tool.
It scans codebases, builds a dependency graph, generates AI summaries, infers architecture, and serves an interactive graph UI.

## Project Overview

RepoLens helps developers understand unfamiliar repositories in minutes by combining static analysis and AI inference.

## Features

- Repository parsing and import graph extraction
- AI-generated file summaries and feature clusters
- Architecture inference and critical-file ranking
- Interactive React Flow visualization
- CLI pipeline orchestration and backend API endpoints

## Demo Usage

Run a full end-to-end analysis on a public repository:

```bash
npx repolens https://github.com/vercel/next.js
```

## Architecture

RepoLens has four main layers:

1. CLI orchestrator (`cli/`) for workflow execution
2. Analysis engine (`parser/`, `graph/`, `ai/`) for artifacts and inference
3. Backend API (`server/`) for serving results
4. Frontend app (`web/`) for interactive visualization

## Screenshots

Add visualization screenshots under `docs/screenshots/` and reference them here.

Suggested filenames:

- `docs/screenshots/graph-overview.png`
- `docs/screenshots/file-details.png`

## Demo GIF

Record a short walkthrough showing:

1. Running the CLI
2. Server startup
3. Graph exploration (zoom/pan/node click)

Place the file at `docs/demo/repolens-demo.gif` and embed it in this section.

## Installation

```bash
npx pnpm install
npx pnpm build
```

## CLI Usage

```bash
npx repolens <github-repo-url>
```

Common options:

- `--force`
- `--port=3000`
- `--no-ai`
- `--local-repo`

## Environment Variables

Set these variables in your environment (do not commit secrets):

- `GITHUB_TOKEN`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `EMBEDDING_PROVIDER`
- `EMBEDDING_API_KEY`
- `NODE_ENV`
- `CACHE_DIR`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and pull request guidelines.

## License

MIT License. See [LICENSE](LICENSE).