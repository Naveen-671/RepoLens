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
          answer: 'Authentication logic is primarily handled in src/authController.ts and src/services/authService.ts.',
          sources: [
            {
              path: 'src/authController.ts',
              excerpt: 'export async function loginUser(userId: string): Promise<{ token: string }> {',
            },
          ],
          confidence: 0.88,
        });
      },
      embed: async (text: string) => {
        const containsAuth = text.toLowerCase().includes('auth');
        return containsAuth ? [1, 0, 0.2] : [0.1, 0.1, 0.1];
      },
    }),
  };
});

describe('chat API', () => {
  it('answers auth questions with source paths and excerpts', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const cliResult = await run(fixturePath, {
      localRepo: true,
      startServer: false,
    });
    const repoId = path.basename(path.dirname(cliResult.artifactPath));

    const app = createServer();
    const response = await request(app).post(`/chat/${repoId}`).send({
      query: 'where is authentication?',
      topK: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.answer.toLowerCase()).toContain('auth');
    expect(Array.isArray(response.body.sources)).toBe(true);
    expect(response.body.sources.length).toBeGreaterThan(0);
    expect(response.body.sources[0].path).toContain('authController');
  });
});
