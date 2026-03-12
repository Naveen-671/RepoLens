import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readArtifactJson } from './artifacts';

interface FlowStep {
  nodeId: string;
  summary: string;
}

interface FlowDefinition {
  id: string;
  name: string;
  entryPoint: string;
  steps: FlowStep[];
  score: number;
  file: string;
}

interface GraphFile {
  nodes: Array<{ id: string; summary?: string }>;
  edges: Array<{ source: string; target: string }>;
  clusters: Array<{ name: string; nodes: string[] }>;
}

/**
 * Generates request flow artifacts and returns computed flows.
 */
export async function generateRepoFlows(repoId: string, entryPoint?: string): Promise<FlowDefinition[]> {
  const graph = await readArtifactJson<GraphFile>(repoId, 'graph.json');
  const flowsDir = path.join(getResultDir(repoId), 'flows');
  await fs.mkdir(flowsDir, { recursive: true });

  const candidateEntries = entryPoint ? [entryPoint] : detectEntryPoints(graph);
  const dbTargets = detectDatabaseTargets(graph);
  const summaries = new Map(graph.nodes.map((node) => [node.id, node.summary ?? 'No summary available.']));

  const candidateFlows: FlowDefinition[] = [];

  for (const entry of candidateEntries) {
    for (const target of dbTargets) {
      const pathNodes = findShortestPath(graph.edges, entry, target);
      if (pathNodes.length < 2) {
        continue;
      }

      const score = scorePath(pathNodes, summaries);
      const id = flowId(entry, target);
      const file = `${id}.webm`;
      candidateFlows.push({
        id,
        name: `${entry} -> ${target}`,
        entryPoint: entry,
        score,
        file,
        steps: pathNodes.map((nodeId) => ({
          nodeId,
          summary: summaries.get(nodeId) ?? 'No summary available.',
        })),
      });
    }
  }

  const topFlows = candidateFlows.sort((a, b) => b.score - a.score).slice(0, 3);

  for (const flow of topFlows) {
    if (flow.steps.length <= 20) {
      const outputPath = path.join(flowsDir, flow.file);
      const placeholder = Buffer.from('WEBM_PLACEHOLDER');
      await fs.writeFile(outputPath, placeholder);
    }
  }

  await fs.writeFile(path.join(flowsDir, 'flows.json'), JSON.stringify(topFlows, null, 2), 'utf8');
  return topFlows;
}

/**
 * Returns already generated flow definitions if present.
 */
export async function getRepoFlows(repoId: string): Promise<FlowDefinition[]> {
  const flowsFile = path.join(getResultDir(repoId), 'flows', 'flows.json');
  try {
    const raw = await fs.readFile(flowsFile, 'utf8');
    return JSON.parse(raw) as FlowDefinition[];
  } catch {
    return generateRepoFlows(repoId);
  }
}

/**
 * Resolves a flow video path for download endpoint.
 */
export function resolveFlowDownloadPath(repoId: string, flowId: string): string {
  return path.join(getResultDir(repoId), 'flows', `${flowId}.webm`);
}

/**
 * Detects likely entry files from graph node names.
 */
export function detectEntryPoints(graph: GraphFile): string[] {
  const candidates = graph.nodes
    .map((node) => node.id)
    .filter((id) => /(route|router|pages|server\.listen|app\.use|main|index|api)/i.test(id));

  if (candidates.length > 0) {
    return [...new Set(candidates)].slice(0, 8);
  }

  return graph.nodes.slice(0, 5).map((node) => node.id);
}

/**
 * Detects likely persistence targets using cluster names and file paths.
 */
export function detectDatabaseTargets(graph: GraphFile): string[] {
  const clusterTargets = graph.clusters
    .filter((cluster) => /(db|database|repository|data)/i.test(cluster.name))
    .flatMap((cluster) => cluster.nodes);

  const fileTargets = graph.nodes
    .map((node) => node.id)
    .filter((id) => /(db|database|repository|store|model)/i.test(id));

  const merged = [...new Set([...clusterTargets, ...fileTargets])];
  if (merged.length > 0) {
    return merged.slice(0, 10);
  }

  return graph.nodes.slice(-3).map((node) => node.id);
}

/**
 * Finds shortest directed path between source and target.
 */
export function findShortestPath(
  edges: Array<{ source: string; target: string }>,
  source: string,
  target: string,
): string[] {
  if (source === target) {
    return [source];
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) ?? [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  const queue: string[] = [source];
  const visited = new Set<string>([source]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === target) {
        return buildPath(parent, source, target);
      }
      queue.push(neighbor);
    }
  }

  return [];
}

/**
 * Scores path relevance by service/controller presence and length.
 */
function scorePath(pathNodes: string[], summaries: Map<string, string>): number {
  const joined = pathNodes.map((id) => `${id} ${(summaries.get(id) ?? '').toLowerCase()}`).join(' ');
  const serviceBoost = /(controller|service)/i.test(joined) ? 0.3 : 0;
  const dbBoost = /(db|database|repository)/i.test(joined) ? 0.2 : 0;
  const lengthScore = 1 / Math.max(2, pathNodes.length);
  return Number((serviceBoost + dbBoost + lengthScore).toFixed(4));
}

/**
 * Builds deterministic flow ids.
 */
function flowId(source: string, target: string): string {
  return Buffer.from(`${source}->${target}`, 'utf8').toString('base64url').slice(0, 16);
}

/**
 * Builds path array using parent map.
 */
function buildPath(parent: Map<string, string>, source: string, target: string): string[] {
  const reversed: string[] = [target];
  let cursor = target;

  while (cursor !== source) {
    const next = parent.get(cursor);
    if (!next) {
      return [];
    }
    reversed.push(next);
    cursor = next;
  }

  return reversed.reverse();
}

/**
 * Returns result directory for repository id.
 */
function getResultDir(repoId: string): string {
  return path.resolve(process.cwd(), 'data', 'results', repoId);
}
