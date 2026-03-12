import express from 'express';

/**
 * Creates the HTTP server app with health endpoints.
 */
export function createServer() {
  const app = express();

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

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