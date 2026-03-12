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

/**
 * Renders repository onboarding chat and source-linked answers.
 */
export function ChatPanel({ repoId, onOpenFile }: ChatPanelProps) {
  const [query, setQuery] = useState('Where is authentication?');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/chat/${encodeURIComponent(repoId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, topK: 10 }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const json = (await response.json()) as ChatResult;
      setResult(json);
    } catch {
      setError('Chat service unavailable. Try again after generating AI artifacts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel p-5 mt-4" aria-label="chat-panel">
      <h2 className="panel-title">Onboarding Chat</h2>
      <form className="mt-3 flex flex-col md:flex-row gap-2" onSubmit={submit}>
        <input
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask about repository architecture or feature locations"
        />
        <button className="rounded-lg bg-slate-900 text-white px-4 py-2 font-semibold" disabled={loading}>
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error ? <p className="text-red-700 mt-2">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm text-slate-600">Confidence: {result.confidence.toFixed(2)}</p>
            <p className="mt-1 text-slate-900">{result.answer}</p>
          </div>

          <h3 className="section-title">Sources</h3>
          <ul className="space-y-2">
            {result.sources.map((source) => (
              <li key={`${source.path}:${source.excerpt}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="critical-file">{source.path}</p>
                <p className="text-sm text-slate-700 mt-1">{source.excerpt}</p>
                <button
                  className="mt-2 text-sm rounded-md border border-slate-300 px-2 py-1"
                  onClick={() => onOpenFile(source.path)}
                >
                  Open file
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
