STEP 2 — Parser & Dependency Graph
Objective

Implement repo clone, file scanner, AST-based extractor, and file-level dependency graph builder. Produce deterministic JSON artifacts for downstream AI.

Inputs

repo URL or local path

options: --depth=1, --extensions=ts,js,py,java,go,tsx,jsx

Outputs (artifact)

Write artifact to ./data/results/<repo-hash>/analysis.json with structure:

{
  "repo": "https://github.com/xxx/yyy",
  "files": [
    {
      "path": "src/authController.ts",
      "size": 1234,
      "imports": ["../services/authService", "jsonwebtoken"],
      "exports": ["loginUser"],
      "functions": ["loginUser", "logoutUser"]
    }
  ],
  "nodes": [{ "id": "src/authController.ts" }],
  "edges": [{ "source": "src/loginForm.tsx", "target": "src/api/login.ts", "type": "import" }]
}
Implementation details (must follow)

Clone: use simple-git shallow clone depth=1 to temp dir ./data/repos/<repo-hash>. Validate URL and handle rate errors.

File scan: use fast-glob for extensions. Ignore node_modules, .git, dist, build, out.

TypeScript/JS parsing: use ts-morph to extract imports, exports, function names, class names, and call expressions. For non-TS languages:

Attempt tree-sitter if available for that language;

Otherwise apply conservative regex to collect import/require patterns and def/function names.

Graph: build file-level directed graph where edge exists if file A imports from file B. Normalize import paths to repo relative paths. Record external package imports separately.

Function extraction: add a calls array for each file where possible listing function names that file invokes (when statically resolvable).

Performance: stream files, limit memory by parsing in batches of 50 files; write intermediate JSON checkpoints to disk every 100 files so work is resumable.

Cache: if ./data/repos/<repo-hash>/analysis.json exists, skip re-parsing unless --force is passed.

Tests & sample

Unit test: parse the included tests/fixtures/simple-sample repo and assert:

analysis.json exists

expected nodes and edges count matches fixtures

authController.ts has loginUser in functions and imports authService.

Integration: run CLI analyze on small public repo https://github.com/sindresorhus/ama (or other tiny repo) to ensure no crashes.

Acceptance criteria

For sample repo, JSON produced matches expected structure and contains nodes/edges.

Parser handles TypeScript and JavaScript correctly for common patterns.

No heavy memory usage for repos < 5k files.

PR instructions

Branch: feature/parser-graph

Title: feat(parser): repo cloning, scanning, ts-morph extractor, graph builder

Include sample output JSON in PR artifacts or repo under tests/expected/.