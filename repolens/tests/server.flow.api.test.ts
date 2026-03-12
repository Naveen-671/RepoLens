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
      embed: async () => [0.2, 0.1, 0.3],
    }),
  };
});

describe('flow API', () => {
  it('generates, lists, and downloads flow artifacts', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const cliResult = await run(fixturePath, {
      localRepo: true,
      startServer: false,
    });

    const repoId = path.basename(path.dirname(cliResult.artifactPath));
    const app = createServer();

    const generateResponse = await request(app)
      .post(`/repo-flows/${repoId}/generate`)
      .send({ entryPoint: 'src/loginForm.tsx' });
    expect(generateResponse.status).toBe(200);
    expect(Array.isArray(generateResponse.body.flows)).toBe(true);
    expect(generateResponse.body.flows.length).toBeGreaterThan(0);

    const listResponse = await request(app).get(`/repo-flows/${repoId}`);
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.flows)).toBe(true);

    const flowId = listResponse.body.flows[0].id as string;
    const downloadResponse = await request(app).get(`/repo-flows/${repoId}/download/${flowId}`);
    expect(downloadResponse.status).toBe(200);
  });
});
