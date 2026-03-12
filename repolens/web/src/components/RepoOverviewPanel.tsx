import React from 'react';
import type { RepoOverview, RepoMetrics, RepoSummaryResponse } from '../types';

interface RepoOverviewPanelProps {
  overview: RepoOverview | undefined;
  metrics: RepoMetrics | undefined;
  summary: RepoSummaryResponse;
  onFileClick: (filePath: string) => void;
}

const langColors: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f7df1e', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  'C#': '#178600', 'C++': '#f34b7d', C: '#555555', Swift: '#F05138',
  Kotlin: '#A97BFF', PHP: '#4F5D95', Vue: '#41b883', Svelte: '#ff3e00',
  Dart: '#00B4AB',
};

function LanguageBar({ languages }: { languages: Array<{ name: string; percentage: number }> }) {
  if (languages.length === 0) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{
        display: 'flex', borderRadius: 6, overflow: 'hidden', height: 10,
        border: '1px solid var(--border-subtle)',
      }}>
        {languages.map((lang) => (
          <div
            key={lang.name}
            title={`${lang.name}: ${lang.percentage}%`}
            style={{
              width: `${lang.percentage}%`,
              background: langColors[lang.name] ?? 'var(--accent-indigo)',
              minWidth: lang.percentage > 0 ? 3 : 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.5rem' }}>
        {languages.map((lang) => (
          <div key={lang.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: langColors[lang.name] ?? 'var(--accent-indigo)',
            }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
              {lang.name}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{lang.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 6,
      background: `${color}18`, border: `1px solid ${color}30`, color,
      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

export function RepoOverviewPanel({ overview, metrics, summary, onFileClick }: RepoOverviewPanelProps) {
  return (
    <section className="panel p-5" aria-label="repo-overview-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-indigo)', marginRight: '0.4rem' }}>◈</span>
        Repository Overview
      </h2>

      {/* Purpose */}
      <div style={{
        marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(34,211,238,0.06))',
        border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ color: 'var(--ink-primary)', fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 500 }}>
          {overview?.purpose || 'Analyzing repository purpose...'}
        </p>
      </div>

      {/* Quick stats row */}
      {metrics && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '0.6rem', marginTop: '1rem',
        }}>
          {[
            { label: 'Files', value: metrics.totalFiles, color: 'var(--accent-indigo)' },
            { label: 'Lines', value: metrics.totalLinesOfCode >= 1000 ? `${(metrics.totalLinesOfCode / 1000).toFixed(1)}K` : metrics.totalLinesOfCode, color: 'var(--accent-emerald)' },
            { label: 'Functions', value: metrics.totalFunctions, color: 'var(--accent-cyan)' },
            { label: 'Classes', value: metrics.totalClasses, color: 'var(--accent-violet)' },
            { label: 'Complexity', value: metrics.avgComplexity.toFixed(1), color: metrics.avgComplexity > 15 ? 'var(--accent-rose)' : 'var(--accent-amber)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: '0.6rem', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: stat.color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {overview && overview.languages.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Languages</h3>
          <LanguageBar languages={overview.languages} />
        </div>
      )}

      {/* Tech Stack & Frameworks */}
      {overview && (overview.techStack.length > 0 || overview.frameworks.length > 0) && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Tech Stack</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
            {[...new Set([...(overview.techStack ?? []), ...(overview.frameworks ?? [])])].map((tech) => (
              <TechChip key={tech} label={tech} color="var(--accent-indigo)" />
            ))}
          </div>
        </div>
      )}

      {/* Build Tools */}
      {overview && overview.buildTools.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 className="section-title">Build & Tooling</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
            {overview.buildTools.map((tool) => (
              <TechChip key={tool} label={tool} color="var(--accent-amber)" />
            ))}
          </div>
        </div>
      )}

      {/* Architecture */}
      <div style={{ marginTop: '1.25rem' }}>
        <h3 className="section-title">Architecture</h3>
        <div style={{
          marginTop: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="stat-badge stat-badge--violet" style={{ textTransform: 'capitalize' }}>
              {summary.architectureType}
            </span>
          </div>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            {summary.explanation}
          </p>
        </div>
      </div>

      {/* Directory Structure */}
      {overview && overview.directoryPurposes.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Directory Structure</h3>
          <div style={{ marginTop: '0.5rem' }}>
            {overview.directoryPurposes.map((dir) => (
              <div key={dir.directory} style={{
                display: 'flex', gap: '0.5rem', padding: '0.45rem 0',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'baseline',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-cyan)',
                  fontWeight: 600, minWidth: '8rem', flexShrink: 0,
                }}>
                  {dir.directory}/
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  {dir.purpose}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry Points */}
      {overview && overview.entryPoints.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Entry Points</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
            {overview.entryPoints.map((entry) => (
              <button key={entry} onClick={() => onFileClick(entry)} style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '0.25rem 0.6rem',
                borderRadius: 6, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                color: 'var(--accent-emerald)', cursor: 'pointer', transition: 'all 200ms',
              }}>
                {entry}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Key Insights */}
      {overview && overview.keyInsights.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Key Insights</h3>
          <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.4rem' }}>
            {overview.keyInsights.map((insight, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.5rem', padding: '0.5rem 0.65rem',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)', fontSize: '0.82rem',
                color: 'var(--ink-secondary)', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--accent-amber)', flexShrink: 0, fontWeight: 700 }}>▸</span>
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Clusters */}
      {summary.featureClusters.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Feature Clusters ({summary.featureClusters.length})</h3>
          <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.4rem' }}>
            {summary.featureClusters.map((cluster) => (
              <div key={cluster.name} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              }}>
                <span className="cluster-chip">{cluster.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{cluster.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
