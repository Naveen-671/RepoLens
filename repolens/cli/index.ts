import { analyzeRepository, type AnalyzeOptions } from '../parser';
import { runAiInference } from '../ai/inference';

export interface CliRunResult {
  artifactPath: string;
  aiArtifactPath: string;
  repoPath: string;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Runs repository analysis and writes parser/graph JSON artifacts.
 */
export async function run(repoUrlOrPath: string, options: AnalyzeOptions = {}): Promise<CliRunResult> {
  const parserResult = await analyzeRepository(repoUrlOrPath, options);
  const aiResult = await runAiInference({
    repoHash: parserResult.repoHash,
    repoPath: parserResult.repoPath,
    analysis: parserResult.analysis,
  });

  return {
    artifactPath: parserResult.analysisPath,
    aiArtifactPath: aiResult.aiPath,
    repoPath: parserResult.repoPath,
    fileCount: parserResult.analysis.files.length,
    nodeCount: parserResult.analysis.nodes.length,
    edgeCount: parserResult.analysis.edges.length,
  };
}

/**
 * Parses command-line flags used by the Step 2 parser pipeline.
 */
export function parseCliArgs(argv: string[]): { input: string; options: AnalyzeOptions } {
  const input = argv[0];
  if (!input) {
    throw new Error('Usage: node ./dist/cli/index.js <github-repo-url-or-local-path> [--depth=1] [--extensions=ts,js] [--force]');
  }

  const options: AnalyzeOptions = {};

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
  process.stdout.write(`AI artifact written: ${result.aiArtifactPath}\n`);
  process.stdout.write(`Files: ${result.fileCount}, Nodes: ${result.nodeCount}, Edges: ${result.edgeCount}\n`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}