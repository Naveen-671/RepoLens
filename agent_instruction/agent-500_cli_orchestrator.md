STEP 5 — CLI Orchestrator
Objective

Build the CLI entrypoint that runs the full RepoLens pipeline.

Command:

npx repolens <github-repo-url>
Pipeline Steps

The CLI orchestrates the full workflow:

1 clone repository
2 parse files
3 build dependency graph
4 run AI summarization
5 detect clusters
6 infer architecture
7 save results
8 start local server
CLI Options

Supported flags:

--force
--port=3000
--no-ai
--local-repo

Descriptions:

Flag	Purpose
force	reprocess repo ignoring cache
port	server port
no-ai	skip AI summarization
local-repo	treat argument as local folder
CLI Output

Example output:

Analyzing repository...

Cloning repo
Parsing 245 files
Building dependency graph
Generating AI summaries
Detecting architecture

Analysis complete

Open visualization:
http://localhost:3000
Implementation

Create module:

cli/index.ts

Main function:

async function run(repoUrl: string)

Responsibilities:

validate input

run pipeline modules sequentially

store artifacts in /data/results

Result Directory Structure
data/
  repos/
  results/
    repoHash/
      analysis.json
      ai.json
      graph.json
Error Handling

Handle cases:

invalid repo URL
network errors
LLM provider unavailable
repo too large

Retry logic:

retry AI calls twice

exponential backoff

Tests

Test CLI with:

tests/fixtures/simple-sample

Verify:

pipeline runs

results generated

server starts

Acceptance Criteria

Running CLI should:

generate graph
generate AI summaries
start visualization server
PR

Branch:

feature/cli-pipeline

Title:

feat(cli): end-to-end repo analysis pipeline
agent-600_backend_api.md
