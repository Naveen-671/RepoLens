import React from 'react';
import type { RepoNode } from '../types';

interface FileDetailsPanelProps {
  selectedNode: RepoNode | null;
}

/**
 * Shows selected file details from graph interaction.
 */
export function FileDetailsPanel({ selectedNode }: FileDetailsPanelProps) {
  if (!selectedNode) {
    return (
      <section className="panel min-h-[180px] p-5" aria-label="file-details-panel">
        <h2 className="panel-title">File Details</h2>
        <p className="text-slate-600 mt-2">Select a node in the graph to inspect file metadata and cluster details.</p>
      </section>
    );
  }

  return (
    <section className="panel min-h-[180px] p-5" aria-label="file-details-panel">
      <h2 className="panel-title">File Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
        <div>
          <p className="label">Path</p>
          <p className="value">{selectedNode.id}</p>
        </div>
        <div>
          <p className="label">Cluster</p>
          <p className="value">{selectedNode.cluster ?? 'unclustered'}</p>
        </div>
      </div>

      <p className="label mt-4">Summary</p>
      <p className="value">{selectedNode.summary ?? 'No summary available.'}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <p className="label">Functions</p>
          <ul className="list-disc list-inside value space-y-1">
            {(selectedNode.functions ?? []).map((name) => (
              <li key={name}>{name}</li>
            ))}
            {(selectedNode.functions ?? []).length === 0 ? <li>None detected</li> : null}
          </ul>
        </div>
        <div>
          <p className="label">Imports</p>
          <ul className="list-disc list-inside value space-y-1">
            {(selectedNode.imports ?? []).map((name) => (
              <li key={name}>{name}</li>
            ))}
            {(selectedNode.imports ?? []).length === 0 ? <li>None detected</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
