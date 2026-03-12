import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { run } from '../cli/index';
import { findShortestPath, generateRepoFlows } from '../server/src/flowService';

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

describe('flow service', () => {
  it('computes shortest directed path', () => {
    const pathResult = findShortestPath(
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'a', target: 'd' },
      ],
      'a',
      'c',
    );

    expect(pathResult).toEqual(['a', 'b', 'c']);
  });

  it('extracts flow steps for sample repository artifacts', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const cliResult = await run(fixturePath, {
      localRepo: true,
      startServer: false,
    });

    const repoId = path.basename(path.dirname(cliResult.artifactPath));
    const flows = await generateRepoFlows(repoId);

    expect(flows.length).toBeGreaterThan(0);
    expect(flows[0].steps.length).toBeGreaterThan(1);
    expect(flows[0].steps[0].nodeId).toBeTruthy();
  });
});
