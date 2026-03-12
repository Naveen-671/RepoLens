import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeRepository } from '../parser';

describe('parser + dependency graph', () => {
  it('builds analysis.json with expected nodes and edges for sample fixture', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const result = await analyzeRepository(fixturePath, {
      extensions: ['ts', 'tsx'],
      force: true,
    });

    const analysisRaw = await fs.readFile(result.analysisPath, 'utf8');
    const analysis = JSON.parse(analysisRaw) as {
      files: Array<{ path: string; imports: string[]; functions: string[] }>;
      nodes: Array<{ id: string }>;
      edges: Array<{ source: string; target: string; type: string }>;
    };

    expect(analysis.nodes).toHaveLength(3);
    expect(analysis.edges).toHaveLength(2);

    const authController = analysis.files.find((file) => file.path === 'src/authController.ts');
    expect(authController).toBeTruthy();
    expect(authController?.functions).toContain('loginUser');
    expect(authController?.imports).toContain('./services/authService');

    const hasEdgeFromLogin = analysis.edges.some(
      (edge) =>
        edge.source === 'src/loginForm.tsx' &&
        edge.target === 'src/authController.ts' &&
        edge.type === 'import',
    );
    const hasEdgeToService = analysis.edges.some(
      (edge) =>
        edge.source === 'src/authController.ts' &&
        edge.target === 'src/services/authService.ts' &&
        edge.type === 'import',
    );

    expect(hasEdgeFromLogin).toBe(true);
    expect(hasEdgeToService).toBe(true);
  });
});