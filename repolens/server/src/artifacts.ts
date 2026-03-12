import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RepoAnalysis } from '../../parser';
import type { AiArtifacts } from '../../ai/inference';

interface CacheEntry<T> {
  updatedAtMs: number;
  value: T;
}

const artifactCache = new Map<string, CacheEntry<unknown>>();

export interface RepoGraphPayload {
  nodes: Array<{ id: string; type: string; summary: string; functions: string[]; imports: string[]; cluster?: string; critical: boolean }>;
  edges: Array<{ source: string; target: string }>;
  clusters: Array<{ name: string; nodes: string[] }>;
}

/**
 * Builds artifact directory path for a given repository id.
 */
export function getResultDir(repoId: string): string {
  return path.resolve(process.cwd(), 'data', 'results', repoId);
}

/**
 * Reads and caches JSON artifacts using mtime-based invalidation.
 */
export async function readArtifactJson<T>(repoId: string, fileName: string): Promise<T> {
  const artifactPath = path.join(getResultDir(repoId), fileName);
  const stat = await fs.stat(artifactPath);
  const cacheKey = `${repoId}:${fileName}`;
  const existing = artifactCache.get(cacheKey);

  if (existing && existing.updatedAtMs === stat.mtimeMs) {
    return existing.value as T;
  }

  const raw = await fs.readFile(artifactPath, 'utf8');
  const parsed = JSON.parse(raw) as T;
  artifactCache.set(cacheKey, {
    updatedAtMs: stat.mtimeMs,
    value: parsed,
  });

  return parsed;
}

/**
 * Writes a graph artifact based on parser and AI outputs.
 */
export async function writeGraphArtifact(
  repoId: string,
  analysis: RepoAnalysis,
  ai: AiArtifacts | null,
): Promise<string> {
  const graphPath = path.join(getResultDir(repoId), 'graph.json');
  await fs.mkdir(path.dirname(graphPath), { recursive: true });

  const summaryByPath = new Map(ai?.fileSummaries.map((item) => [item.path, item.summary]) ?? []);
  const criticalSet = new Set(ai?.criticalFiles.map((item) => item.file) ?? []);
  const clusterMap = new Map<string, string>();

  const clusters = (ai?.clusters ?? []).map((cluster) => {
    cluster.files.forEach((filePath) => clusterMap.set(filePath, cluster.name));
    return { name: cluster.name, nodes: cluster.files };
  });

  const graph: RepoGraphPayload = {
    nodes: analysis.files.map((file) => ({
      id: file.path,
      type: 'file',
      summary: summaryByPath.get(file.path) ?? 'Summary unavailable',
      functions: file.functions,
      imports: file.imports,
      cluster: clusterMap.get(file.path),
      critical: criticalSet.has(file.path),
    })),
    edges: analysis.edges.map((edge) => ({ source: edge.source, target: edge.target })),
    clusters,
  };

  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf8');
  return graphPath;
}

/**
 * Streams graph artifact file content directly to a writable response.
 */
export function streamGraphArtifact(repoId: string) {
  const graphPath = path.join(getResultDir(repoId), 'graph.json');
  return createReadStream(graphPath, { encoding: 'utf8' });
}
