import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import compression from 'compression';
import express from 'express';
import {
  analyzeRepoFromApi,
  getFileDetails,
  getGraphStream,
  getRepoGraph,
  getRepoSummary,
  isLargeGraph,
} from './repositoryService';
import { chatWithRepository, generateGuidedBreakdown } from './chatService';
import { generateRepoFlows, getRepoFlows, resolveFlowDownloadPath } from './flowService';
import { createRepoPullRequest, createRevertPullRequest } from './prService';
import { readArtifactJson, type RepoGraphPayload } from './artifacts';

/**
 * CORS middleware — allows cross-origin requests from the Vercel frontend.
 */
function corsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

/**
 * Creates the HTTP server app with health endpoints.
 */
export function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(compression());
  app.use(corsMiddleware);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/repos/latest', async (_req, res) => {
    try {
      const resultsRoot = path.resolve(process.cwd(), 'data', 'results');
      const entries = await fs.readdir(resultsRoot, { withFileTypes: true });
      const repoFolders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      if (repoFolders.length === 0) {
        res.status(404).json({ error: 'No analyzed repositories found' });
        return;
      }

      const ranked = await Promise.all(
        repoFolders.map(async (repoId) => {
          const analysisPath = path.join(resultsRoot, repoId, 'analysis.json');
          const stat = await fs.stat(analysisPath).catch(() => null);
          return {
            repoId,
            modifiedMs: stat?.mtimeMs ?? 0,
          };
        }),
      );

      ranked.sort((a, b) => b.modifiedMs - a.modifiedMs);
      res.status(200).json({ repoId: ranked[0].repoId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.post('/analyze-repo', async (req, res) => {
    try {
      const payload = req.body as {
        repoUrl?: string;
        localRepo?: boolean;
        noAi?: boolean;
        force?: boolean;
      };

      const result = await analyzeRepoFromApi({
        repoUrl: payload.repoUrl ?? '',
        localRepo: payload.localRepo,
        noAi: payload.noAi,
        force: payload.force,
      });

      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.get('/repo-graph/:repoId', async (req, res) => {
    try {
      const repoId = req.params.repoId;
      const largeGraph = await isLargeGraph(repoId);
      res.setHeader('Cache-Control', 'public, max-age=30');

      if (largeGraph) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const stream = getGraphStream(repoId);
        stream.on('error', (err) => {
          if (!res.headersSent) {
            res.status(500).json({ error: err.message });
          }
        });
        stream.pipe(res);
        return;
      }

      const graph = await getRepoGraph(repoId);
      res.status(200).json(graph);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.get('/repo-summary/:repoId', async (req, res) => {
    try {
      const summary = await getRepoSummary(req.params.repoId);
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(200).json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.get('/file/:repoId/:filePath(*)', async (req, res) => {
    try {
      const details = await getFileDetails(req.params.repoId, req.params.filePath);
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(200).json(details);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.get('/function-details/:repoId/:filePath(*)', async (req, res) => {
    try {
      const graph = await readArtifactJson<RepoGraphPayload>(req.params.repoId, 'graph.json');
      const decodedPath = decodeURIComponent(req.params.filePath);
      const node = graph.nodes.find((n) => n.id === decodedPath);
      if (!node) {
        res.status(404).json({ error: `File not found: ${decodedPath}` });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(200).json({
        path: node.id,
        functionDetails: node.functionDetails ?? [],
        classDetails: node.classDetails ?? [],
        dataFlowIn: node.dataFlowIn ?? [],
        dataFlowOut: node.dataFlowOut ?? [],
        externalImports: node.externalImports ?? [],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.post('/chat/:repoId', async (req, res) => {
    try {
      const body = req.body as { query?: string; topK?: number };
      const response = await chatWithRepository(req.params.repoId, body.query ?? '', body.topK ?? 10);
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.post('/guided-learning/:repoId', async (req, res) => {
    try {
      const body = req.body as { topic?: string };
      const response = await generateGuidedBreakdown(req.params.repoId, body.topic ?? 'full overview');
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.get('/repo-health/:repoId', async (req, res) => {
    try {
      const graph = await readArtifactJson<RepoGraphPayload>(req.params.repoId, 'graph.json');
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(200).json(graph.repoMetrics ?? {
        totalFiles: graph.nodes.length,
        totalLinesOfCode: 0,
        totalFunctions: 0,
        totalClasses: 0,
        totalInterfaces: 0,
        avgComplexity: 1,
        avgHealthScore: 0.5,
        complexityHotspots: [],
        largestFiles: [],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.get('/repo-flows/:repoId', async (req, res) => {
    try {
      const flows = await getRepoFlows(req.params.repoId);
      res.status(200).json({ flows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.post('/repo-flows/:repoId/generate', async (req, res) => {
    try {
      const body = req.body as { entryPoint?: string };
      const flows = await generateRepoFlows(req.params.repoId, body.entryPoint);
      res.status(200).json({ flows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.get('/repo-flows/:repoId/download/:flowId', (req, res) => {
    try {
      const filePath = resolveFlowDownloadPath(req.params.repoId, req.params.flowId);
      res.download(filePath, (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ error: err.message });
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json({ error: message });
    }
  });

  app.post('/repo-action/:repoId/pr', async (req, res) => {
    try {
      const body = req.body as {
        changes: Array<{ path: string; patch: string }>;
        title: string;
        body: string;
        requireApproval: boolean;
      };

      const result = await createRepoPullRequest(req.params.repoId, {
        changes: body.changes,
        title: body.title,
        body: body.body,
        requireApproval: body.requireApproval,
      });

      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.post('/repo-action/:repoId/revert', async (req, res) => {
    try {
      const result = await createRevertPullRequest(req.params.repoId);
      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.use('/data/results', express.static(path.resolve(process.cwd(), 'data', 'results')));

  const webDist = path.resolve(process.cwd(), 'dist', 'web');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
    app.get('/visualization/flow/:repoId', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}

/**
 * Starts the backend server process.
 */
export function startServer(port = 3000) {
  const app = createServer();
  return app.listen(port, () => {
    process.stdout.write(`RepoLens server listening on http://localhost:${port}\n`);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  startServer(port);
}