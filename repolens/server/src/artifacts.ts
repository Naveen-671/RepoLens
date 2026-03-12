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

  // When AI inference wasn't available, infer clusters from directory structure
  if (clusters.length === 0) {
    const dirGroups = new Map<string, string[]>();
    for (const file of analysis.files) {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
      const existing = dirGroups.get(dir);
      if (existing) {
        existing.push(file.path);
      } else {
        dirGroups.set(dir, [file.path]);
      }
    }
    for (const [dir, files] of dirGroups) {
      const clusterName = dir === 'root' ? 'core' : dir.split('/').pop() ?? dir;
      clusters.push({ name: clusterName, nodes: files });
      for (const f of files) { clusterMap.set(f, clusterName); }
    }
  }

  const graph: RepoGraphPayload = {
    nodes: analysis.files.map((file) => {
      const aiSummary = summaryByPath.get(file.path);
      const fileName = file.path.split('/').pop() ?? file.path;
      const fallbackSummary = file.functions.length > 0
        ? `Exports ${file.functions.slice(0, 3).join(', ')}${file.functions.length > 3 ? ` and ${file.functions.length - 3} more` : ''}.`
        : `${fileName} module.`;

      return {
        id: file.path,
        type: 'file' as const,
        summary: aiSummary ?? fallbackSummary,
        functions: file.functions,
        imports: file.imports,
        cluster: clusterMap.get(file.path),
        critical: criticalSet.has(file.path),
      };
    }),
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
