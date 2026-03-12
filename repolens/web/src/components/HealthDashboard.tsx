import React from 'react';
import type { RepoMetrics } from '../types';

interface HealthDashboardProps {
  metrics: RepoMetrics;
  onFileClick: (filePath: string) => void;
}

function healthColor(score: number): string {
  if (score >= 0.85) return 'var(--accent-emerald)';
  if (score >= 0.65) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
}

function healthLabel(score: number): string {
  if (score >= 0.85) return 'Healthy';
  if (score >= 0.65) return 'Moderate';
  return 'Needs Attention';
}

function complexityLabel(avg: number): string {
  if (avg <= 5) return 'Low';
  if (avg <= 15) return 'Moderate';
  if (avg <= 30) return 'High';
  return 'Very High';
}

function complexityColor(avg: number): string {
  if (avg <= 5) return 'var(--accent-emerald)';
  if (avg <= 15) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
}

export function HealthDashboard({ metrics, onFileClick }: HealthDashboardProps) {
  const healthPct = Math.round(metrics.avgHealthScore * 100);

  return (
    <section className="panel p-5" aria-label="health-dashboard">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-emerald)', marginRight: '0.4rem' }}>◈</span>
        Code Health Dashboard
      </h2>

      {/* Top-level metrics grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        marginTop: '1rem',
      }}>
        <MetricCard
          label="Health Score"
          value={`${healthPct}%`}
          detail={healthLabel(metrics.avgHealthScore)}
          color={healthColor(metrics.avgHealthScore)}
        />
        <MetricCard
          label="Total Lines"
          value={formatNumber(metrics.totalLinesOfCode)}
          detail={`${metrics.totalFiles} files`}
          color="var(--accent-indigo)"
        />
        <MetricCard
          label="Avg Complexity"
          value={metrics.avgComplexity.toFixed(1)}
          detail={complexityLabel(metrics.avgComplexity)}
          color={complexityColor(metrics.avgComplexity)}
        />
        <MetricCard
          label="Functions"
          value={String(metrics.totalFunctions)}
          detail={`${metrics.totalClasses} classes`}
          color="var(--accent-violet)"
        />
        <MetricCard
          label="Interfaces"
          value={String(metrics.totalInterfaces)}
          detail="Type definitions"
          color="var(--accent-cyan)"
        />
      </div>

      {/* Complexity Hotspots */}
      {metrics.complexityHotspots.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Complexity Hotspots</h3>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', margin: '0.25rem 0 0.5rem' }}>
            Files with highest cyclomatic complexity — consider refactoring these first.
          </p>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {metrics.complexityHotspots.map((item) => (
              <div
                key={item.file}
                onClick={() => onFileClick(item.file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(251,113,133,0.3)';
                  e.currentTarget.style.background = 'rgba(251,113,133,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--ink-primary)',
                }}>
                  {item.file}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ComplexityBar value={item.complexity} max={Math.max(...metrics.complexityHotspots.map((h) => h.complexity), 1)} />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: item.complexity > 20 ? 'var(--accent-rose)' : item.complexity > 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                    minWidth: 28,
                    textAlign: 'right',
                  }}>
                    {item.complexity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Largest Files */}
      {metrics.largestFiles.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Largest Files</h3>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', margin: '0.25rem 0 0.5rem' }}>
            Top files by lines of code — large files may benefit from splitting.
          </p>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {metrics.largestFiles.map((item) => (
              <div
                key={item.file}
                onClick={() => onFileClick(item.file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                  e.currentTarget.style.background = 'rgba(99,102,241,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--ink-primary)',
                }}>
                  {item.file}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--ink-secondary)',
                }}>
                  {formatNumber(item.lines)} LOC
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, detail, color }: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div style={{
      padding: '0.85rem',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '1.5rem',
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color,
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--ink-muted)',
        marginTop: '0.35rem',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.72rem',
        color,
        fontWeight: 600,
        marginTop: '0.15rem',
      }}>
        {detail}
      </div>
    </div>
  );
}

function ComplexityBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = value > 20 ? 'var(--accent-rose)' : value > 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
  return (
    <div style={{
      width: 60,
      height: 6,
      borderRadius: 3,
      background: 'rgba(148,163,184,0.1)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        borderRadius: 3,
        background: barColor,
        transition: 'width 400ms ease',
      }} />
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
