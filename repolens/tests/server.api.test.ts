import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { run } from '../cli/index';
import { createServer } from '../server/src/index';

vi.mock('../ai/providers', () => {
  return {
    createAiProvider: () => ({
      generate: async (prompt: string) => {
        if (prompt.includes('Output JSON:')) {
          return JSON.stringify({
            summary: 'Handles authentication flow orchestration for the login path.',
            likely_features: ['auth', 'api'],
          });
        }

        if (prompt.includes('Output array:')) {
          return JSON.stringify([
            {
              clusterName: 'auth',
              description: 'Authentication flow and token handling files.',
              representativeFile: 'src/authController.ts',
            },
          ]);
        }

        return JSON.stringify({
          architectureType: 'layered',
          briefExplanation: 'UI-facing files call controller files which call service files.',
          mainLayers: ['frontend', 'api', 'services'],
          sampleRequestFlow: [
            'src/loginForm.tsx',
            'src/authController.ts',
            'src/services/authService.ts',
          ],
        });
      },
      embed: async () => [0.1, 0.2, 0.3],
    }),
  };
});

describe('backend API endpoints', () => {
  it('serves health and analysis artifacts through API routes', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const cliResult = await run(fixturePath, {
      localRepo: true,
      startServer: false,
    });

    const repoId = path.basename(path.dirname(cliResult.artifactPath));

    const app = createServer();
    const healthResponse = await request(app).get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.status).toBe('ok');

    const graphResponse = await request(app).get(`/repo-graph/${repoId}`);
    expect(graphResponse.status).toBe(200);
    expect(Array.isArray(graphResponse.body.nodes)).toBe(true);
    expect(Array.isArray(graphResponse.body.edges)).toBe(true);

    const summaryResponse = await request(app).get(`/repo-summary/${repoId}`);
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.architectureType).toBeTruthy();

    const fileResponse = await request(app).get(`/file/${repoId}/src/authController.ts`);
    expect(fileResponse.status).toBe(200);
    expect(Array.isArray(fileResponse.body.functions)).toBe(true);
    expect(Array.isArray(fileResponse.body.imports)).toBe(true);

    const analyzeResponse = await request(app)
      .post('/analyze-repo')
      .send({
        repoUrl: fixturePath,
        localRepo: true,
        noAi: true,
        force: true,
      });
    expect(analyzeResponse.status).toBe(200);
    expect(analyzeResponse.body.repoId).toBeTruthy();
  });
});
