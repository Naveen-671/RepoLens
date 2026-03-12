import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzeRepository } from '../../parser';
import { runAiInference } from '../../ai/inference';
import {
  getResultDir,
  readArtifactJson,
  streamGraphArtifact,
  writeGraphArtifact,
  type RepoGraphPayload,
} from './artifacts';

interface AnalyzeRepoRequest {
  repoUrl: string;
  localRepo?: boolean;
  noAi?: boolean;
  force?: boolean;
}

/**
 * Executes parser and AI pipeline for API-triggered repo analysis.
 */
export async function analyzeRepoFromApi(request: AnalyzeRepoRequest): Promise<{ repoId: string }> {
  if (!request.repoUrl?.trim()) {
    throw new Error('repoUrl is required');
  }

  if (!request.localRepo) {
    validateRemoteRepoUrl(request.repoUrl);
  }

  const parserResult = await analyzeRepository(request.repoUrl, {
    force: request.force,
  });

  const aiResult = request.noAi
    ? null
    : await runAiInference({
        repoHash: parserResult.repoHash,
        repoPath: parserResult.repoPath,
        analysis: parserResult.analysis,
      });

  await writeGraphArtifact(parserResult.repoHash, parserResult.analysis, aiResult?.artifacts ?? null);

  return {
    repoId: parserResult.repoHash,
  };
}

/**
 * Loads graph payload by repository id.
 */
export async function getRepoGraph(repoId: string): Promise<RepoGraphPayload> {
  return readArtifactJson<RepoGraphPayload>(repoId, 'graph.json');
}

/**
 * Loads summary payload by repository id from ai.json.
 */
export async function getRepoSummary(repoId: string): Promise<{
  architectureType: string;
  explanation: string;
  featureClusters: Array<{ name: string; description: string }>;
  criticalFiles: Array<{ file: string; score: number }>;
}> {
  try {
    const ai = await readArtifactJson<{
      architecture: { architectureType: string; briefExplanation: string };
      clusters: Array<{ name: string; description: string }>;
      criticalFiles: Array<{ file: string; score: number }>;
    }>(repoId, 'ai.json');

    return {
      architectureType: ai.architecture.architectureType,
      explanation: ai.architecture.briefExplanation,
      featureClusters: ai.clusters.map((cluster) => ({
        name: cluster.name,
        description: cluster.description,
      })),
      criticalFiles: ai.criticalFiles,
    };
  } catch {
    // Fallback: build summary from graph.json when AI artifacts aren't available
    const graph = await readArtifactJson<RepoGraphPayload>(repoId, 'graph.json');
    const edgeCount = new Map<string, number>();
    for (const edge of graph.edges) {
      edgeCount.set(edge.target, (edgeCount.get(edge.target) ?? 0) + 1);
      edgeCount.set(edge.source, (edgeCount.get(edge.source) ?? 0) + 0.5);
    }
    const ranked = [...edgeCount.entries()].sort((a, b) => b[1] - a[1]);
    const maxScore = ranked[0]?.[1] ?? 1;

    return {
      architectureType: 'layered',
      explanation: `Inferred layered architecture based on import direction from UI-facing files to controller and service files.`,
      featureClusters: graph.clusters.map((c) => ({
        name: c.name,
        description: `${c.nodes.length} file${c.nodes.length !== 1 ? 's' : ''} in the ${c.name} module.`,
      })),
      criticalFiles: ranked.slice(0, 5).map(([file, score]) => ({
        file,
        score: Number((score / maxScore).toFixed(3)),
      })),
    };
  }
}

/**
 * Loads file details payload for a specific file path.
 */
export async function getFileDetails(repoId: string, filePath: string): Promise<{ summary: string; functions: string[]; imports: string[] }> {
  const [analysis, ai] = await Promise.all([
    readArtifactJson<{
      files: Array<{ path: string; functions: string[]; imports: string[] }>;
    }>(repoId, 'analysis.json'),
    readArtifactJson<{
      fileSummaries: Array<{ path: string; summary: string }>;
    }>(repoId, 'ai.json').catch(() => ({ fileSummaries: [] })),
  ]);

  const decodedPath = decodeURIComponent(filePath);
  const analysisFile = analysis.files.find((item) => item.path === decodedPath);
  if (!analysisFile) {
    throw new Error(`File not found in analysis: ${decodedPath}`);
  }

  const summary = ai.fileSummaries.find((item) => item.path === decodedPath)?.summary
    ?? (analysisFile.functions.length > 0
      ? `Exports ${analysisFile.functions.slice(0, 3).join(', ')}${analysisFile.functions.length > 3 ? ` and ${analysisFile.functions.length - 3} more` : ''}.`
      : `${decodedPath.split('/').pop() ?? decodedPath} module.`);
  return {
    summary,
    functions: analysisFile.functions,
    imports: analysisFile.imports,
  };
}

/**
 * Returns true when graph artifact exceeds large-file threshold.
 */
export async function isLargeGraph(repoId: string): Promise<boolean> {
  const graphPath = path.join(getResultDir(repoId), 'graph.json');
  const stat = await fs.stat(graphPath);
  return stat.size > 1024 * 1024;
}

/**
 * Returns stream for graph file responses.
 */
export function getGraphStream(repoId: string) {
  return streamGraphArtifact(repoId);
}

/**
 * Validates remote repository URL values.
 */
function validateRemoteRepoUrl(repoUrl: string): void {
  try {
    const parsed = new URL(repoUrl);
    if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid repo URL. For local folders, pass localRepo=true.');
  }
}
