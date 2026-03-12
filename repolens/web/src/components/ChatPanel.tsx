import React, { useState } from 'react';

interface ChatSource {
  path: string;
  excerpt: string;
}

interface ChatResult {
  answer: string;
  sources: ChatSource[];
  confidence: number;
  used_files: string[];
}

interface ChatPanelProps {
  repoId: string;
  onOpenFile: (path: string) => void;
}

export function ChatPanel({ repoId, onOpenFile }: ChatPanelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ query: string; result: ChatResult }>>([]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/chat/${encodeURIComponent(repoId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 10 }),
      });
      if (!response.ok) throw new Error('Chat request failed');
      const json = (await response.json()) as ChatResult;
      setResult(json);
      setHistory((prev) => [...prev, { query, result: json }]);
      setQuery('');
    } catch {
      setError('Chat service unavailable. To enable AI chat, set the LLM_API_KEY environment variable (supports Groq, OpenAI, or NVIDIA NIM). Create a .env file in the project root with:\n\nLLM_API_KEY=your-api-key\nLLM_PROVIDER=groq');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'How does authentication work?',
    'What are the main entry points?',
    'Which files handle data flow?',
  ];

  return (
    <section className="panel p-5" aria-label="chat-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>◎</span>
        Ask AI about this repository
      </h2>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
        Ask questions about architecture, features, and code organization.
      </p>

      {/* Suggestion chips */}
      {!result && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
          {suggestions.map((s) => (
            <button key={s} className="small-btn" onClick={() => setQuery(s)}
              style={{ fontSize: '0.72rem' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{
        display: 'flex', gap: '0.5rem', marginTop: '1rem',
        padding: '0.5rem', background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about repository architecture or feature locations..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem',
            padding: '0.4rem 0.5rem',
          }}
        />
        <button type="submit" disabled={loading} style={{
          background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
          color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 1.2rem', fontWeight: 700, fontSize: '0.8rem',
          fontFamily: 'var(--font-sans)', cursor: loading ? 'wait' : 'pointer',
          transition: 'all 200ms', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div style={{
          marginTop: '0.75rem', padding: '0.85rem 1rem',
          background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)',
          borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
        }}>
          <p style={{ color: 'var(--accent-rose)', fontWeight: 600, marginBottom: '0.5rem' }}>⚠ AI Chat Unavailable</p>
          <p style={{ color: 'var(--ink-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            To enable AI-powered chat, configure an API key:
          </p>
          <div style={{
            marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: 6,
            background: 'var(--bg-surface)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            color: 'var(--accent-cyan)', lineHeight: 1.8,
          }}>
            # Create .env file in project root<br />
            LLM_API_KEY=your-api-key<br />
            LLM_PROVIDER=groq  <span style={{ color: 'var(--ink-muted)' }}># groq | openai | nim</span>
          </div>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Get a free API key from <span style={{ color: 'var(--accent-indigo)' }}>console.groq.com</span>
          </p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          {/* Confidence badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <span className={`stat-badge ${result.confidence > 0.7 ? 'stat-badge--emerald' : 'stat-badge--amber'}`}>
              {(result.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>

          {/* Answer */}
          <div style={{
            padding: '1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            color: 'var(--ink-primary)', fontSize: '0.88rem', lineHeight: 1.6,
          }}>
            {result.answer}
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3 className="section-title">Referenced Files</h3>
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                {result.sources.map((source) => (
                  <div key={`${source.path}:${source.excerpt.slice(0, 30)}`} style={{
                    padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="critical-file">{source.path}</span>
                      <button className="small-btn" onClick={() => onOpenFile(source.path)}
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                        View
                      </button>
                    </div>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.78rem', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                      {source.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
