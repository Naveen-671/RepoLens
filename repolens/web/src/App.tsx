import React, { useEffect, useMemo, useState } from 'react';
import { loadRepoUiData } from './api';
import { ChatPanel } from './components/ChatPanel';
import { FileDetailsPanel } from './components/FileDetailsPanel';
import { FlowPanel } from './components/FlowPanel';
import { GraphView } from './components/GraphView';
import { RepoSummaryPanel } from './components/RepoSummaryPanel';
import type { RepoUiData } from './types';

export default function App() {
  const routeRepoId = useMemo(() => {
    const match = window.location.pathname.match(/^\/visualization\/flow\/([^/]+)$/);
    return match?.[1] ?? 'sample';
  }, []);

  const [repoData, setRepoData] = useState<RepoUiData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapseClusters, setCollapseClusters] = useState(false);
  const [activeTab, setActiveTab] = useState<'graph' | 'flow' | 'chat'>('graph');

  useEffect(() => {
    void loadRepoUiData(routeRepoId).then((data) => {
      setRepoData(data);
      setSelectedNodeId(data.graph.nodes[0]?.id ?? null);
    });
  }, [routeRepoId]);

  const selectedNode = useMemo(() => {
    if (!repoData || !selectedNodeId) return null;
    return repoData.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [repoData, selectedNodeId]);

  if (!repoData) {
    return (
      <main className="page-shell">
        <div className="loading-card animate-pulse-glow">
          <div className="spinner" />
          <h1 className="brand-title mt-6" style={{ textAlign: 'center' }}>RepoLens</h1>
          <p className="mt-3" style={{ color: 'var(--ink-muted)', textAlign: 'center' }}>Analyzing repository architecture...</p>
        </div>
      </main>
    );
  }

  const tabs = [
    { key: 'graph' as const, label: 'Architecture', icon: '◈' },
    { key: 'flow' as const, label: 'Request Flows', icon: '▸' },
    { key: 'chat' as const, label: 'Ask AI', icon: '◎' },
  ];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="brand-title">RepoLens</h1>
          <p className="brand-subtitle">Architecture at a glance for fast engineering decisions</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <span className="stat-badge stat-badge--indigo">{repoData.graph.nodes.length} files</span>
            <span className="stat-badge stat-badge--emerald">{repoData.graph.edges.length} deps</span>
            <span className="stat-badge stat-badge--violet">{repoData.summary.featureClusters.length} clusters</span>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={collapseClusters}
              onChange={(event) => setCollapseClusters(event.target.checked)}
            />
            <span>Collapse</span>
          </label>
        </div>
      </header>

      {/* Tab Bar */}
      <nav style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1.25rem',
        padding: '0.25rem',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        width: 'fit-content',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms',
              background: activeTab === tab.key ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent-indigo)' : 'var(--ink-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-indigo)' : '2px solid transparent',
            }}
          >
            <span style={{ marginRight: '0.35rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'graph' && (
        <div className="animate-fade-in-up">
          <section className="layout-grid">
            <RepoSummaryPanel summary={repoData.summary} />
            <GraphView
              nodes={repoData.graph.nodes}
              edges={repoData.graph.edges}
              clusters={repoData.graph.clusters}
              collapseClusters={collapseClusters}
              onNodeClick={setSelectedNodeId}
            />
          </section>
          <div style={{ marginTop: '1.25rem' }}>
            <FileDetailsPanel selectedNode={selectedNode} />
          </div>
        </div>
      )}

      {activeTab === 'flow' && (
        <div className="animate-fade-in-up">
          <FlowPanel repoId={routeRepoId} onStepNodeChange={setSelectedNodeId} />
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="animate-fade-in-up">
          <ChatPanel
            repoId={routeRepoId}
            onOpenFile={(filePath) => {
              setSelectedNodeId(filePath);
              setActiveTab('graph');
            }}
          />
        </div>
      )}
    </main>
  );
}