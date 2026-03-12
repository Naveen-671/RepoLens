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

/**
 * Renders repository dependency graph with cluster-aware styling.
 */
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
        <h2 className="panel-title">Graph Visualization</h2>
        <span className="graph-count">{graph.nodes.length} nodes</span>
      </div>
      <div className="h-[500px]">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2.2}
          elementsSelectable
          onlyRenderVisibleElements
          nodesDraggable
        >
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
          <Controls />
          <Background color="#94a3b8" gap={20} size={1} />
        </ReactFlow>
      </div>
    </section>
  );
}
