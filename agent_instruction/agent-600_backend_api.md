STEP 6 — Backend API Integration
Objective

Expose analysis results via REST API.

Framework

Use:

Express OR Fastify

TypeScript

API Endpoints
Health
GET /health

Response:

{"status":"ok"}
Analyze Repo
POST /analyze-repo

Body:

{
 "repoUrl": "https://github.com/user/repo"
}

Response:

{
 "repoId": "hash"
}
Get Graph
GET /repo-graph/:repoId

Returns graph data.

Get Summary
GET /repo-summary/:repoId

Returns architecture explanation.

Get File Details
GET /file/:repoId/:filePath

Returns:

{
 "summary": "",
 "functions": [],
 "imports": []
}
Data Flow

API reads artifacts from:

data/results/<repoId>/

Files:

analysis.json
ai.json
graph.json
Performance

enable response caching

gzip responses

use streaming for large graphs

Tests

Test endpoints with:

supertest

Ensure:

endpoints return valid JSON

repo graph loads correctly

Acceptance Criteria

Backend must:

serve repo analysis
handle concurrent requests
PR

Branch:

feature/backend-api

Title:

feat(api): repository analysis endpoints
agent-700_release_and_open_source.md
