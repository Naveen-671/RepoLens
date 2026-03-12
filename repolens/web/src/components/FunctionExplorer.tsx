import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { FunctionDetail, RepoNode, FunctionFlowEdge } from '../types';

interface FunctionExplorerProps {
  nodes: RepoNode[];
  functionFlowEdges: FunctionFlowEdge[];
  onFileClick: (filePath: string) => void;
}

type SortKey = 'name' | 'complexity' | 'params' | 'calls';

export function FunctionExplorer({ nodes, functionFlowEdges, onFileClick }: FunctionExplorerProps) {
  const [search, setSearch] = useState('');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [expandedFn, setExpandedFn] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('complexity');
  const [showExportedOnly, setShowExportedOnly] = useState(false);
  const [selectedFnForFlow, setSelectedFnForFlow] = useState<string | null>(null);

  const allFunctions = useMemo(() => {
    const fns: Array<FunctionDetail & { filePath: string }> = [];
    for (const node of nodes) {
      for (const fn of node.functionDetails ?? []) {
        fns.push({ ...fn, filePath: node.id });
      }
    }
    return fns;
  }, [nodes]);

  const filtered = useMemo(() => {
    let list = allFunctions;
    if (showExportedOnly) list = list.filter((fn) => fn.isExported);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (fn) =>
          fn.name.toLowerCase().includes(q) ||
          fn.filePath.toLowerCase().includes(q) ||
          fn.description.toLowerCase().includes(q),
      );
    }
    const sorters: Record<SortKey, (a: typeof list[0], b: typeof list[0]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      complexity: (a, b) => b.complexity - a.complexity,
      params: (a, b) => b.params.length - a.params.length,
      calls: (a, b) => b.callsTo.length - a.callsTo.length,
    };
    return [...list].sort(sorters[sortBy]);
  }, [allFunctions, search, sortBy, showExportedOnly]);

  // Group by file for file-view mode
  const fileGroups = useMemo(() => {
    const groups = new Map<string, Array<FunctionDetail & { filePath: string }>>();
    for (const fn of filtered) {
      if (!groups.has(fn.filePath)) groups.set(fn.filePath, []);
      groups.get(fn.filePath)!.push(fn);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Build call chain for selected function
  const callChain = useMemo(() => {
    if (!selectedFnForFlow) return { callers: [] as FunctionFlowEdge[], callees: [] as FunctionFlowEdge[] };
    return {
      callers: functionFlowEdges.filter((e) => e.target === selectedFnForFlow),
      callees: functionFlowEdges.filter((e) => e.source === selectedFnForFlow),
    };
  }, [selectedFnForFlow, functionFlowEdges]);

  const topComplexFns = useMemo(
    () => [...allFunctions].sort((a, b) => b.complexity - a.complexity).slice(0, 8),
    [allFunctions],
  );

  const topConnectedFns = useMemo(
    () => [...allFunctions].sort((a, b) => b.callsTo.length - a.callsTo.length).slice(0, 8),
    [allFunctions],
  );

  return (
    <section className="panel p-5" aria-label="function-explorer">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-emerald)', marginRight: '0.4rem' }}>ƒ</span>
        Function Explorer
        <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>
          {allFunctions.length} functions across {nodes.length} files
        </span>
      </h2>

      {/* Quick Stats Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.6rem', marginTop: '0.85rem',
      }}>
        {[
          { label: 'Total Functions', value: allFunctions.length, color: 'var(--accent-emerald)' },
          { label: 'Exported (Public)', value: allFunctions.filter((f) => f.isExported).length, color: 'var(--accent-indigo)' },
          { label: 'Async Functions', value: allFunctions.filter((f) => f.isAsync).length, color: 'var(--accent-cyan)' },
          { label: 'Avg Complexity', value: allFunctions.length > 0 ? (allFunctions.reduce((s, f) => s + f.complexity, 0) / allFunctions.length).toFixed(1) : '0', color: 'var(--accent-amber)' },
          { label: 'Cross-file Calls', value: functionFlowEdges.length, color: 'var(--accent-violet)' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
            className="metric-card-animated"
          >
            <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.1rem' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Complexity Hotspots & Most Connected */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <div>
          <h3 className="section-title" style={{ fontSize: '0.72rem' }}>🔥 Complexity Hotspots</h3>
          <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.4rem' }}>
            {topComplexFns.map((fn) => (
              <button key={`${fn.filePath}:${fn.name}`}
                onClick={() => { setSelectedFnForFlow(fn.name); setExpandedFn(`${fn.filePath}:${fn.name}`); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--bg-elevated)',
                  border: `1px solid ${expandedFn === `${fn.filePath}:${fn.name}` ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  color: 'var(--ink-primary)', width: '100%', textAlign: 'left',
                }}>
                <span>{fn.name}()</span>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  color: fn.complexity > 20 ? 'var(--accent-rose)' : fn.complexity > 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                }}>
                  C:{fn.complexity}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="section-title" style={{ fontSize: '0.72rem' }}>🔗 Most Connected</h3>
          <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.4rem' }}>
            {topConnectedFns.map((fn) => (
              <button key={`${fn.filePath}:${fn.name}:conn`}
                onClick={() => { setSelectedFnForFlow(fn.name); setExpandedFn(`${fn.filePath}:${fn.name}`); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--bg-elevated)',
                  border: `1px solid ${expandedFn === `${fn.filePath}:${fn.name}` ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  color: 'var(--ink-primary)', width: '100%', textAlign: 'left',
                }}>
                <span>{fn.name}()</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-indigo)' }}>
                  →{fn.callsTo.length} calls
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Function Call Flow */}
      {selectedFnForFlow && (callChain.callers.length > 0 || callChain.callees.length > 0) && (
        <div style={{
          marginTop: '1rem', padding: '0.85rem', borderRadius: 'var(--radius-md)',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-indigo)', margin: 0 }}>
            Call Flow: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedFnForFlow}()</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'center' }}>
            {/* Callers */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Called By</div>
              {callChain.callers.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>No callers found</div>
              ) : callChain.callers.map((e, i) => (
                <div key={i} onClick={() => onFileClick(e.sourceFile)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '0.2rem 0.4rem',
                  borderRadius: 4, background: 'rgba(52,211,153,0.1)', marginBottom: '0.2rem',
                  cursor: 'pointer', color: 'var(--accent-emerald)',
                }}>
                  {e.source}() <span style={{ color: 'var(--ink-muted)', fontSize: '0.62rem' }}>in {e.sourceFile.split('/').pop()}</span>
                </div>
              ))}
            </div>
            {/* Arrow */}
            <div style={{ fontSize: '1.5rem', color: 'var(--accent-indigo)', fontWeight: 700 }}>→</div>
            {/* Callees */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Calls To</div>
              {callChain.callees.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>No outgoing calls</div>
              ) : callChain.callees.map((e, i) => (
                <div key={i} onClick={() => onFileClick(e.targetFile)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '0.2rem 0.4rem',
                  borderRadius: 4, background: 'rgba(99,102,241,0.1)', marginBottom: '0.2rem',
                  cursor: 'pointer', color: 'var(--accent-indigo)',
                }}>
                  {e.target}() <span style={{ color: 'var(--ink-muted)', fontSize: '0.62rem' }}>in {e.targetFile.split('/').pop()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.25rem',
        padding: '0.5rem 0.6rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search functions, files, descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '0.4rem 0.65rem', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--ink-primary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{
          padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', color: 'var(--ink-primary)', fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
        }}>
          <option value="complexity">Sort: Complexity</option>
          <option value="name">Sort: Name</option>
          <option value="params">Sort: Parameters</option>
          <option value="calls">Sort: Calls</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showExportedOnly} onChange={(e) => setShowExportedOnly(e.target.checked)} style={{ accentColor: 'var(--accent-indigo)' }} />
          Exported only
        </label>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
          {filtered.length} results
        </span>
      </div>

      {/* Function List by File */}
      <div style={{ marginTop: '0.85rem', maxHeight: 500, overflowY: 'auto' }}>
        {fileGroups.map(([filePath, fns]) => (
          <div key={filePath} style={{ marginBottom: '0.5rem' }}>
            <button
              onClick={() => setExpandedFile(expandedFile === filePath ? null : filePath)}
              style={{
                width: '100%', textAlign: 'left', padding: '0.45rem 0.65rem',
                background: expandedFile === filePath ? 'rgba(99,102,241,0.08)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: 'var(--ink-primary)', fontSize: '0.78rem', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{expandedFile === filePath ? '▾' : '▸'} {filePath}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--accent-indigo)' }}>{fns.length} functions</span>
            </button>

            {expandedFile === filePath && fns.map((fn) => {
              const fnKey = `${filePath}:${fn.name}`;
              const isExpanded = expandedFn === fnKey;
              return (
                <div key={fnKey} style={{ marginLeft: '1rem', marginTop: '0.2rem' }}>
                  <button
                    onClick={() => { setExpandedFn(isExpanded ? null : fnKey); setSelectedFnForFlow(fn.name); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.35rem 0.55rem',
                      background: isExpanded ? 'rgba(52,211,153,0.08)' : 'transparent',
                      border: `1px solid ${isExpanded ? 'rgba(52,211,153,0.3)' : 'var(--border-subtle)'}`,
                      borderRadius: 6, cursor: 'pointer', color: 'var(--ink-primary)',
                      fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{fn.name}</span>
                      <span style={{ color: 'var(--ink-muted)', fontSize: '0.68rem' }}>
                        ({fn.params.map((p) => p.name).join(', ')})
                      </span>
                      {fn.returnType !== 'unknown' && (
                        <span style={{ color: 'var(--accent-cyan)', fontSize: '0.65rem' }}>→ {fn.returnType}</span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                        {fn.isAsync && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(34,211,238,0.15)', color: 'var(--accent-cyan)' }}>async</span>}
                        {fn.isExported && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)' }}>export</span>}
                        <span style={{
                          fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4,
                          background: fn.complexity > 15 ? 'rgba(251,113,133,0.15)' : 'rgba(52,211,153,0.1)',
                          color: fn.complexity > 15 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                        }}>
                          C:{fn.complexity}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{
                      marginLeft: '0.75rem', marginTop: '0.3rem', padding: '0.6rem',
                      borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)', fontSize: '0.75rem',
                    }}>
                      {fn.description && (
                        <p style={{ color: 'var(--ink-secondary)', marginBottom: '0.5rem', lineHeight: 1.5, fontStyle: 'italic' }}>
                          {fn.description}
                        </p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>Parameters</p>
                          {fn.params.length === 0 ? (
                            <p style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>None</p>
                          ) : fn.params.map((p, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.15rem' }}>
                              <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{p.name}</span>
                              <span style={{ color: 'var(--ink-muted)', fontSize: '0.65rem' }}>: {p.type}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>Calls To</p>
                          {fn.callsTo.length === 0 ? (
                            <p style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>None</p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                              {fn.callsTo.slice(0, 12).map((c) => (
                                <span key={c} style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.1rem 0.35rem',
                                  borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-indigo)',
                                }}>
                                  {c}()
                                </span>
                              ))}
                              {fn.callsTo.length > 12 && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>+{fn.callsTo.length - 12} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', fontSize: '0.68rem' }}>
                        <span style={{ color: 'var(--ink-muted)' }}>Line {fn.lineNumber}</span>
                        <span style={{ color: 'var(--ink-muted)' }}>•</span>
                        <span style={{ color: fn.isAsync ? 'var(--accent-cyan)' : 'var(--ink-muted)' }}>
                          {fn.isAsync ? 'Async' : 'Sync'}
                        </span>
                        <span style={{ color: 'var(--ink-muted)' }}>•</span>
                        <button onClick={() => onFileClick(filePath)} style={{
                          color: 'var(--accent-indigo)', cursor: 'pointer', border: 'none',
                          background: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                          textDecoration: 'underline',
                        }}>
                          View file →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {fileGroups.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.82rem', padding: '2rem 0' }}>
            No functions found matching your criteria.
          </p>
        )}
      </div>
    </section>
  );
}
