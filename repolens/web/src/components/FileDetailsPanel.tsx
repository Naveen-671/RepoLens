import React, { useState } from 'react';
import type { RepoNode } from '../types';

interface FileDetailsPanelProps {
  selectedNode: RepoNode | null;
}

function healthColor(score: number): string {
  if (score >= 0.85) return 'var(--accent-emerald)';
  if (score >= 0.65) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
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
          Click a node in the graph or a file in the health dashboard to inspect.
        </p>
      </section>
    );
  }

  const hasSummary = selectedNode.summary && selectedNode.summary !== 'Summary unavailable' && selectedNode.summary !== 'No summary available.';
  const health = selectedNode.healthScore ?? 0;

  return (
    <section className="panel p-5" aria-label="file-details-panel" style={{ minHeight: 120 }}>
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>⬡</span>
        File Details
      </h2>

      {/* Top metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginTop: '0.85rem' }}>
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
        {selectedNode.linesOfCode !== undefined && (
          <div>
            <p className="label">Lines of Code</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
              {selectedNode.linesOfCode}
            </p>
          </div>
        )}
        {selectedNode.complexity !== undefined && (
          <div>
            <p className="label">Complexity</p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700,
              color: selectedNode.complexity > 20 ? 'var(--accent-rose)' : selectedNode.complexity > 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
            }}>
              {selectedNode.complexity}
            </p>
          </div>
        )}
        {selectedNode.healthScore !== undefined && (
          <div>
            <p className="label">Health Score</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: healthColor(health) }}>
              {Math.round(health * 100)}%
            </p>
          </div>
        )}
        {selectedNode.critical && (
          <div>
            <p className="label">Status</p>
            <span className="stat-badge stat-badge--amber" style={{ marginTop: '0.2rem' }}>Critical Path</span>
          </div>
        )}
      </div>

      {hasSummary && (
        <div style={{ marginTop: '0.85rem' }}>
          <p className="label">Summary</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.2rem' }}>{selectedNode.summary}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.85rem' }}>
        <div>
          <p className="label">Functions ({(selectedNode.functions ?? []).length})</p>
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
          <p className="label">Imports ({(selectedNode.imports ?? []).length})</p>
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

      {/* Classes & Interfaces */}
      {((selectedNode.classes ?? []).length > 0 || (selectedNode.interfaces ?? []).length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.85rem' }}>
          {(selectedNode.classes ?? []).length > 0 && (
            <div>
              <p className="label">Classes ({(selectedNode.classes ?? []).length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {(selectedNode.classes ?? []).map((name) => (
                  <span key={name} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 6,
                    background: 'rgba(167,139,250,0.1)',
                    border: '1px solid rgba(167,139,250,0.2)',
                    color: 'var(--accent-violet)',
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(selectedNode.interfaces ?? []).length > 0 && (
            <div>
              <p className="label">Interfaces ({(selectedNode.interfaces ?? []).length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {(selectedNode.interfaces ?? []).map((name) => (
                  <span key={name} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 6,
                    background: 'rgba(34,211,238,0.1)',
                    border: '1px solid rgba(34,211,238,0.2)',
                    color: 'var(--accent-cyan)',
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Function Info */}
      <FunctionDetailsSection functionDetails={selectedNode.functionDetails ?? []} />

      {/* Detailed Class Info */}
      <ClassDetailsSection classDetails={selectedNode.classDetails ?? []} />

      {/* Data Flow */}
      {((selectedNode.dataFlowIn ?? []).length > 0 || (selectedNode.dataFlowOut ?? []).length > 0) && (
        <div style={{ marginTop: '0.85rem' }}>
          <p className="label">Data Flow</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
            {(selectedNode.dataFlowIn ?? []).length > 0 && (
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Incoming ({(selectedNode.dataFlowIn ?? []).length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                  {(selectedNode.dataFlowIn ?? []).map((f) => (
                    <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                      background: 'rgba(52,211,153,0.1)', color: 'var(--accent-emerald)' }}>
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(selectedNode.dataFlowOut ?? []).length > 0 && (
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Outgoing ({(selectedNode.dataFlowOut ?? []).length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                  {(selectedNode.dataFlowOut ?? []).map((f) => (
                    <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                      background: 'rgba(99,102,241,0.1)', color: 'var(--accent-indigo)' }}>
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* External Imports */}
      {(selectedNode.externalImports ?? []).length > 0 && (
        <div style={{ marginTop: '0.85rem' }}>
          <p className="label">External Packages ({(selectedNode.externalImports ?? []).length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
            {(selectedNode.externalImports ?? []).map((pkg) => (
              <span key={pkg} style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '0.15rem 0.5rem',
                borderRadius: 6, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
                color: 'var(--accent-amber)',
              }}>
                {pkg}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Sub-components ---------- */

function FunctionDetailsSection({ functionDetails }: { functionDetails: NonNullable<RepoNode['functionDetails']> }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (functionDetails.length === 0) return null;

  return (
    <div style={{ marginTop: '0.85rem' }}>
      <p className="label">Function Details ({functionDetails.length})</p>
      <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.35rem', maxHeight: 320, overflowY: 'auto' }}>
        {functionDetails.map((fn) => {
          const isOpen = expanded === fn.name;
          return (
            <div key={`${fn.name}-${fn.lineNumber}`} style={{
              borderRadius: 6, border: '1px solid var(--border-subtle)',
              background: isOpen ? 'rgba(52,211,153,0.05)' : 'var(--bg-elevated)',
              overflow: 'hidden',
            }}>
              <button onClick={() => setExpanded(isOpen ? null : fn.name)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.35rem 0.55rem', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                color: 'var(--ink-primary)',
              }}>
                <span>
                  {fn.isAsync && <span style={{ color: 'var(--accent-violet)', marginRight: '0.25rem' }}>async</span>}
                  {fn.isExported && <span style={{ color: 'var(--accent-amber)', marginRight: '0.25rem' }}>export</span>}
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{fn.name}</span>
                  <span style={{ color: 'var(--ink-muted)' }}>
                    ({fn.params.map((p) => p.name).join(', ')}){fn.returnType !== 'void' ? `: ${fn.returnType}` : ''}
                  </span>
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>
                  L{fn.lineNumber} ● C{fn.complexity}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '0.35rem 0.55rem 0.55rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {fn.description && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginBottom: '0.3rem' }}>{fn.description}</p>
                  )}
                  {fn.params.length > 0 && (
                    <div style={{ marginBottom: '0.3rem' }}>
                      <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>Parameters</p>
                      {fn.params.map((p) => (
                        <p key={p.name} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-secondary)', marginTop: '0.1rem' }}>
                          <span style={{ color: 'var(--accent-indigo)' }}>{p.name}</span>
                          {p.type && <span style={{ color: 'var(--ink-muted)' }}>: {p.type}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                  {fn.callsTo.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>Calls</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.15rem' }}>
                        {fn.callsTo.map((c) => (
                          <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.08rem 0.3rem',
                            borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-indigo)' }}>{c}()</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassDetailsSection({ classDetails }: { classDetails: NonNullable<RepoNode['classDetails']> }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (classDetails.length === 0) return null;

  return (
    <div style={{ marginTop: '0.85rem' }}>
      <p className="label">Class Details ({classDetails.length})</p>
      <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.35rem' }}>
        {classDetails.map((cls) => {
          const isOpen = expanded === cls.name;
          return (
            <div key={`${cls.name}-${cls.lineNumber}`} style={{
              borderRadius: 6, border: '1px solid var(--border-subtle)',
              background: isOpen ? 'rgba(167,139,250,0.05)' : 'var(--bg-elevated)',
              overflow: 'hidden',
            }}>
              <button onClick={() => setExpanded(isOpen ? null : cls.name)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.35rem 0.55rem', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                color: 'var(--ink-primary)',
              }}>
                <span>
                  {cls.isExported && <span style={{ color: 'var(--accent-amber)', marginRight: '0.25rem' }}>export</span>}
                  <span style={{ color: 'var(--accent-violet)', fontWeight: 600 }}>{cls.name}</span>
                  {cls.extends && <span style={{ color: 'var(--ink-muted)' }}> extends {cls.extends}</span>}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>
                  L{cls.lineNumber} ● {cls.methods.length}m {cls.properties.length}p
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '0.35rem 0.55rem 0.55rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {cls.implements.length > 0 && (
                    <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>
                      implements {cls.implements.join(', ')}
                    </p>
                  )}
                  {cls.methods.length > 0 && (
                    <div style={{ marginBottom: '0.3rem' }}>
                      <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>Methods</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.15rem' }}>
                        {cls.methods.map((m) => (
                          <span key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.08rem 0.3rem',
                            borderRadius: 4, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-emerald)' }}>{m}()</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {cls.properties.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>Properties</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.15rem' }}>
                        {cls.properties.map((p) => (
                          <span key={p} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '0.08rem 0.3rem',
                            borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-indigo)' }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
