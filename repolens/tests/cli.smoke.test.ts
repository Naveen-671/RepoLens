import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli/index';

describe('CLI smoke test', () => {
  it('writes a result artifact for the sample fixture', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const result = await run(fixturePath);

    expect(result.fileCount).toBeGreaterThan(0);
    const raw = await fs.readFile(result.artifactPath, 'utf8');
    const artifact = JSON.parse(raw) as { input: string; files: string[] };

    expect(artifact.input).toBe(fixturePath);
    expect(artifact.files.length).toBeGreaterThan(0);
  });
});