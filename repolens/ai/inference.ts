import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AnalysisEdge, RepoAnalysis } from '../parser';
import { createAiProvider, type AiProvider } from './providers';

export interface FileSummary {
  path: string;
  summary: string;
  features: string[];
}

export interface FeatureCluster {
  name: string;
  description: string;
  representativeFile: string;
  files: string[];
}

export interface ArchitectureResult {
  architectureType: string;
  briefExplanation: string;
  mainLayers: string[];
  sampleRequestFlow: string[];
}

export interface CriticalFileScore {
  file: string;
  score: number;
}

export interface AiArtifacts {
  fileSummaries: FileSummary[];
  clusters: FeatureCluster[];
  architecture: ArchitectureResult;
  criticalFiles: CriticalFileScore[];
  errors?: string[];
}

export interface AiInferenceInput {
  repoHash: string;
  repoPath: string;
  analysis: RepoAnalysis;
}

/**
 * Produces AI artifacts from parser analysis and writes ai.json.
 */
export async function runAiInference(
  input: AiInferenceInput,
  provider: AiProvider = createAiProvider(),
): Promise<{ aiPath: string; artifacts: AiArtifacts }> {
  const resultDir = path.resolve(process.cwd(), 'data', 'results', input.repoHash);
  const aiPath = path.join(resultDir, 'ai.json');
  await fs.mkdir(resultDir, { recursive: true });

  const errors: string[] = [];

  const summaries = await summarizeFiles(input, provider, errors);
  const clusters = await buildFeatureClusters(summaries, provider, errors);
  const architecture = await inferArchitecture(summaries, input.analysis.edges, provider, errors);
  const criticalFiles = rankCriticalFiles(input.analysis, summaries);

  const artifacts: AiArtifacts = {
    fileSummaries: summaries,
    clusters,
    architecture,
    criticalFiles,
  };

  if (errors.length > 0) {
    artifacts.errors = errors;
  }

  await fs.writeFile(aiPath, JSON.stringify(artifacts, null, 2), 'utf8');
  return { aiPath, artifacts };
}

/**
 * Supports optional semantic search across file summaries.
 */
