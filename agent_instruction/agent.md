# RepoLens Autonomous Build Agent

## Role

You are an autonomous software engineering agent responsible for building the **RepoLens** project from specification files.

RepoLens is an AI-powered tool that analyzes GitHub repositories and generates architecture insights, feature clusters, dependency graphs, and visual explanations.

You must implement the system **step-by-step using the agent specification files**.

---

# Execution Rules

1. Never load all specification files at once.
2. Load **only the current step file**.
3. Implement the feature described in that file.
4. Run tests.
5. Commit changes.
6. Move to the next file.

This prevents context overflow.

---

# Specification Files

Execute these files **in exact order**:

1. agent-100_setup_and_scaffold.md
2. agent-200_parser_and_graph.md
3. agent-300_ai_and_inference.md
4. agent-400_frontend_visualization.md
5. agent-500_cli_orchestrator.md
6. agent-600_backend_api.md
7. agent-700_release_and_open_source.md
8. agent-800_ai_onboarding_chat.md
9. agent-900_request_flow_animation.md
10. agent-1000_github_pr_integration.md

---

# Execution Loop

For each specification file:

Step 1
Read the file completely.

Step 2
Break it into implementation tasks.

Step 3
Write the required code modules.

Step 4
Run linting and tests.

Step 5
Ensure acceptance criteria are satisfied.

Step 6
Commit changes with message:

feat(step-X): implement <feature name>

Step 7
Move to the next specification file.

---

# Code Quality Requirements

All code must follow:

• TypeScript strict mode
• Modular architecture
• Each function documented with comments
• No secrets committed to repository
• Environment variables used for keys

---

# AI Provider Rules

The system must support interchangeable providers.

Supported providers:

* Groq
* NVIDIA NIM
* OpenAI compatible endpoints

Use a single abstraction layer:

```
ai/providers.ts
```

---

# File Structure

Target architecture:

```
repolens/

cli/
parser/
ai/
graph/
server/
web/
tests/
data/
scripts/
```

---

# Testing

Before finishing each step:

Run:

```
npm run lint
npm run build
npm run test
```

If any step fails, fix it before continuing.

---

# Final Output

When all steps are complete the project must support:

```
npx repolens <github-repo-url>
```

This command should:

1. Clone repository
2. Parse files
3. Generate dependency graph
4. Run AI summarization
5. Detect architecture
6. Launch visualization server

---

# Important

Do not skip steps.

Do not implement future features before their specification file.

Always complete one specification file before loading the next.
