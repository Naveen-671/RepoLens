import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../cli/index';
import {
  createRepoPullRequest,
  parsePatchMetadata,
  patchFingerprint,
} from '../server/src/prService';

vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(async () => ({ data: { login: 'tester' } })),
      post: vi.fn(async () => ({ data: { html_url: 'https://github.com/example/repo/pull/1' } })),
    },
  };
});

vi.mock('node:child_process', () => {
  return {
    exec: (command: string, callback: (error: null, output: { stdout: string; stderr: string }) => void) => {
      const stdout = command.includes('git branch --list') ? '* main\n' : '';
      callback(null, { stdout, stderr: '' });
    },
  };
});

describe('auto PR service', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'token-for-tests';
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it('builds deterministic patch metadata and fingerprint', () => {
    const metadata = parsePatchMetadata([
      {
        path: 'README.md',
        patch: ['--- a/README.md', '+++ b/README.md', '@@', '-old', '+new'].join('\n'),
      },
    ]);

    expect(metadata[0].filePath).toBe('README.md');
    expect(metadata[0].addedLines).toBe(1);
    expect(metadata[0].removedLines).toBe(1);
    expect(metadata[0].hunkCount).toBe(1);

    const hashA = patchFingerprint({ path: 'README.md', patch: '+a' });
    const hashB = patchFingerprint({ path: 'README.md', patch: '+a' });
    expect(hashA).toBe(hashB);
  });

  it('blocks secret-like patch content and logs issue', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple-sample');
    const result = await run(fixturePath, { localRepo: true, startServer: false });
    const repoId = path.basename(path.dirname(result.artifactPath));

    await expect(
      createRepoPullRequest(repoId, {
        changes: [
          {
            path: 'README.md',
            patch: '+++ b/README.md\n+const API_KEY="123"',
          },
        ],
        title: 'test auto update',
        body: 'test body',
        requireApproval: true,
      }),
    ).rejects.toThrow(/Blocked secret-like content/i);

    const issueLog = await fs.readFile(path.resolve(process.cwd(), 'data', 'logs', 'pr-issues.log'), 'utf8');
    expect(issueLog).toContain('secret-pattern');
  });
});
