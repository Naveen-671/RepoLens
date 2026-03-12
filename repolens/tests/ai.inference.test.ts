import { promises as fs } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeRepository } from '../parser';
import { runAiInference } from '../ai/inference';

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

        if (prompt.includes('Output JSON only.')) {
          return JSON.stringify({
            purpose: 'A sample authentication app.',
            techStack: ['TypeScript', 'React'],
            entryPoints: ['src/loginForm.tsx'],
            directoryPurposes: [{ directory: 'src/', purpose: 'Application source code' }],
            keyInsights: ['Simple layered architecture'],
          });
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

describe('ai inference', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('writes ai.json with summaries, clusters, architecture, and critical files', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const analysisResult = await analyzeRepository(fixturePath, {
      extensions: ['ts', 'tsx'],
      force: true,
    });

    const aiResult = await runAiInference({
      repoHash: analysisResult.repoHash,
      repoPath: analysisResult.repoPath,
      analysis: analysisResult.analysis,
    });

    const raw = await fs.readFile(aiResult.aiPath, 'utf8');
    const aiJson = JSON.parse(raw) as {
      fileSummaries: Array<{ path: string; summary: string; features: string[] }>;
      clusters: Array<{ name: string }>;
      architecture: { architectureType: string };
      criticalFiles: Array<{ file: string; score: number }>;
      repoOverview?: { purpose: string; techStack: string[] };
    };

    expect(aiJson.fileSummaries).toHaveLength(3);
    expect(aiJson.fileSummaries.every((item) => item.summary.length > 0)).toBe(true);
    expect(aiJson.clusters.some((cluster) => cluster.name.toLowerCase().includes('auth'))).toBe(true);
    expect(aiJson.architecture.architectureType.length).toBeGreaterThan(0);
    expect(['layered', 'monolith', 'mvc', 'microservices', 'hexagonal']).toContain(
      aiJson.architecture.architectureType.toLowerCase(),
    );
    expect(aiJson.criticalFiles.length).toBeGreaterThan(0);
    expect(aiJson.criticalFiles[0].score).toBeGreaterThanOrEqual(0);
    expect(aiJson.criticalFiles[0].score).toBeLessThanOrEqual(1);

    // Verify repoOverview is included
    expect(aiJson.repoOverview).toBeDefined();
    expect(aiJson.repoOverview!.purpose.length).toBeGreaterThan(0);
  }, 15000);
});
