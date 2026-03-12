import React from 'react';
import type { RepoNode } from '../types';

interface FileDetailsPanelProps {
  selectedNode: RepoNode | null;
}

export function FileDetailsPanel({ selectedNode }: FileDetailsPanelProps) {
  if (!selectedNode) {
    return (
      <section className="panel p-5" aria-label="file-details-panel" style={{ minHeight: 120 }}>
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>⬡</span>
          File Details
        </h2>
        <p style={{ color: 'var(--ink-muted)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
          Click a node in the graph to inspect file metadata.
        </p>
      </section>
    );
  }

  const hasSummary = selectedNode.summary && selectedNode.summary !== 'Summary unavailable' && selectedNode.summary !== 'No summary available.';

  return (
    <section className="panel p-5" aria-label="file-details-panel" style={{ minHeight: 120 }}>
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>⬡</span>
        File Details
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.85rem' }}>
        <div>
          <p className="label">Path</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-indigo)' }}>{selectedNode.id}</p>
        </div>
        <div>
          <p className="label">Cluster</p>
          <span className="cluster-chip" style={{ marginTop: '0.2rem' }}>
            {selectedNode.cluster ?? 'general'}
          </span>
        </div>
      </div>

      {hasSummary && (
        <div style={{ marginTop: '0.85rem' }}>
          <p className="label">Summary</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.2rem' }}>{selectedNode.summary}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.85rem' }}>
        <div>
          <p className="label">Functions</p>
          {(selectedNode.functions ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {(selectedNode.functions ?? []).map((name) => (
                <span key={name} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 6,
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  color: 'var(--accent-emerald)',
                }}>
                  {name}()
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>None detected</p>
          )}
        </div>
        <div>
          <p className="label">Imports</p>
          {(selectedNode.imports ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {(selectedNode.imports ?? []).map((name) => (
                <span key={name} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 6,
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  color: 'var(--accent-indigo)',
                }}>
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>None detected</p>
          )}
        </div>
      </div>
    </section>
  );
}
