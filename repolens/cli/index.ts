import 'dotenv/config';
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
  autoPr?: boolean;
}

export interface CliRunResult {
  repoId: string;
  artifactPath: string;
  aiArtifactPath: string | null;
  graphArtifactPath: string;
  repoPath: string;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  serverUrl?: string;
  visualizationUrl?: string;
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

  const graphArtifactPath = await writeGraphArtifact(parserResult.repoHash, parserResult.analysis.files, parserResult.analysis.edges);

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
  let visualizationUrl: string | undefined;
  if (options.startServer ?? true) {
    const selectedPort = options.port ?? 3000;
    const server = startServer(selectedPort);
    serverUrl = `http://localhost:${selectedPort}`;
    visualizationUrl = `${serverUrl}/visualization/flow/${parserResult.repoHash}`;
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
    process.stdout.write(`Open visualization:\n${visualizationUrl}\n`);
  }

  if (options.autoPr) {
    process.stdout.write(
      'Auto-PR mode enabled. Use POST /repo-action/:repoId/pr to submit low-risk approved patches.\n',
    );
  }

  return {
    repoId: parserResult.repoHash,
    artifactPath: parserResult.analysisPath,
    aiArtifactPath,
    graphArtifactPath,
    repoPath: parserResult.repoPath,
    fileCount: parserResult.analysis.files.length,
    nodeCount: parserResult.analysis.nodes.length,
    edgeCount: parserResult.analysis.edges.length,
    serverUrl,
    visualizationUrl,
    closeServer,
  };
}

/**
 * Parses command-line flags used by the end-to-end CLI orchestrator.
 */
export function parseCliArgs(argv: string[]): { input: string; options: CliRunOptions } {
  const input = argv[0];
  if (!input) {
    throw new Error('Usage: node ./dist/cli/index.js <github-repo-url-or-local-path> [--depth=1] [--extensions=ts,js] [--force] [--port=3000] [--no-ai] [--local-repo] [--auto-pr]');
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

    if (token === '--auto-pr') {
      options.autoPr = true;
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
  if (result.visualizationUrl) {
    process.stdout.write(`Visualization URL: ${result.visualizationUrl}\n`);
  }
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
  files: Array<{ path: string; functions: string[]; imports: string[]; classes: string[]; interfaces?: string[]; linesOfCode?: number; complexity?: number; commentLines?: number; exports: string[] }>,
  edges: Array<{ source: string; target: string }>,
): Promise<string> {
  const resultDir = path.resolve(process.cwd(), 'data', 'results', repoHash);
  await fs.mkdir(resultDir, { recursive: true });

  const graphArtifactPath = path.join(resultDir, 'graph.json');

  // Infer clusters from directory structure
  const dirGroups = new Map<string, string[]>();
  for (const file of files) {
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    const existing = dirGroups.get(dir);
    if (existing) { existing.push(file.path); } else { dirGroups.set(dir, [file.path]); }
  }
  const clusterMap = new Map<string, string>();
  const clusters: Array<{ name: string; nodes: string[] }> = [];
  for (const [dir, filePaths] of dirGroups) {
    const name = dir === 'root' ? 'core' : dir.split('/').pop() ?? dir;
    clusters.push({ name, nodes: filePaths });
    for (const fp of filePaths) { clusterMap.set(fp, name); }
  }

  // Compute criticality from edge connections
  const edgeCount = new Map<string, number>();
  for (const edge of edges) {
    edgeCount.set(edge.target, (edgeCount.get(edge.target) ?? 0) + 1);
    edgeCount.set(edge.source, (edgeCount.get(edge.source) ?? 0) + 0.5);
  }
  const maxConnections = Math.max(...edgeCount.values(), 1);

  const nodes = files.map((file) => {
    const loc = file.linesOfCode ?? 0;
    const complexity = file.complexity ?? 1;
    const commentRatio = loc > 0 ? (file.commentLines ?? 0) / loc : 0;
    const sizePenalty = loc > 500 ? Math.min(0.3, (loc - 500) / 2000) : 0;
    const complexityPenalty = complexity > 15 ? Math.min(0.3, (complexity - 15) / 50) : 0;
    const commentBonus = Math.min(0.1, commentRatio * 0.5);
    const exportBonus = file.exports.length > 0 ? 0.05 : 0;
    const structureBonus = (file.functions.length + file.classes.length) > 0 ? 0.05 : 0;
    const healthScore = Number(Math.max(0, Math.min(1,
      1 - sizePenalty - complexityPenalty + commentBonus + exportBonus + structureBonus
    )).toFixed(2));

    return {
      id: file.path,
      type: 'file',
      summary: file.functions.length > 0
        ? `Exports ${file.functions.slice(0, 3).join(', ')}${file.functions.length > 3 ? ` and ${file.functions.length - 3} more` : ''}.`
        : `${(file.path.split('/').pop() ?? file.path)} module.`,
      functions: file.functions,
      imports: file.imports,
      classes: file.classes,
      interfaces: file.interfaces ?? [],
      cluster: clusterMap.get(file.path),
      critical: (edgeCount.get(file.path) ?? 0) / maxConnections > 0.5,
      linesOfCode: loc,
      complexity,
      healthScore,
    };
  });

  // Repo-wide metrics
  const totalLinesOfCode = files.reduce((sum, f) => sum + (f.linesOfCode ?? 0), 0);
  const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
  const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
  const totalInterfaces = files.reduce((sum, f) => sum + (f.interfaces?.length ?? 0), 0);
  const avgComplexity = files.length > 0
    ? files.reduce((sum, f) => sum + (f.complexity ?? 1), 0) / files.length : 1;
  const avgHealthScore = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + n.healthScore, 0) / nodes.length : 0.5;

  const complexityHotspots = [...files]
    .sort((a, b) => (b.complexity ?? 1) - (a.complexity ?? 1))
    .slice(0, 10)
    .map((f) => ({ file: f.path, complexity: f.complexity ?? 1 }));
  const largestFiles = [...files]
    .sort((a, b) => (b.linesOfCode ?? 0) - (a.linesOfCode ?? 0))
    .slice(0, 10)
    .map((f) => ({ file: f.path, lines: f.linesOfCode ?? 0 }));

  const graphArtifact = {
    nodes,
    edges,
    clusters,
    repoMetrics: {
      totalFiles: files.length,
      totalLinesOfCode,
      totalFunctions,
      totalClasses,
      totalInterfaces,
      avgComplexity: Number(avgComplexity.toFixed(1)),
      avgHealthScore: Number(avgHealthScore.toFixed(2)),
      complexityHotspots,
      largestFiles,
    },
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
    nodes: Array<{ id: string; cluster?: string }>;
    edges: Array<{ source: string; target: string }>;
    clusters?: Array<{ name: string; nodes: string[] }>;
  };

  const clusterMap = new Map<string, string>();
  graph.clusters = clusters.map((cluster) => {
    for (const f of cluster.files) { clusterMap.set(f, cluster.name); }
    return { name: cluster.name, nodes: cluster.files };
  });

  // Also update per-node cluster assignments
  for (const node of graph.nodes) {
    const assigned = clusterMap.get(node.id);
    if (assigned) { node.cluster = assigned; }
  }

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