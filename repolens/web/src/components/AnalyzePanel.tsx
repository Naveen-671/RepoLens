import React, { useState } from 'react';
import { analyzeRepoFromUi } from '../api';

interface AnalyzePanelProps {
  onAnalysisComplete: (repoId: string) => void;
}

export function AnalyzePanel({ onAnalysisComplete }: AnalyzePanelProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setStatus('Cloning and analyzing repository...');

    try {
      const result = await analyzeRepoFromUi(repoUrl.trim());
      setStatus('Analysis complete! Loading visualization...');
      onAnalysisComplete(result.repoId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const exampleRepos = [
    { label: 'Express.js', url: 'https://github.com/expressjs/express' },
    { label: 'Fastify', url: 'https://github.com/fastify/fastify' },
    { label: 'Koa', url: 'https://github.com/koajs/koa' },
  ];

  return (
    <section className="panel p-5" aria-label="analyze-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-indigo)', marginRight: '0.4rem' }}>◈</span>
        Analyze a Repository
      </h2>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
        Paste a GitHub URL to analyze its architecture, dependencies, and code health.
      </p>

      <form onSubmit={handleSubmit} style={{
        display: 'flex', gap: '0.5rem', marginTop: '1rem',
        padding: '0.5rem', background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
      }}>
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={loading}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
            padding: '0.4rem 0.5rem',
          }}
        />
        <button type="submit" disabled={loading || !repoUrl.trim()} style={{
          background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
          color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 1.2rem', fontWeight: 700, fontSize: '0.8rem',
          fontFamily: 'var(--font-sans)', cursor: loading ? 'wait' : 'pointer',
          transition: 'all 200ms', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {/* Quick examples */}
      {!loading && !status && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', alignSelf: 'center' }}>Try:</span>
          {exampleRepos.map((repo) => (
            <button
              key={repo.label}
              className="small-btn"
              onClick={() => setRepoUrl(repo.url)}
              style={{ fontSize: '0.72rem' }}
            >
              {repo.label}
            </button>
          ))}
        </div>
      )}

      {status && (
        <div style={{
          marginTop: '0.75rem', padding: '0.65rem 0.85rem',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 'var(--radius-sm)', color: 'var(--accent-indigo)', fontSize: '0.82rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          {loading && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
          {status}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '0.75rem', padding: '0.65rem 0.85rem',
          background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)',
          borderRadius: 'var(--radius-sm)', color: 'var(--accent-rose)', fontSize: '0.82rem',
        }}>
          {error}
        </div>
      )}
    </section>
  );
}
