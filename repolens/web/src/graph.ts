import type { Edge, Node } from 'reactflow';
import type { RepoCluster, RepoEdge, RepoNode } from './types';

const CLUSTER_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#22d3ee',
  '#a78bfa', '#f472b6', '#38bdf8', '#4ade80', '#facc15',
];

export function buildClusterColorMap(clusters: RepoCluster[]): Map<string, string> {
  const map = new Map<string, string>();
  const sorted = [...clusters].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach((cluster, index) => {
    map.set(cluster.name, CLUSTER_PALETTE[index % CLUSTER_PALETTE.length]);
  });
  return map;
}

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
    const clusterColor = node.cluster ? colorMap.get(node.cluster) ?? '#64748b' : '#64748b';
    const faded = node.type === 'external';
    const isCritical = node.critical === true;

    return {
      id: node.id,
      position: {
        x: (index % 6) * 260 + (Math.floor(index / 6) % 2) * 130,
        y: Math.floor(index / 6) * 160,
      },
      type: 'default',
      data: {
        label: node.id.split('/').pop(),
        summary: node.summary,
      },
      style: {
        border: `${isCritical ? 2 : 1}px solid ${clusterColor}`,
        borderRadius: 12,
        background: faded ? 'rgba(30,41,59,0.5)' : 'rgba(17,24,39,0.9)',
        color: '#f1f5f9',
        minWidth: 160,
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: isCritical ? 600 : 400,
        padding: '10px 14px',
        boxShadow: isCritical
          ? `0 0 20px ${clusterColor}33, 0 4px 16px rgba(0,0,0,0.4)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        opacity: faded ? 0.5 : 1,
      },
    };
  });

  const edges: Edge[] = input.edges.map((edge) => {
    const sourceNode = input.nodes.find((n) => n.id === edge.source);
    const targetNode = input.nodes.find((n) => n.id === edge.target);
    const faded = sourceNode?.type === 'external' || targetNode?.type === 'external';
    const sourceColor = sourceNode?.cluster ? colorMap.get(sourceNode.cluster) ?? '#64748b' : '#64748b';

    return {
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      animated: !faded,
      style: {
        stroke: faded ? '#475569' : sourceColor,
        strokeWidth: faded ? 1 : 2,
        opacity: faded ? 0.4 : 0.7,
      },
    };
  });

  return { nodes, edges };
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
        border: `2px solid ${colorMap.get(clusterName) ?? '#64748b'}`,
        borderRadius: 16,
        background: 'rgba(17,24,39,0.9)',
        color: '#f1f5f9',
        minWidth: 230,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        boxShadow: `0 0 24px ${(colorMap.get(clusterName) ?? '#64748b')}22, 0 4px 16px rgba(0,0,0,0.3)`,
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
      animated: true,
      style: {
        stroke: colorMap.get(sourceCluster) ?? '#64748b',
        strokeWidth: 2,
        opacity: 0.6,
      },
    });
  }

  return {
    nodes: collapsedNodes,
    edges: collapsedEdges,
  };
}
