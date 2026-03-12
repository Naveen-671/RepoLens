STEP 9 — Request Flow Animation
Objective

Generate an animated request-flow visualization that demonstrates how a request travels through the codebase (frontend → API → service → DB). Exportable as SVG and recordable as a short GIF/webm for README/demo.

Inputs

graph.json (nodes, edges, clusters)

ai.json (file summaries & clusters)

Optionally an example request path (entry point file path or route)

Output

Interactive animated flow in the frontend (/visualization/flow/:repoId) that:

Highlights nodes in sequence

Shows a summary card for each step

Offers "Export SVG" and "Record GIF" buttons

Pre-rendered demo file saved to ./data/results/<repoId>/flows/<flow-name>.webm

Flow extraction algorithm

Identify probable entry points:

For web apps: files that contain route, router, pages, getServerSideProps, or API route indicators.

For general repos: files with main, server.listen, or app.use.

For a chosen entry point, find shortest path(s) to files labeled as database or repository by clustering results.

Prefer paths that pass through files with controller/service in their summaries.

Score candidate paths and pick top 3 by relevance.

Build a linear ordered list of nodes for animation.

Frontend implementation (React)

Use React Flow for base graph.

Use framer-motion for animation of node highlight and path pulses.

Controls:

Play / Pause / Step Forward / Step Back

Speed slider (0.5x–2x)

Export SVG: render current frame to SVG and prompt download.

Record GIF/webm: use html2canvas + gif.js or MediaRecorder capturing canvas stream.

API endpoints

GET /repo-flows/:repoId — returns available flows (list of entry points and precomputed paths).

POST /repo-flows/:repoId/generate — generate flows for repo (async). Body: { entryPoint?: string }

GET /repo-flows/:repoId/download/:flowId — returns pre-rendered webm.

Implementation details

Precompute flows in backend and cache under ./data/results/<repoId>/flows/.

Use headless browser (Puppeteer) for server-side recording when Record requested and queue processed jobs to avoid overloading host.

Provide fallback: if recording not available (no ffmpeg), frontend uses client-side MediaRecorder to create short webm locally.

Performance & safety

Limit server-side recording to flows under 20 nodes.

Queue long jobs and send progress via SSE or polling.

Do not include code larger than 10 lines in the overlay; keep excerpts short.

Tests & acceptance

Unit: path extraction returns a list of node ids and summaries for tests/fixtures/simple-sample.

Integration: render animation for sample repo; confirm Play cycles through nodes and FileDetails panel updates in sequence.

Export test: clicking Export SVG returns a valid SVG file with annotated node highlights.

PR instructions

Branch: feature/flow-animation

Title: feat(frontend): request-flow animation and export

Attach a demo webm/GIF from tests/fixtures/simple-sample in the PR.