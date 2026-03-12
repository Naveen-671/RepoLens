STEP 10 — Git Provider Integration & Auto-PR Workflow
Objective

Allow the agent to propose, branch, patch, and open pull requests on the repository under analysis using an authorized token. PRs must be minimally invasive, well-documented, and reversible. This enables the agent to optionally apply small fixes or scaffold files.

Required environment variables
GITHUB_TOKEN     # required; scope: repo (create branch, push, open PR)
GIT_AUTHOR_NAME  # for commits
GIT_AUTHOR_EMAIL

Agent must validate token permissions before any write operations.

Security constraints (mandatory)

Never write secrets into files or commit environment variables.

Never push code that includes hard-coded keys or credentials.

All automatic PRs must be created on a feature branch named auto/<task>-<timestamp>.

PR title and body must clearly indicate agent origin and list commands it ran and files changed.

Use cases (examples)

Add .gitignore entries for node_modules, data/, *.env.

Add Defender exclusions documentation.

Add small code fixes (typo, missing export) limited to single-file edits.

Create CI workflow or test that reproduces agent output.

Workflow (safe default)

Create local branch auto/<short>-<sha> from main.

Make programmatic changes in working tree.

Run pnpm lint && pnpm test locally in the workspace. If tests fail, abort and open an Issue instead.

Commit using format: feat(auto): <short description> — #auto

Push branch to remote using GITHUB_TOKEN.

Create PR with:

title: chore(auto): <short description> — automated by RepoLens

body: include list of changed files, reason, how agent validated, commands to reproduce, and risk notes.

Add reviewers if CODEOWNERS exists; otherwise add repository owner as reviewer.

Patch generation approach

For code changes, use unified diff patch format. Prefer minimal hunks.

Derive patch using AST-aware transformations where possible (e.g., ts-morph for TS changes) instead of naive string replace.

For textual updates (README, CONTRIBUTING), use well-formed markdown diffs.

Endpoint & CLI integration

CLI flag: --auto-pr defaults to off. When on, the agent will attempt to open PRs for changes annotated as low-risk.

API endpoint: POST /repo-action/:repoId/pr with { changes: [{ path, patch }], title, body, requireApproval: true|false }

If requireApproval:true then agent will open PR but NOT merge; human must approve.

If requireApproval:false agent may auto-merge only if repository allows and passes CI (not recommended for public repos).

Safety checks (must implement)

Run linter/tests after applying changes; if failing, DO NOT push.

Block any changes that modify files containing secrets, .env, or files under config/ that match regex .*(KEY|SECRET|TOKEN).*.

Confirm branch name uniqueness; do not overwrite existing auto branches.

Rate limit PR creation (max 5 per repo per day).

Audit & rollback

Log each PR action to ./data/logs/pr-actions.log with timestamps, branch, PR URL, and patches.

Provide POST /repo-action/:repoId/revert to automatically create a revert PR that undoes the agent's last merge (create revert branch and PR).

Tests & acceptance

Integration test (mocked): create branch, commit a small README fix, push to a test repo and open PR (test repo must be pre-configured and token scoped).

Unit: functions that create patches must be deterministic and include file path + hunk metadata.

Safety test: attempt to commit a file containing API_KEY and confirm agent aborts and creates an Issue instead.

PR instructions

Branch: feature/auto-pr

Title: feat(ci): safe auto-PR integration

Include sample PR created against a test repository (link) or recorded response if live test not allowed.