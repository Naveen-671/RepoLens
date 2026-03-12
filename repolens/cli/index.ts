import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

export interface CliRunResult {
  artifactPath: string;
  repoPath: string;
  fileCount: number;
}

/**
 * Runs a local repository scan and writes an initial JSON result artifact.
 */
export async function run(repoUrlOrPath: string): Promise<CliRunResult> {
  const resolvedInput = path.resolve(repoUrlOrPath);
  const stats = await fs.stat(resolvedInput);

  if (!stats.isDirectory()) {
    throw new Error(`Input must be a directory path. Received: ${resolvedInput}`);
  }

  const files = await fg(['**/*'], {
    cwd: resolvedInput,
    onlyFiles: true,
    dot: false,
    ignore: ['node_modules/**', '.git/**', 'dist/**'],
  });

  const hash = createHash('sha256').update(resolvedInput).digest('hex').slice(0, 12);
  const outputDir = path.resolve(process.cwd(), 'data', 'results');
  await fs.mkdir(outputDir, { recursive: true });

  const artifactPath = path.join(outputDir, `${hash}.json`);
  const artifact = {
    input: resolvedInput,
    createdAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');

  return {
    artifactPath,
    repoPath: resolvedInput,
    fileCount: files.length,
  };
}

/**
 * Handles command-line invocation of the RepoLens CLI.
 */
async function main() {
  const input = process.argv[2];
  if (!input) {
    throw new Error('Usage: node ./dist/cli/index.js <github-repo-url-or-local-path>');
  }

  const result = await run(input);
  process.stdout.write(`Artifact written: ${result.artifactPath}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}