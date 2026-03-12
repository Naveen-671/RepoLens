import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRepoUiData } from './api';
import { AnalyzePanel } from './components/AnalyzePanel';
import { ChatPanel } from './components/ChatPanel';
import { FileDetailsPanel } from './components/FileDetailsPanel';
import { FlowPanel } from './components/FlowPanel';
import { GraphView } from './components/GraphView';
import { HealthDashboard } from './components/HealthDashboard';
import { RepoOverviewPanel } from './components/RepoOverviewPanel';
import { FunctionExplorer } from './components/FunctionExplorer';
import { PackagePanel } from './components/PackagePanel';
import { DataFlowPanel } from './components/DataFlowPanel';
import type { RepoUiData } from './types';

type TabKey = 'overview' | 'health' | 'graph' | 'functions' | 'dataflow' | 'packages' | 'flow' | 'chat' | 'analyze';

export default function App() {
  const routeRepoId = useMemo(() => {
    const match = window.location.pathname.match(/^\/visualization\/flow\/([^/]+)$/);
    return match?.[1] ?? 'sample';
  }, []);

  const [repoId, setRepoId] = useState(routeRepoId);
  const [repoData, setRepoData] = useState<RepoUiData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapseClusters, setCollapseClusters] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const loadRepo = useCallback((id: string) => {
    setRepoData(null);
    void loadRepoUiData(id).then((data) => {
      setRepoData(data);
      setRepoId(id);
      setSelectedNodeId(data.graph.nodes[0]?.id ?? null);
      setActiveTab('overview');
      setSelectedCluster(null);
    });
  }, []);

  useEffect(() => {
    loadRepo(routeRepoId);
  }, [routeRepoId, loadRepo]);

  const selectedNode = useMemo(() => {
    if (!repoData || !selectedNodeId) return null;
    return repoData.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [repoData, selectedNodeId]);

  // Filtered graph data for sub-dependency viewing
  const filteredGraph = useMemo(() => {
    if (!repoData) return null;
    if (!selectedCluster) return repoData.graph;

    const cluster = repoData.graph.clusters.find((c) => c.name === selectedCluster);
    if (!cluster) return repoData.graph;

    const clusterNodeSet = new Set(cluster.nodes);
    const filteredNodes = repoData.graph.nodes.filter((n) => clusterNodeSet.has(n.id));
    const filteredEdges = repoData.graph.edges.filter(
      (e) => clusterNodeSet.has(e.source) || clusterNodeSet.has(e.target),
    );

    return {
      ...repoData.graph,
      nodes: filteredNodes,
      edges: filteredEdges,
      clusters: [cluster],
    };
  }, [repoData, selectedCluster]);

  const handleAnalysisComplete = useCallback((newRepoId: string) => {
    window.history.pushState({}, '', `/visualization/flow/${newRepoId}`);
    loadRepo(newRepoId);
  }, [loadRepo]);

  if (!repoData) {
    return (
      <main className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-card animate-pulse-glow" style={{ maxWidth: 420 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <h1 className="brand-title" style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '2rem' }}>RepoLens</h1>
          <p style={{ color: 'var(--ink-secondary)', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Architecture intelligence for engineering teams
          </p>
          <div style={{
            marginTop: '1.5rem', padding: '0.5rem 0',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            {['Scanning repository structure...', 'Analyzing dependencies...', 'Building architecture graph...'].map((step, i) => (
              <div key={step} className="stagger-children" style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.6rem',
                opacity: 0.7,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent-indigo)',
                  animation: `pulseGlow 2s ease-in-out ${i * 0.5}s infinite`,
                }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const metrics = repoData.graph.repoMetrics;
  const overview = repoData.graph.repoOverview;

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'overview', label: 'Overview', icon: '🔍' },
    { key: 'health', label: 'Health', icon: '💚' },
    { key: 'graph', label: 'Architecture', icon: '🏗️' },
    { key: 'functions', label: 'Functions', icon: '⚡' },
    { key: 'dataflow', label: 'Data Flow', icon: '🔀' },
    { key: 'packages', label: 'Packages', icon: '📦' },
    { key: 'flow', label: 'Request Flows', icon: '🎬' },
    { key: 'chat', label: 'Ask AI', icon: '🤖' },
    { key: 'analyze', label: 'New Analysis', icon: '➕' },
  ];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="brand-title">RepoLens</h1>
          <p className="brand-subtitle">Architecture intelligence for engineering teams</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span className="stat-badge stat-badge--indigo">{repoData.graph.nodes.length} files</span>
            <span className="stat-badge stat-badge--emerald">
              {metrics ? `${(metrics.totalLinesOfCode / 1000).toFixed(1)}K LOC` : `${repoData.graph.edges.length} deps`}
            </span>
            <span className="stat-badge stat-badge--violet">{repoData.summary.featureClusters.length} clusters</span>
            {metrics && (
              <span className={`stat-badge ${metrics.avgHealthScore >= 0.85 ? 'stat-badge--emerald' : metrics.avgHealthScore >= 0.65 ? 'stat-badge--amber' : 'stat-badge--rose'}`}>
                {Math.round(metrics.avgHealthScore * 100)}% health
              </span>
            )}
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
        flexWrap: 'wrap',
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in-up">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <RepoOverviewPanel
              overview={overview}
              metrics={metrics}
              summary={repoData.summary}
              onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {metrics && (
                <HealthDashboard metrics={metrics} onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && metrics && (
        <div className="animate-fade-in-up">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <HealthDashboard metrics={metrics} onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <RepoOverviewPanel
                overview={overview}
                metrics={undefined}
                summary={repoData.summary}
                onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
              />
            </div>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <FileDetailsPanel selectedNode={selectedNode} />
          </div>
        </div>
      )}

      {activeTab === 'health' && !metrics && (
        <div className="animate-fade-in-up">
          <RepoOverviewPanel
            overview={overview}
            metrics={undefined}
            summary={repoData.summary}
            onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
          />
        </div>
      )}

      {/* Architecture Tab with Cluster Filter */}
      {activeTab === 'graph' && filteredGraph && (
        <div className="animate-fade-in-up">
          {/* Cluster sub-graph selector */}
          {repoData.graph.clusters.length > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              marginBottom: '0.85rem', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Focus:
              </span>
              <button
                onClick={() => setSelectedCluster(null)}
                className={selectedCluster === null ? 'cluster-chip cluster-chip--active' : 'cluster-chip'}
                style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)' }}
              >
                All ({repoData.graph.nodes.length})
              </button>
              {repoData.graph.clusters.map((cluster) => (
                <button
                  key={cluster.name}
                  onClick={() => setSelectedCluster(selectedCluster === cluster.name ? null : cluster.name)}
                  className={selectedCluster === cluster.name ? 'cluster-chip cluster-chip--active' : 'cluster-chip'}
                  style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)' }}
                >
                  {cluster.name} ({cluster.nodes.length})
                </button>
              ))}
            </div>
          )}
          <GraphView
            nodes={filteredGraph.nodes}
            edges={filteredGraph.edges}
            clusters={filteredGraph.clusters}
            collapseClusters={collapseClusters}
            onNodeClick={setSelectedNodeId}
          />
          <div style={{ marginTop: '1.25rem' }}>
            <FileDetailsPanel selectedNode={selectedNode} />
          </div>
        </div>
      )}

      {/* Functions Tab */}
      {activeTab === 'functions' && (
        <div className="animate-fade-in-up">
          <FunctionExplorer
            nodes={repoData.graph.nodes}
            functionFlowEdges={repoData.graph.functionFlowEdges ?? []}
            onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
          />
        </div>
      )}

      {/* Data Flow Tab */}
      {activeTab === 'dataflow' && (
        <div className="animate-fade-in-up">
          <DataFlowPanel
            nodes={repoData.graph.nodes}
            edges={repoData.graph.edges}
            functionFlowEdges={repoData.graph.functionFlowEdges ?? []}
            onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
          />
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="animate-fade-in-up">
          <PackagePanel
            packages={repoData.graph.packageDependencies ?? []}
            onFileClick={(f) => { setSelectedNodeId(f); setActiveTab('graph'); }}
          />
        </div>
      )}

      {activeTab === 'flow' && (
        <div className="animate-fade-in-up">
          <FlowPanel repoId={repoId} onStepNodeChange={setSelectedNodeId} />
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="animate-fade-in-up">
          <ChatPanel
            repoId={repoId}
            onOpenFile={(filePath) => {
              setSelectedNodeId(filePath);
              setActiveTab('graph');
            }}
          />
        </div>
      )}

      {activeTab === 'analyze' && (
        <div className="animate-fade-in-up">
          <AnalyzePanel onAnalysisComplete={handleAnalysisComplete} />
        </div>
      )}
    </main>
  );
}