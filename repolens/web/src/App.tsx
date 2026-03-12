import React, { useEffect, useMemo, useState } from 'react';
import { loadRepoUiData } from './api';
import { ChatPanel } from './components/ChatPanel';
import { FileDetailsPanel } from './components/FileDetailsPanel';
import { FlowPanel } from './components/FlowPanel';
import { GraphView } from './components/GraphView';
import { RepoSummaryPanel } from './components/RepoSummaryPanel';
import type { RepoUiData } from './types';

/**
 * Renders the frontend repository visualization workspace.
 */
export default function App() {
  const routeRepoId = useMemo(() => {
    const match = window.location.pathname.match(/^\/visualization\/flow\/([^/]+)$/);
    return match?.[1] ?? 'sample';
  }, []);

  const [repoData, setRepoData] = useState<RepoUiData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapseClusters, setCollapseClusters] = useState(false);

  useEffect(() => {
    void loadRepoUiData(routeRepoId).then((data) => {
      setRepoData(data);
      setSelectedNodeId(data.graph.nodes[0]?.id ?? null);
    });
  }, [routeRepoId]);

  const selectedNode = useMemo(() => {
    if (!repoData || !selectedNodeId) {
      return null;
    }
    return repoData.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [repoData, selectedNodeId]);

  if (!repoData) {
    return (
      <main className="page-shell">
        <div className="loading-card">
          <h1 className="text-2xl font-semibold">RepoLens</h1>
          <p className="mt-2 text-slate-600">Loading repository visualization...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="brand-title">RepoLens</h1>
          <p className="brand-subtitle">Architecture at a glance for fast engineering decisions</p>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={collapseClusters}
            onChange={(event) => setCollapseClusters(event.target.checked)}
          />
          <span>Collapse clusters</span>
        </label>
      </header>

      <section className="layout-grid" aria-label="repo-layout-grid">
        <RepoSummaryPanel summary={repoData.summary} />
        <GraphView
          nodes={repoData.graph.nodes}
          edges={repoData.graph.edges}
          clusters={repoData.graph.clusters}
          collapseClusters={collapseClusters}
          onNodeClick={setSelectedNodeId}
        />
      </section>

      <FileDetailsPanel selectedNode={selectedNode} />
      <FlowPanel repoId={routeRepoId} onStepNodeChange={setSelectedNodeId} />
      <ChatPanel
        repoId={routeRepoId}
        onOpenFile={(filePath) => {
          setSelectedNodeId(filePath);
        }}
      />
    </main>
  );
}