import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { toReactFlowElements } from '../graph';
import type { RepoCluster, RepoEdge, RepoNode } from '../types';

interface GraphViewProps {
  nodes: RepoNode[];
  edges: RepoEdge[];
  clusters: RepoCluster[];
  collapseClusters: boolean;
  onNodeClick: (nodeId: string) => void;
}

export function GraphView({ nodes, edges, clusters, collapseClusters, onNodeClick }: GraphViewProps) {
  const graph = useMemo(
    () => toReactFlowElements({ nodes, edges, clusters, collapseClusters }),
    [nodes, edges, clusters, collapseClusters],
  );

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onNodeClick(node.id);
  };

  return (
    <section className="panel p-0 overflow-hidden" aria-label="graph-view-panel">
      <div className="graph-header">
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-indigo)', marginRight: '0.4rem' }}>◈</span>
          Dependency Graph
        </h2>
        <span className="stat-badge stat-badge--indigo">{graph.nodes.length} nodes</span>
      </div>
      <div style={{ height: 520 }}>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.15}
          maxZoom={2.5}
          elementsSelectable
          onlyRenderVisibleElements
          nodesDraggable
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            nodeColor={() => '#818cf8'}
            maskColor="rgba(11,15,26,0.7)"
          />
          <Controls />
          <Background color="#1e293b" gap={24} size={1} />
        </ReactFlow>
      </div>
    </section>
  );
}
