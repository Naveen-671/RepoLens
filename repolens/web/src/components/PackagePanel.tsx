import React, { useMemo, useState } from 'react';
import type { PackageDependency } from '../types';

interface PackagePanelProps {
  packages: PackageDependency[];
  onFileClick: (filePath: string) => void;
}

export function PackagePanel({ packages, onFileClick }: PackagePanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'production' | 'development'>('all');
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = packages;
    if (filter !== 'all') list = list.filter((p) => p.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [packages, filter, search]);

  const prodCount = packages.filter((p) => p.type === 'production').length;
  const devCount = packages.filter((p) => p.type === 'development').length;
  const unusedCount = packages.filter((p) => p.usageCount === 0).length;
  const mostUsed = [...packages].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);

  if (packages.length === 0) {
    return (
      <section className="panel p-5" aria-label="package-panel">
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>◫</span>
          Package Dependencies
        </h2>
        <p style={{ color: 'var(--ink-muted)', marginTop: '0.75rem', fontSize: '0.82rem' }}>
          No package.json found in the repository.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-5" aria-label="package-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>◫</span>
        Package Dependencies
        <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>
          {packages.length} packages
        </span>
      </h2>

      {/* Summary Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.6rem', marginTop: '0.85rem',
      }}>
        <StatCard label="Production" value={prodCount} color="var(--accent-emerald)" />
        <StatCard label="Development" value={devCount} color="var(--accent-violet)" />
        <StatCard label="Unused" value={unusedCount} color={unusedCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'} />
        <StatCard label="Total" value={packages.length} color="var(--accent-indigo)" />
      </div>

      {/* Most Used Packages */}
      {mostUsed.length > 0 && mostUsed[0].usageCount > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 className="section-title" style={{ fontSize: '0.72rem' }}>📦 Most Used Packages</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
            {mostUsed.map((pkg) => (
              <div key={pkg.name} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.3rem 0.6rem', borderRadius: 6,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                  {pkg.name}
                </span>
                <span style={{
                  fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                  background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                }}>
                  {pkg.usageCount} files
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unused Packages Warning */}
      {unusedCount > 0 && (
        <div style={{
          marginTop: '0.85rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)',
          background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
        }}>
          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-rose)', margin: 0 }}>
            ⚠ {unusedCount} Potentially Unused Package{unusedCount !== 1 ? 's' : ''}
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', margin: '0.2rem 0 0' }}>
            These packages are in package.json but not imported by any analyzed source file. They may be used in config files, scripts, or dynamically.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
            {packages.filter((p) => p.usageCount === 0).slice(0, 15).map((pkg) => (
              <span key={pkg.name} style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.15rem 0.4rem',
                borderRadius: 4, background: 'rgba(251,113,133,0.1)', color: 'var(--accent-rose)',
              }}>
                {pkg.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div style={{
        display: 'flex', gap: '0.35rem', alignItems: 'center', marginTop: '1rem',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search packages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 150, padding: '0.35rem 0.55rem', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--ink-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        {(['all', 'production', 'development'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.3rem 0.55rem', borderRadius: 6, fontSize: '0.7rem',
            border: `1px solid ${filter === f ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
            background: filter === f ? 'rgba(99,102,241,0.12)' : 'transparent',
            color: filter === f ? 'var(--accent-indigo)' : 'var(--ink-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Package List */}
      <div style={{ marginTop: '0.75rem', maxHeight: 400, overflowY: 'auto' }}>
        {filtered.map((pkg) => (
          <div key={pkg.name} style={{ marginBottom: '0.25rem' }}>
            <button
              onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: 6,
                background: expandedPkg === pkg.name ? 'rgba(99,102,241,0.06)' : 'var(--bg-elevated)',
                border: `1px solid ${expandedPkg === pkg.name ? 'rgba(99,102,241,0.2)' : 'var(--border-subtle)'}`,
                cursor: 'pointer', color: 'var(--ink-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>{pkg.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>{pkg.version}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4,
                  background: pkg.type === 'production' ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)',
                  color: pkg.type === 'production' ? 'var(--accent-emerald)' : 'var(--accent-violet)',
                  fontWeight: 600,
                }}>
                  {pkg.type === 'production' ? 'prod' : 'dev'}
                </span>
                <span style={{
                  fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: pkg.usageCount > 0 ? 'var(--accent-indigo)' : 'var(--accent-rose)',
                }}>
                  {pkg.usageCount > 0 ? `${pkg.usageCount} files` : 'unused'}
                </span>
              </div>
            </button>
            {expandedPkg === pkg.name && pkg.usedBy.length > 0 && (
              <div style={{
                marginLeft: '1rem', marginTop: '0.2rem', padding: '0.4rem 0.55rem',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>
                  Used by:
                </p>
                {pkg.usedBy.slice(0, 10).map((f) => (
                  <button key={f} onClick={() => onFileClick(f)} style={{
                    display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                    color: 'var(--accent-indigo)', cursor: 'pointer', border: 'none',
                    background: 'none', padding: '0.1rem 0', textDecoration: 'underline',
                  }}>
                    {f}
                  </button>
                ))}
                {pkg.usedBy.length > 10 && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                    +{pkg.usedBy.length - 10} more files
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '0.55rem', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{value}</div>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.1rem' }}>
        {label}
      </div>
    </div>
  );
}
