import React from 'react';
import type { RepoSummaryResponse } from '../types';

interface RepoSummaryPanelProps {
  summary: RepoSummaryResponse;
}

export function RepoSummaryPanel({ summary }: RepoSummaryPanelProps) {
  return (
    <section className="panel h-full overflow-auto p-5" aria-label="repo-summary-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-violet)', marginRight: '0.4rem' }}>◉</span>
        Summary
      </h2>

      <div className="summary-metric mt-4">
        <span className="summary-label">Architecture</span>
        <strong className="summary-value">{summary.architectureType}</strong>
      </div>

      <p className="summary-explanation mt-3">{summary.explanation}</p>

      <h3 className="section-title mt-6">Feature Clusters</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
        {summary.featureClusters.map((cluster) => (
          <li key={cluster.name} className="chip-row" style={{ marginBottom: '0.5rem' }}>
            <span className="cluster-chip">{cluster.name}</span>
            <span className="chip-description">{cluster.description}</span>
          </li>
        ))}
      </ul>

      <h3 className="section-title mt-6">Critical Files</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
        {summary.criticalFiles.map((item) => (
          <li key={item.file} className="critical-row">
            <span className="critical-file">{item.file}</span>
            <span className="critical-score">{item.score.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
