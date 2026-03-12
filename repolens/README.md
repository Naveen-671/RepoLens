# RepoLens

RepoLens is an AI-powered tool that analyzes repositories and produces architecture insights.

## Local setup

1. Install dependencies:
   - `pnpm install`
2. Build:
   - `pnpm build`
3. Start backend:
   - `pnpm start`
4. Run tests:
   - `pnpm test`

## Environment variables

- `GITHUB_TOKEN` (required for remote GitHub operations)
- `LLM_PROVIDER` (`groq` | `nim` | `openai`)
- `LLM_API_KEY`
- `EMBEDDING_PROVIDER` (optional)
- `EMBEDDING_API_KEY` (optional)
- `NODE_ENV` (`development` by default)
- `NODE_OPTIONS` (`--max_old_space_size=4096` recommended)

## Sample CLI output

Run:

`node ./dist/cli/index.js tests/fixtures/simple-sample`

Output artifact location:

`data/results/<hash>.json`