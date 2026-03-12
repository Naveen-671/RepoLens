import type { Edge, Node } from 'reactflow';
import type { RepoCluster, RepoEdge, RepoNode } from './types';

const CLUSTER_PALETTE = ['#0f766e', '#b45309', '#4338ca', '#be123c', '#166534', '#7c2d12', '#1d4ed8'];

/**
 * Builds a deterministic cluster-to-color map.
 */
export function buildClusterColorMap(clusters: RepoCluster[]): Map<string, string> {
  const map = new Map<string, string>();
  const sorted = [...clusters].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((cluster, index) => {
    map.set(cluster.name, CLUSTER_PALETTE[index % CLUSTER_PALETTE.length]);
  });
  return map;
}

/**
 * Converts repository graph data to React Flow nodes and edges.
 */
export function toReactFlowElements(input: {
  nodes: RepoNode[];
  edges: RepoEdge[];
  clusters: RepoCluster[];
  collapseClusters: boolean;
}): { nodes: Node[]; edges: Edge[] } {
  const colorMap = buildClusterColorMap(input.clusters);

  if (input.collapseClusters) {
    return buildCollapsedClusterElements(input.nodes, input.edges, input.clusters, colorMap);
  }

  const sortedNodes = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const nodes: Node[] = sortedNodes.map((node, index) => {
    const clusterColor = node.cluster ? colorMap.get(node.cluster) : '#475569';
    const faded = node.type === 'external';

    return {
      id: node.id,
      position: {
        x: (index % 8) * 240,
        y: Math.floor(index / 8) * 140,
      },
      type: 'default',
      data: {
        label: node.id.split('/').pop(),
        summary: node.summary,
      },
      style: {
        border: `${node.critical ? 3 : 1.5}px solid ${clusterColor ?? '#475569'}`,
        borderRadius: 12,
        background: faded ? '#e2e8f080' : '#f8fafc',
        color: '#0f172a',
        minWidth: 150,
        fontSize: 12,
        boxShadow: node.critical ? '0 0 0 3px rgba(245, 158, 11, 0.35)' : '0 6px 18px rgba(2, 6, 23, 0.08)',
        opacity: faded ? 0.55 : 1,
      },
    };
  });

  const edges: Edge[] = input.edges.map((edge) => {
    const sourceNode = input.nodes.find((node) => node.id === edge.source);
    const targetNode = input.nodes.find((node) => node.id === edge.target);
    const faded = sourceNode?.type === 'external' || targetNode?.type === 'external';

    return {
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      animated: false,
      style: {
        stroke: faded ? '#94a3b8' : '#334155',
        strokeWidth: faded ? 1 : 1.5,
        opacity: faded ? 0.5 : 0.9,
      },
    };
  });

  return {
    nodes,
    edges,
  };
}

/**
 * Builds grouped graph elements where each cluster is collapsed into one node.
 */
function buildCollapsedClusterElements(
  nodes: RepoNode[],
  edges: RepoEdge[],
  clusters: RepoCluster[],
  colorMap: Map<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const clusterByNode = new Map<string, string>();
  for (const cluster of clusters) {
    for (const nodeId of cluster.nodes) {
      clusterByNode.set(nodeId, cluster.name);
    }
  }

  const clusterNames = [...new Set(nodes.map((node) => clusterByNode.get(node.id) ?? 'unclustered'))].sort((a, b) =>
    a.localeCompare(b),
  );

  const collapsedNodes: Node[] = clusterNames.map((clusterName, index) => {
    const clusterSize = nodes.filter((node) => (clusterByNode.get(node.id) ?? 'unclustered') === clusterName).length;
    return {
      id: `cluster:${clusterName}`,
      position: {
        x: (index % 4) * 320,
        y: Math.floor(index / 4) * 220,
      },
      data: {
        label: `${clusterName} (${clusterSize} files)`,
      },
      style: {
        border: `2.5px solid ${colorMap.get(clusterName) ?? '#64748b'}`,
        borderRadius: 16,
        background: '#f8fafc',
        minWidth: 230,
      },
    };
  });

  const dedupe = new Set<string>();
  const collapsedEdges: Edge[] = [];
  for (const edge of edges) {
    const sourceCluster = clusterByNode.get(edge.source) ?? 'unclustered';
    const targetCluster = clusterByNode.get(edge.target) ?? 'unclustered';

    if (sourceCluster === targetCluster) {
      continue;
    }

    const edgeId = `${sourceCluster}->${targetCluster}`;
    if (dedupe.has(edgeId)) {
      continue;
    }

    dedupe.add(edgeId);
    collapsedEdges.push({
      id: edgeId,
      source: `cluster:${sourceCluster}`,
      target: `cluster:${targetCluster}`,
      style: {
        stroke: '#334155',
      },
    });
  }

  return {
    nodes: collapsedNodes,
    edges: collapsedEdges,
  };
}
