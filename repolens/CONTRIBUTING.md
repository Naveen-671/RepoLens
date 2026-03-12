# Contributing to RepoLens

Thanks for helping improve RepoLens.

## Development Setup

1. Install dependencies:
   - `npx pnpm install`
2. Run quality checks:
   - `npx pnpm lint`
   - `npx pnpm build`
   - `npx pnpm test`
3. Run the local CLI pipeline:
   - `node ./dist/cli/index.js tests/fixtures/simple-sample --local-repo`

## Branch and Commit Guidelines

1. Create a feature branch from the latest main branch.
2. Keep commits focused and descriptive.
3. Preferred commit style:
   - `feat(scope): summary`
   - `fix(scope): summary`
   - `chore(scope): summary`

## Pull Request Checklist

1. Include a concise problem statement and solution summary.
2. Add or update tests for behavior changes.
3. Ensure lint, build, and test pass locally.
4. Add screenshots/GIF for frontend changes when relevant.

## Reporting Issues

When opening an issue, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment details (OS, Node version)
