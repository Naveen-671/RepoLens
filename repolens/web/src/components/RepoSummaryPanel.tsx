import React from 'react';
import type { RepoSummaryResponse } from '../types';

interface RepoSummaryPanelProps {
  summary: RepoSummaryResponse;
}

/**
 * Renders repository architecture and feature overview details.
 */
export function RepoSummaryPanel({ summary }: RepoSummaryPanelProps) {
  return (
    <section className="panel h-full overflow-auto p-5" aria-label="repo-summary-panel">
      <h2 className="panel-title">Repository Summary</h2>
      <div className="summary-metric mt-4">
        <span className="summary-label">Architecture</span>
        <strong className="summary-value">{summary.architectureType}</strong>
      </div>

      <p className="summary-explanation mt-3">{summary.explanation}</p>

      <h3 className="section-title mt-6">Feature Clusters</h3>
      <ul className="space-y-2 mt-2">
        {summary.featureClusters.map((cluster) => (
          <li key={cluster.name} className="chip-row">
            <span className="cluster-chip">{cluster.name}</span>
            <span className="chip-description">{cluster.description}</span>
          </li>
        ))}
      </ul>

      <h3 className="section-title mt-6">Critical Files</h3>
      <ul className="space-y-2 mt-2">
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
