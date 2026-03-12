import path from 'node:path';
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
import { chatWithRepository } from './chatService';
import { generateRepoFlows, getRepoFlows, resolveFlowDownloadPath } from './flowService';
import { createRepoPullRequest, createRevertPullRequest } from './prService';

/**
 * Creates the HTTP server app with health endpoints.
 */
export function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(compression());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
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
        getGraphStream(repoId).pipe(res);
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
      res.download(filePath);
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