export async function semanticSearchFiles(
  query: string,
  artifacts: AiArtifacts,
  provider: AiProvider = createAiProvider(),
): Promise<Array<{ path: string; score: number }>> {
  try {
    const queryEmbedding = await provider.embed(query);
    if (queryEmbedding.length === 0) {
      return [];
    }

    const scored = await Promise.all(
      artifacts.fileSummaries.map(async (summary) => {
        const embedding = await provider.embed(`${summary.path}: ${summary.summary}`);
        return {
          path: summary.path,
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      }),
    );

    return scored.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

/**
 * Builds per-file summaries from compact metadata payload only.
 */
async function summarizeFiles(
  input: AiInferenceInput,
  provider: AiProvider,
  errors: string[],
): Promise<FileSummary[]> {
  const summaries = await Promise.all(
    input.analysis.files.map(async (file) => {
      const comments = await extractTopComments(path.join(input.repoPath, file.path));
      const prompt = buildFileSummaryPrompt({
        filename: path.basename(file.path),
        imports: file.imports.slice(0, 20),
        exports: file.exports,
        functions: file.functions,
        comments,
      });

      try {
        const completion = await provider.generate(prompt, { maxTokens: 300, temperature: 0.1 });
        const json = parseJsonFromText<{ summary: string; likely_features: string[] }>(completion);
        return {
          path: file.path,
          summary: json?.summary?.trim() || `Handles ${file.path} responsibilities.`,
          features: Array.isArray(json?.likely_features)
            ? json.likely_features.filter(Boolean)
            : inferFeatureHints(file.path, comments),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`summary:${file.path}:${message}`);
        return {
          path: file.path,
          summary: `Handles ${file.path} responsibilities.`,
          features: inferFeatureHints(file.path, comments),
        };
      }
    }),
  );

  return summaries.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Creates clusters and labels them with AI feature mapping prompts in 20-file chunks.
 */
async function buildFeatureClusters(
  summaries: FileSummary[],
  provider: AiProvider,
  errors: string[],
): Promise<FeatureCluster[]> {
  const grouped = new Map<string, FileSummary[]>();

  for (const summary of summaries) {
    const guessedFeature = summary.features[0] ?? deriveFeatureFromPath(summary.path);
    const key = guessedFeature.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(summary);
  }

  const clusters = [...grouped.entries()].map(([name, files]) => ({
    name,
    files,
  }));

  const labeledClusters: FeatureCluster[] = [];
  for (const chunk of chunkArray(clusters, 20)) {
    const promptInput = chunk.map((cluster) => ({
      clusterName: cluster.name,
      files: cluster.files.map((file) => ({ path: file.path, summary: file.summary })),
    }));

    const prompt = [
      'Given clusters of files, produce a human-friendly feature label and 1-line description for each cluster.',
      'Input: cluster files with summaries.',
      'Output array: [{clusterName, description, representativeFile}]',
      JSON.stringify(promptInput),
    ].join('\n');

    try {
      const completion = await provider.generate(prompt, { maxTokens: 500, temperature: 0.2 });
      const mapped =
        parseJsonFromText<Array<{ clusterName: string; description: string; representativeFile: string }>>(
          completion,
        ) ?? [];

      for (const cluster of chunk) {
        const mappedCluster = mapped.find(
          (item) => item.clusterName?.toLowerCase() === cluster.name.toLowerCase(),
        );
        labeledClusters.push({
          name: mappedCluster?.clusterName || cluster.name,
          description: mappedCluster?.description || `Feature cluster for ${cluster.name}.`,
          representativeFile: mappedCluster?.representativeFile || cluster.files[0].path,
          files: cluster.files.map((file) => file.path),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`feature-mapping:${message}`);
      for (const cluster of chunk) {
        labeledClusters.push({
          name: cluster.name,
          description: `Feature cluster for ${cluster.name}.`,
          representativeFile: cluster.files[0].path,
          files: cluster.files.map((file) => file.path),
        });
      }
    }
  }

  return labeledClusters.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Infers architecture style and request flow using chunked summaries.
 */
async function inferArchitecture(
  summaries: FileSummary[],
  edges: AnalysisEdge[],
  provider: AiProvider,
  errors: string[],
): Promise<ArchitectureResult> {
  const summaryInput = chunkArray(summaries, 20).map((chunk) =>
    chunk.map((item) => ({ path: item.path, summary: item.summary, features: item.features })),
  );

  const prompt = [
    'You are a system architect. Given these file summaries and the dependency edges, infer the overall architecture style (choose from: MVC, layered, microservices, hexagonal, monolith) and produce:',
    '- architectureType: string',
    '- briefExplanation: 2-3 sentences',
    '- mainLayers: ordered list (e.g., ["frontend","api","services","database"])',
    '- sampleRequestFlow: a short flow using filenames (3-6 steps)',
    '',
    `Input: ${JSON.stringify({ summaries: summaryInput, edges })}`,
    'Output JSON as described.',
  ].join('\n');

  try {
    const completion = await provider.generate(prompt, { maxTokens: 900, temperature: 0.2 });
    const json = parseJsonFromText<ArchitectureResult>(completion);
    return {
      architectureType: json?.architectureType || 'layered',
      briefExplanation:
        json?.briefExplanation ||
        'The project follows a layered structure where request-facing files depend on service helpers.',
      mainLayers: Array.isArray(json?.mainLayers) ? json.mainLayers : ['frontend', 'api', 'services'],
      sampleRequestFlow:
        Array.isArray(json?.sampleRequestFlow) && json.sampleRequestFlow.length > 0
          ? json.sampleRequestFlow
          : edges.slice(0, 4).map((edge) => `${edge.source} -> ${edge.target}`),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`architecture:${message}`);
    return {
      architectureType: 'layered',
      briefExplanation:
        'Inferred layered architecture based on import direction from UI-facing files to controller and service files.',
      mainLayers: ['frontend', 'api', 'services'],
      sampleRequestFlow: edges.slice(0, 4).map((edge) => `${edge.source} -> ${edge.target}`),
    };
  }
}

/**
 * Computes top critical files using graph centrality and heuristics.
 */
function rankCriticalFiles(analysis: RepoAnalysis, summaries: FileSummary[]): CriticalFileScore[] {
  const nodes = analysis.nodes.map((node) => node.id);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const node of nodes) {
    incoming.set(node, 0);
    outgoing.set(node, 0);
  }

  for (const edge of analysis.edges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node, (incoming.get(node) ?? 0) + (outgoing.get(node) ?? 0));
  }

  const betweenness = computeBetweennessCentrality(nodes, analysis.edges);
  const maxDegree = Math.max(1, ...degree.values());
  const maxBetweenness = Math.max(1, ...betweenness.values());

  const summaryMap = new Map(summaries.map((item) => [item.path, item.summary]));

  const ranked = nodes.map((file) => {
    const degreeNorm = (degree.get(file) ?? 0) / maxDegree;
    const betweenNorm = (betweenness.get(file) ?? 0) / maxBetweenness;
    const inDegree = incoming.get(file) ?? 0;

    const summaryText = (summaryMap.get(file) ?? '').toLowerCase();
    const fileName = path.basename(file).toLowerCase();

    const heuristicBoost =
      (inDegree > 1 ? 0.1 : 0) +
      (/(service|controller)/.test(fileName) ? 0.1 : 0) +
      (/(service|controller)/.test(summaryText) ? 0.1 : 0);

    const score = Math.min(1, degreeNorm * 0.45 + betweenNorm * 0.35 + heuristicBoost + inDegree * 0.05);
    return {
      file,
      score: Number(score.toFixed(4)),
    };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => ({ file: item.file, score: item.score }));
}

/**
 * Extracts up to three top comment lines from the file.
 */
async function extractTopComments(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const comments: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        comments.push(trimmed.replace(/^\/\/?\s?/, '').replace(/^#\s?/, '').replace(/^\*\s?/, ''));
      }
      if (comments.length >= 3) {
        break;
      }
      if (trimmed && comments.length === 0 && !trimmed.startsWith('//')) {
        break;
      }
    }
    return comments;
  } catch {
    return [];
  }
}

/**
 * Creates the exact file-summary prompt template with compact metadata.
 */
function buildFileSummaryPrompt(input: {
  filename: string;
  imports: string[];
  exports: string[];
  functions: string[];
  comments: string[];
}): string {
  return [
    'You are an expert senior engineer. Given compact file metadata, produce a single concise sentence describing the file\'s responsibility and a 1-line list of probable features it belongs to.',
    '',
    `File: ${input.filename}`,
    `Imports: ${truncateList(input.imports, 20).join(', ')}`,
    `Exports: ${truncateList(input.exports, 20).join(', ')}`,
    `Functions: ${truncateList(input.functions, 20).join(', ')}`,
    `Top comments: ${truncateList(input.comments, 3).join(' | ')}`,
    '',
    'Output JSON:',
    '{"summary":"...", "likely_features":["auth","api","db"]}',
  ].join('\n');
}

/**
 * Parses JSON object or array from a text response.
 */
function parseJsonFromText<T>(text: string): T | null {
  const firstObject = text.indexOf('{');
  const firstArray = text.indexOf('[');
  const start = [firstObject, firstArray].filter((value) => value >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) {
    return null;
  }

  const endObject = text.lastIndexOf('}');
  const endArray = text.lastIndexOf(']');
  const end = Math.max(endObject, endArray);
  if (end < start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Returns a sliced list constrained by token-friendly limits.
 */
function truncateList(items: string[], limit: number): string[] {
  return items.filter(Boolean).slice(0, limit);
}

/**
 * Builds chunks of fixed size.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Infer fallback feature hints from path and comments.
 */
function inferFeatureHints(filePath: string, comments: string[]): string[] {
  const text = `${filePath} ${comments.join(' ')}`.toLowerCase();
  const hints = ['auth', 'api', 'service', 'db', 'ui'].filter((name) => text.includes(name));
  return hints.length > 0 ? hints : [deriveFeatureFromPath(filePath)];
}

/**
 * Derives a rough feature name from path segments.
 */
function deriveFeatureFromPath(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2].toLowerCase();
  }
  return 'core';
}

/**
 * Computes cosine similarity between vectors.
 */
function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/**
 * Computes directed graph betweenness centrality using Brandes' algorithm.
 */
function computeBetweennessCentrality(nodes: string[], edges: AnalysisEdge[]): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const centrality = new Map<string, number>(nodes.map((node) => [node, 0]));

  for (const source of nodes) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(nodes.map((node) => [node, []]));
    const sigma = new Map<string, number>(nodes.map((node) => [node, 0]));
    const distance = new Map<string, number>(nodes.map((node) => [node, -1]));

    sigma.set(source, 1);
    distance.set(source, 0);

    const queue: string[] = [source];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      stack.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if ((distance.get(neighbor) ?? -1) < 0) {
          queue.push(neighbor);
          distance.set(neighbor, (distance.get(current) ?? 0) + 1);
        }

        if ((distance.get(neighbor) ?? -1) === (distance.get(current) ?? 0) + 1) {
          sigma.set(neighbor, (sigma.get(neighbor) ?? 0) + (sigma.get(current) ?? 0));
          predecessors.get(neighbor)?.push(current);
        }
      }
    }

    const dependency = new Map<string, number>(nodes.map((node) => [node, 0]));
    while (stack.length > 0) {
      const node = stack.pop() as string;
      for (const predecessor of predecessors.get(node) ?? []) {
        const ratio = (sigma.get(predecessor) ?? 0) / Math.max(1, sigma.get(node) ?? 1);
        const updated = (dependency.get(predecessor) ?? 0) + ratio * (1 + (dependency.get(node) ?? 0));
        dependency.set(predecessor, updated);
      }
      if (node !== source) {
        centrality.set(node, (centrality.get(node) ?? 0) + (dependency.get(node) ?? 0));
      }
    }
  }

  return centrality;
}
