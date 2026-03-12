import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { run } from '../cli/index';

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

describe('CLI smoke test', () => {
  it('writes a result artifact for the sample fixture', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const result = await run(fixturePath);

    expect(result.fileCount).toBeGreaterThan(0);
    const raw = await fs.readFile(result.artifactPath, 'utf8');
    const artifact = JSON.parse(raw) as { repo: string; files: Array<{ path: string }> };

    expect(artifact.repo).toBe(fixturePath);
    expect(artifact.files.length).toBeGreaterThan(0);
  });
});