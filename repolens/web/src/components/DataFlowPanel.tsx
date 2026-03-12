import React, { useMemo, useState } from 'react';
import type { RepoNode, RepoEdge, FunctionFlowEdge } from '../types';

interface DataFlowPanelProps {
  nodes: RepoNode[];
  edges: RepoEdge[];
  functionFlowEdges: FunctionFlowEdge[];
  onFileClick: (filePath: string) => void;
}

interface FlowPath {
  files: string[];
  functions: string[];
  description: string;
}

export function DataFlowPanel({ nodes, edges, functionFlowEdges, onFileClick }: DataFlowPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'file' | 'function'>('file');
  const [traceDirection, setTraceDirection] = useState<'forward' | 'backward'>('forward');

  // Build adjacency maps
  const { forwardAdj, backwardAdj, fileNodeMap } = useMemo(() => {
    const fwd = new Map<string, Set<string>>();
    const bwd = new Map<string, Set<string>>();
    const nodeMap = new Map<string, RepoNode>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      fwd.set(node.id, new Set());
      bwd.set(node.id, new Set());
    }

    for (const edge of edges) {
      fwd.get(edge.source)?.add(edge.target);
      bwd.get(edge.target)?.add(edge.source);
    }

    return { forwardAdj: fwd, backwardAdj: bwd, fileNodeMap: nodeMap };
  }, [nodes, edges]);

  // Files with most connections (hub files)
  const hubFiles = useMemo(() => {
    const scores = nodes.map((n) => ({
      id: n.id,
      incoming: backwardAdj.get(n.id)?.size ?? 0,
      outgoing: forwardAdj.get(n.id)?.size ?? 0,
      total: (backwardAdj.get(n.id)?.size ?? 0) + (forwardAdj.get(n.id)?.size ?? 0),
    }));
    return scores.sort((a, b) => b.total - a.total).slice(0, 10);
  }, [nodes, forwardAdj, backwardAdj]);

  // Trace data flow from selected file
  const flowTrace = useMemo(() => {
    if (!selectedFile) return { visited: new Set<string>(), layers: [] as string[][] };

    const adj = traceDirection === 'forward' ? forwardAdj : backwardAdj;
    const visited = new Set<string>();
    const layers: string[][] = [];
    let currentLayer = [selectedFile];
    visited.add(selectedFile);

    while (currentLayer.length > 0 && layers.length < 6) {
      layers.push(currentLayer);
      const nextLayer: string[] = [];
      for (const file of currentLayer) {
        for (const neighbor of adj.get(file) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextLayer.push(neighbor);
          }
        }
      }
      currentLayer = nextLayer;
    }

    return { visited, layers };
  }, [selectedFile, traceDirection, forwardAdj, backwardAdj]);

  // Detect circular dependencies
  const circularDeps = useMemo(() => {
    const cycles: Array<[string, string]> = [];
    for (const edge of edges) {
      if (forwardAdj.get(edge.target)?.has(edge.source)) {
        const key = [edge.source, edge.target].sort().join('↔');
        if (!cycles.some(([a, b]) => [a, b].sort().join('↔') === key)) {
          cycles.push([edge.source, edge.target]);
        }
      }
    }
    return cycles;
  }, [edges, forwardAdj]);

  // Entry points (files imported by many but importing few)
  const entryPoints = useMemo(() => {
    return nodes
      .filter((n) => {
        const out = forwardAdj.get(n.id)?.size ?? 0;
        return out === 0 && (backwardAdj.get(n.id)?.size ?? 0) > 0;
      })
      .sort((a, b) => (backwardAdj.get(b.id)?.size ?? 0) - (backwardAdj.get(a.id)?.size ?? 0))
      .slice(0, 5);
  }, [nodes, forwardAdj, backwardAdj]);

  // Leaf nodes (files that import but aren't imported by others)
  const leafNodes = useMemo(() => {
    return nodes
      .filter((n) => {
        const ins = backwardAdj.get(n.id)?.size ?? 0;
        return ins === 0 && (forwardAdj.get(n.id)?.size ?? 0) > 0;
      })
      .slice(0, 5);
  }, [nodes, forwardAdj, backwardAdj]);

  // Function flow paths
  const functionPaths = useMemo(() => {
    const paths: FlowPath[] = [];
    if (functionFlowEdges.length === 0) return paths;

    // Group by source file to build call chains
    const fnEdgeMap = new Map<string, FunctionFlowEdge[]>();
    for (const e of functionFlowEdges) {
      if (!fnEdgeMap.has(e.sourceFile)) fnEdgeMap.set(e.sourceFile, []);
      fnEdgeMap.get(e.sourceFile)!.push(e);
    }

    // Build short chains from entry-like files
    for (const [sourceFile, outEdges] of fnEdgeMap) {
      for (const edge of outEdges.slice(0, 3)) {
        const chain = [edge];
        let current = edge.targetFile;
        const visited = new Set([sourceFile, current]);
        for (let i = 0; i < 4; i++) {
          const nextEdges = fnEdgeMap.get(current) ?? [];
          const next = nextEdges.find((e) => !visited.has(e.targetFile));
          if (!next) break;
          chain.push(next);
          visited.add(next.targetFile);
          current = next.targetFile;
        }
        if (chain.length >= 2) {
          paths.push({
            files: [sourceFile, ...chain.map((e) => e.targetFile)],
            functions: [chain[0].source, ...chain.map((e) => e.target)],
            description: `${chain[0].source}() → ${chain.map((e) => e.target + '()').join(' → ')}`,
          });
        }
      }
    }

    return paths.sort((a, b) => b.functions.length - a.functions.length).slice(0, 6);
  }, [functionFlowEdges]);

  return (
    <section className="panel p-5" aria-label="data-flow-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>⇢</span>
        Data & Function Flow
        <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>
          {edges.length} import edges • {functionFlowEdges.length} function calls
        </span>
      </h2>

      {/* View Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem' }}>
        {(['file', 'function'] as const).map((mode) => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{
            padding: '0.3rem 0.65rem', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer',
            border: `1px solid ${viewMode === mode ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
            background: viewMode === mode ? 'rgba(99,102,241,0.12)' : 'transparent',
            color: viewMode === mode ? 'var(--accent-indigo)' : 'var(--ink-muted)',
            textTransform: 'capitalize', fontFamily: 'var(--font-sans)', fontWeight: 600,
          }}>
            {mode === 'file' ? '📁 File Flow' : '⨍ Function Flow'}
          </button>
        ))}
      </div>

      {/* Summary Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.6rem', marginTop: '0.85rem',
      }}>
        {[
          { label: 'Import Edges', value: edges.length, color: 'var(--accent-indigo)' },
          { label: 'Function Calls', value: functionFlowEdges.length, color: 'var(--accent-emerald)' },
          { label: 'Hub Files', value: hubFiles.filter((h) => h.total > 3).length, color: 'var(--accent-cyan)' },
          { label: 'Circular Deps', value: circularDeps.length, color: circularDeps.length > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' },
          { label: 'Leaf Files', value: leafNodes.length, color: 'var(--accent-amber)' },
        ].map((stat) => (
          <div key={stat.label} style={{
            padding: '0.55rem', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.1rem' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Circular Dependencies Warning */}
      {circularDeps.length > 0 && (
        <div style={{
          marginTop: '1rem', padding: '0.65rem', borderRadius: 'var(--radius-sm)',
          background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
        }}>
          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-rose)', margin: 0 }}>
            ⚠ Circular Dependencies Detected
          </h3>
          <div style={{ marginTop: '0.35rem' }}>
            {circularDeps.slice(0, 5).map(([a, b], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.7rem', fontFamily: 'var(--font-mono)', padding: '0.15rem 0',
              }}>
                <button onClick={() => onFileClick(a)} style={{
                  color: 'var(--accent-indigo)', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
                }}>
                  {a.split('/').pop()}
                </button>
                <span style={{ color: 'var(--accent-rose)' }}>↔</span>
                <button onClick={() => onFileClick(b)} style={{
                  color: 'var(--accent-indigo)', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
                }}>
                  {b.split('/').pop()}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        {/* Hub Files (in file mode) */}
        {viewMode === 'file' ? (
          <div>
            <h3 className="section-title" style={{ fontSize: '0.72rem' }}>🔀 Hub Files (Most Connected)</h3>
            <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.4rem' }}>
              {hubFiles.map((hub) => (
                <button key={hub.id}
                  onClick={() => { setSelectedFile(hub.id); onFileClick(hub.id); }}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '0.3rem 0.5rem', borderRadius: 6,
                    background: selectedFile === hub.id ? 'rgba(34,211,238,0.08)' : 'var(--bg-elevated)',
                    border: `1px solid ${selectedFile === hub.id ? 'rgba(34,211,238,0.3)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                    color: 'var(--ink-primary)',
                  }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {hub.id.split('/').pop()}
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--accent-emerald)' }}>↓{hub.incoming}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--accent-indigo)' }}>↑{hub.outgoing}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="section-title" style={{ fontSize: '0.72rem' }}>⛓ Function Call Chains</h3>
            <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.4rem' }}>
              {functionPaths.length > 0 ? functionPaths.map((chain, i) => (
                <div key={i} style={{
                  padding: '0.4rem 0.55rem', borderRadius: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  }}>
                    {chain.functions.map((fn, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>→</span>}
                        <button onClick={() => onFileClick(chain.files[j])} style={{
                          padding: '0.1rem 0.35rem', borderRadius: 4,
                          background: 'rgba(52,211,153,0.1)', border: 'none',
                          color: 'var(--accent-emerald)', cursor: 'pointer',
                          fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                        }}>
                          {fn}()
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                    {chain.files.map((f) => f.split('/').pop()).join(' → ')}
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>No function flow edges detected.</p>
              )}
            </div>
          </div>
        )}

        {/* Entry & Leaf Points */}
        <div>
          <h3 className="section-title" style={{ fontSize: '0.72rem' }}>📍 Entry Points (Imported, not importers)</h3>
          <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.4rem' }}>
            {entryPoints.map((node) => (
              <button key={node.id} onClick={() => { setSelectedFile(node.id); onFileClick(node.id); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.3rem 0.5rem', borderRadius: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  color: 'var(--accent-emerald)',
                }}>
                {node.id.split('/').pop()}
                <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', marginLeft: '0.3rem' }}>
                  ({backwardAdj.get(node.id)?.size ?? 0} dependents)
                </span>
              </button>
            ))}
          </div>

          <h3 className="section-title" style={{ fontSize: '0.72rem', marginTop: '0.75rem' }}>🍂 Leaf Files (Import others, not imported)</h3>
          <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.4rem' }}>
            {leafNodes.map((node) => (
              <button key={node.id} onClick={() => { setSelectedFile(node.id); onFileClick(node.id); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.3rem 0.5rem', borderRadius: 6,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  color: 'var(--accent-amber)',
                }}>
                {node.id.split('/').pop()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Function Call Chains */}
      {functionPaths.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '0.72rem' }}>⛓ Cross-File Function Call Chains</h3>
          <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.5rem' }}>
            {functionPaths.map((chain, i) => (
              <div key={i} style={{
                padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                }}>
                  {chain.functions.map((fn, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>→</span>}
                      <button onClick={() => onFileClick(chain.files[j])} style={{
                        padding: '0.15rem 0.4rem', borderRadius: 4,
                        background: 'rgba(52,211,153,0.1)', border: 'none',
                        color: 'var(--accent-emerald)', cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                      }}>
                        {fn}()
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>
                  {chain.files.map((f) => f.split('/').pop()).join(' → ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected File Details */}
      {selectedFile && fileNodeMap.get(selectedFile) && (
        <div style={{
          marginTop: '1rem', padding: '0.65rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '0.3rem' }}>
            {selectedFile}
          </div>
          {fileNodeMap.get(selectedFile)!.summary && (
            <p style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', margin: '0.2rem 0' }}>
              {fileNodeMap.get(selectedFile)!.summary}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
            {fileNodeMap.get(selectedFile)!.functions?.map((fn) => (
              <span key={fn} style={{
                fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
                padding: '0.1rem 0.35rem', borderRadius: 4,
                background: 'rgba(52,211,153,0.1)', color: 'var(--accent-emerald)',
              }}>{fn}()</span>
            ))}
          </div>
        </div>
      )}

      {/* File Flow Trace */}
      {selectedFile && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h3 className="section-title" style={{ fontSize: '0.72rem', margin: 0 }}>
              🔍 Flow Trace: {selectedFile.split('/').pop()}
            </h3>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['forward', 'backward'] as const).map((dir) => (
                <button key={dir} onClick={() => setTraceDirection(dir)} style={{
                  padding: '0.2rem 0.45rem', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer',
                  border: `1px solid ${traceDirection === dir ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  background: traceDirection === dir ? 'rgba(34,211,238,0.1)' : 'transparent',
                  color: traceDirection === dir ? 'var(--accent-cyan)' : 'var(--ink-muted)',
                  textTransform: 'capitalize', fontFamily: 'var(--font-sans)', fontWeight: 600,
                }}>
                  {dir === 'forward' ? '→ Dependents' : '← Dependencies'}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            padding: '0.75rem', borderRadius: 'var(--radius-md)',
            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)',
          }}>
            {flowTrace.layers.map((layer, depth) => (
              <div key={depth} style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                marginBottom: '0.4rem', paddingLeft: depth * 20,
              }}>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-cyan)',
                  minWidth: 20, textAlign: 'right',
                }}>
                  L{depth}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {layer.map((file) => (
                    <button key={file} onClick={() => onFileClick(file)} style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.15rem 0.4rem',
                      borderRadius: 4, cursor: 'pointer', border: 'none',
                      background: depth === 0 ? 'rgba(34,211,238,0.15)' : 'rgba(99,102,241,0.1)',
                      color: depth === 0 ? 'var(--accent-cyan)' : 'var(--accent-indigo)',
                    }}>
                      {file.split('/').pop()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {flowTrace.layers.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>No connections found.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
