import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzeRepository, type AnalyzeOptions } from '../parser';
import { runAiInference } from '../ai/inference';
import { startServer } from '../server/src/index';

interface CliRunOptions extends AnalyzeOptions {
  noAi?: boolean;
  localRepo?: boolean;
  port?: number;
  startServer?: boolean;
}

export interface CliRunResult {
  artifactPath: string;
  aiArtifactPath: string | null;
  graphArtifactPath: string;
  repoPath: string;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  serverUrl?: string;
  closeServer?: () => Promise<void>;
}

/**
 * Runs the full RepoLens CLI pipeline from parsing through visualization startup.
 */
export async function run(repoUrlOrPath: string, options: CliRunOptions = {}): Promise<CliRunResult> {
  validateInput(repoUrlOrPath, Boolean(options.localRepo));

  process.stdout.write('Analyzing repository...\n\n');
  process.stdout.write('Cloning repo\n');
  const parserResult = await analyzeRepository(repoUrlOrPath, options);

  process.stdout.write(`Parsing ${parserResult.analysis.files.length} files\n`);
  process.stdout.write('Building dependency graph\n');

  if (parserResult.analysis.files.length > 15000) {
    throw new Error('Repository too large for CLI defaults. Please narrow the scope or extension set.');
  }

  const graphArtifactPath = await writeGraphArtifact(parserResult.repoHash, parserResult.analysis.nodes, parserResult.analysis.edges);

  let aiArtifactPath: string | null = null;
  let clusters: Array<{ name: string; files: string[] }> = [];

  if (!options.noAi) {
    process.stdout.write('Generating AI summaries\n');
    process.stdout.write('Detecting architecture\n');
    const aiResult = await runAiInference({
      repoHash: parserResult.repoHash,
      repoPath: parserResult.repoPath,
      analysis: parserResult.analysis,
    });
    aiArtifactPath = aiResult.aiPath;
    clusters = aiResult.artifacts.clusters.map((cluster) => ({
      name: cluster.name,
      files: cluster.files,
    }));
  }

  if (clusters.length > 0) {
    await patchGraphClusters(graphArtifactPath, clusters);
  }

  process.stdout.write('\nAnalysis complete\n\n');

  let closeServer: (() => Promise<void>) | undefined;
  let serverUrl: string | undefined;
  if (options.startServer ?? true) {
    const selectedPort = options.port ?? 3000;
    const server = startServer(selectedPort);
    serverUrl = `http://localhost:${selectedPort}`;
    closeServer = async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    };
    process.stdout.write(`Open visualization:\n${serverUrl}\n`);
  }

  return {
    artifactPath: parserResult.analysisPath,
    aiArtifactPath,
    graphArtifactPath,
    repoPath: parserResult.repoPath,
    fileCount: parserResult.analysis.files.length,
    nodeCount: parserResult.analysis.nodes.length,
    edgeCount: parserResult.analysis.edges.length,
    serverUrl,
    closeServer,
  };
}

/**
 * Parses command-line flags used by the end-to-end CLI orchestrator.
 */
export function parseCliArgs(argv: string[]): { input: string; options: CliRunOptions } {
  const input = argv[0];
  if (!input) {
    throw new Error('Usage: node ./dist/cli/index.js <github-repo-url-or-local-path> [--depth=1] [--extensions=ts,js] [--force] [--port=3000] [--no-ai] [--local-repo]');
  }

  const options: CliRunOptions = {};

  for (const token of argv.slice(1)) {
    if (token.startsWith('--depth=')) {
      const depth = Number(token.split('=')[1]);
      if (!Number.isFinite(depth) || depth <= 0) {
        throw new Error(`Invalid --depth value: ${token}`);
      }
      options.depth = depth;
      continue;
    }

    if (token.startsWith('--extensions=')) {
      const extensionValue = token.split('=')[1] ?? '';
      options.extensions = extensionValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      continue;
    }

    if (token === '--force') {
      options.force = true;
      continue;
    }

    if (token === '--no-ai') {
      options.noAi = true;
      continue;
    }

    if (token === '--local-repo') {
      options.localRepo = true;
      continue;
    }

    if (token.startsWith('--port=')) {
      const rawPort = Number(token.split('=')[1]);
      if (!Number.isInteger(rawPort) || rawPort <= 0 || rawPort > 65535) {
        throw new Error(`Invalid --port value: ${token}`);
      }
      options.port = rawPort;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return { input, options };
}

/**
 * Handles command-line invocation of the RepoLens CLI.
 */
async function main() {
  const { input, options } = parseCliArgs(process.argv.slice(2));

  const result = await run(input, options);
  process.stdout.write(`Artifact written: ${result.artifactPath}\n`);
  if (result.aiArtifactPath) {
    process.stdout.write(`AI artifact written: ${result.aiArtifactPath}\n`);
  }
  process.stdout.write(`Graph artifact written: ${result.graphArtifactPath}\n`);
  process.stdout.write(`Files: ${result.fileCount}, Nodes: ${result.nodeCount}, Edges: ${result.edgeCount}\n`);
}

/**
 * Validates user input before attempting pipeline actions.
 */
function validateInput(input: string, isLocalRepo: boolean): void {
  if (isLocalRepo) {
    return;
  }

  try {
    const parsed = new URL(input);
    if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid repository URL. Pass --local-repo when providing a local folder path.');
  }
}

/**
 * Writes graph JSON artifact for visualization consumers.
 */
async function writeGraphArtifact(
  repoHash: string,
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): Promise<string> {
  const resultDir = path.resolve(process.cwd(), 'data', 'results', repoHash);
  await fs.mkdir(resultDir, { recursive: true });

  const graphArtifactPath = path.join(resultDir, 'graph.json');
  const graphArtifact = {
    nodes,
    edges,
    clusters: [] as Array<{ name: string; nodes: string[] }>,
  };

  await writeJsonAtomic(graphArtifactPath, graphArtifact);
  return graphArtifactPath;
}

/**
 * Attaches AI-inferred clusters to the graph artifact.
 */
async function patchGraphClusters(
  graphArtifactPath: string,
  clusters: Array<{ name: string; files: string[] }>,
): Promise<void> {
  const graph = (await readJsonWithRetry(graphArtifactPath, 3)) as {
    nodes: Array<{ id: string }>;
    edges: Array<{ source: string; target: string }>;
    clusters?: Array<{ name: string; nodes: string[] }>;
  };

  graph.clusters = clusters.map((cluster) => ({
    name: cluster.name,
    nodes: cluster.files,
  }));

  await writeJsonAtomic(graphArtifactPath, graph);
}

/**
 * Writes JSON through a temporary file and rename for atomic updates.
 */
async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value, null, 2);
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, payload, 'utf8');

  try {
    await fs.rename(tempPath, filePath);
  } catch (error: unknown) {
    await fs.writeFile(filePath, payload, 'utf8');
    await fs.rm(tempPath, { force: true });
    if (error instanceof Error && !/EPERM|EEXIST/i.test(error.message)) {
      throw error;
    }
  }
}

/**
 * Reads JSON with brief retries for concurrent file-write windows.
 */
async function readJsonWithRetry(filePath: string, attempts: number): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error: unknown) {
      lastError = error;
      await new Promise<void>((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}