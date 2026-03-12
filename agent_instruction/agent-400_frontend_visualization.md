STEP 4 — Frontend Visualization
Objective

Build a React web interface that visualizes the repository architecture and dependency graph.

The UI must allow developers to understand a repo visually in seconds.

Tech Stack

Frontend framework:

React 18

TypeScript

Vite

Visualization:

reactflow

d3-force (optional)

UI:

TailwindCSS

shadcn/ui (optional)

Data Inputs

Frontend consumes backend endpoints:

GET /repo-graph/:id
GET /repo-summary/:id

Expected structure:

{
 "nodes": [
   {"id":"authController.ts","type":"file","summary":"handles login"}
 ],
 "edges": [
   {"source":"loginForm.tsx","target":"authController.ts"}
 ],
 "clusters": [
   {"name":"authentication","nodes":["authController.ts","authService.ts"]}
 ]
}
UI Layout

Create a 3-panel layout

---------------------------------------
| Repo Summary | Graph Visualization  |
|              |                      |
|              |                      |
---------------------------------------
| File Details / Cluster Details     |
---------------------------------------
Components
RepoSummaryPanel

Displays:

Architecture type
Explanation
Feature clusters
Critical files
GraphView

Uses React Flow.

Features:

nodes = files

edges = imports

cluster highlighting

zoom

pan

FileDetailsPanel

When user clicks a node:

Show:

File path
Summary
Functions
Imports
Cluster name
Graph Rendering Rules

cluster nodes should share colors

critical files should have thicker borders

external dependencies should appear faded

Example Node Structure
{
 "id": "authController.ts",
 "data": {
   "label": "authController.ts",
   "summary": "Handles login API requests"
 },
 "type": "default"
}
Performance Requirements

Graph must handle:

up to 1500 nodes
3000 edges

Techniques:

lazy rendering

node grouping

collapse clusters

Tests

Load sample repo graph

Ensure nodes render

Clicking node shows summary

Cluster colors consistent

Acceptance Criteria

Graph loads within 2 seconds

Node click reveals summary

Repo summary panel renders architecture explanation

PR

Branch:

feature/frontend-graph-ui

Title:

feat(frontend): repository visualization interface