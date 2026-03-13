import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  confidence?: number;
  thinking?: string[];
  timestamp: Date;
}

interface ChatPanelProps {
  repoId: string;
  onOpenFile: (path: string) => void;
}

const AGENT_SUGGESTIONS = [
  { icon: '�', text: 'Explain this project step by step for a beginner', category: 'Learning' },
  { icon: '🏗️', text: 'What is the architecture and how do the layers connect?', category: 'Architecture' },
  { icon: '🔀', text: 'Trace the data flow from user request to response', category: 'Data Flow' },
  { icon: '📦', text: 'What are the key packages and why were they chosen?', category: 'Dependencies' },
  { icon: '🚀', text: 'Where does the application start and what happens first?', category: 'Entry Points' },
  { icon: '🔐', text: 'How does authentication and security work?', category: 'Security' },
  { icon: '🧪', text: 'How is testing set up and what does it cover?', category: 'Testing' },
  { icon: '⚡', text: 'What design patterns are used in this codebase?', category: 'Patterns' },
];

export function ChatPanel({ repoId, onOpenFile }: ChatPanelProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingSteps]);

  const submit = async (questionText?: string) => {
    const text = questionText ?? query;
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setQuery('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate thinking steps for agent feel
    const steps = [
      '🔍 Searching relevant files...',
      '📖 Reading source code...',
      '🧠 Analyzing patterns...',
      '✍️ Composing answer...',
    ];
    setThinkingSteps([]);

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
      setThinkingSteps((prev) => [...prev, steps[i]]);
    }

    try {
      const response = await fetch(`/chat/${encodeURIComponent(repoId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, topK: 10 }),
      });
      if (!response.ok) throw new Error('Chat request failed');
      const json = (await response.json()) as ChatResult;

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: json.answer,
        sources: json.sources,
        confidence: json.confidence,
        thinking: steps,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError('AI agent unavailable. Configure an API key to enable intelligent analysis.');
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I couldn\'t process that request. Please ensure the AI service is configured.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setThinkingSteps([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <section className="panel p-0 overflow-hidden" aria-label="chat-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 600 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(52,211,153,0.2) 100%)',
          fontSize: '1.1rem',
        }}>🤖</div>
        <div>
          <h2 className="panel-title" style={{ margin: 0 }}>
            RepoLens AI Agent
          </h2>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', margin: 0 }}>
            Ask anything about architecture, patterns, and code organization
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: loading ? 'var(--accent-amber)' : 'var(--accent-emerald)',
            animation: loading ? 'pulseGlow 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
            {loading ? 'Analyzing...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.1rem', maxHeight: 450 }}>
        {/* Welcome State */}
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '2rem 0' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧠</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink-primary)', marginBottom: '0.4rem' }}>
              Repository Intelligence Agent
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', maxWidth: 420, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
              I analyze the entire codebase to answer questions about architecture, data flow, dependencies, and patterns.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem', maxWidth: 600, margin: '0 auto' }}>
              {AGENT_SUGGESTIONS.map((s) => (
                <motion.button key={s.text} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => void submit(s.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.55rem 0.75rem', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    cursor: 'pointer', color: 'var(--ink-primary)',
                    fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600,
                    textAlign: 'left', transition: 'all 200ms',
                  }}
                >
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <span style={{ display: 'block' }}>{s.text}</span>
                    <span style={{ fontSize: '0.58rem', color: 'var(--ink-muted)', fontWeight: 500 }}>{s.category}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message List */}
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: '0.85rem',
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {/* User message */}
              {msg.role === 'user' && (
                <div style={{
                  maxWidth: '80%', padding: '0.65rem 0.95rem', borderRadius: 14,
                  borderBottomRightRadius: 4,
                  background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
                  color: '#fff', fontSize: '0.85rem', lineHeight: 1.55, fontWeight: 500,
                }}>
                  {msg.content}
                </div>
              )}

              {/* Assistant message */}
              {msg.role === 'assistant' && (
                <div style={{ maxWidth: '90%', width: '100%' }}>
                  {/* Confidence badge */}
                  {msg.confidence !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.8rem' }}>🤖</span>
                      <span className={`stat-badge ${msg.confidence > 0.7 ? 'stat-badge--emerald' : 'stat-badge--amber'}`}>
                        {(msg.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  )}

                  <div style={{
                    padding: '0.85rem 1rem', borderRadius: 14, borderBottomLeftRadius: 4,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    color: 'var(--ink-primary)', fontSize: '0.85rem', lineHeight: 1.7,
                  }}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} style={{ margin: line ? '0.25rem 0' : '0.5rem 0' }}>{line}</p>
                    ))}
                  </div>

                  {/* Referenced Files */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                        📎 Referenced ({msg.sources.length})
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {msg.sources.map((s) => (
                          <motion.button key={`${s.path}:${s.excerpt.slice(0, 20)}`}
                            whileHover={{ scale: 1.04 }}
                            onClick={() => onOpenFile(s.path)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.25rem',
                              padding: '0.25rem 0.5rem', borderRadius: 6,
                              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                              color: 'var(--accent-indigo)', cursor: 'pointer',
                              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600,
                            }}
                          >
                            📄 {s.path.split('/').pop()}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <span style={{ fontSize: '0.55rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking Animation */}
        <AnimatePresence>
          {loading && thinkingSteps.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                padding: '0.65rem 0.85rem', borderRadius: 12,
                background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.2)',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                {thinkingSteps.map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      fontSize: '0.72rem', color: 'var(--accent-indigo)',
                      fontWeight: 500,
                    }}
                  >
                    {step}
                  </motion.div>
                ))}
                <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.15rem' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-indigo)',
                      animation: `pulseGlow 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Error Banner */}
      {error && !loading && messages.length <= 1 && (
        <div style={{
          margin: '0 1.1rem', padding: '0.75rem 0.85rem', borderRadius: 10,
          background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
        }}>
          <p style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.35rem' }}>
            ⚠ AI Agent Unavailable
          </p>
          <div style={{
            padding: '0.5rem 0.65rem', borderRadius: 6,
            background: 'var(--bg-surface)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            color: 'var(--accent-cyan)', lineHeight: 1.8,
          }}>
            # .env in project root<br />
            LLM_PROVIDER=nim  <span style={{ color: 'var(--ink-muted)' }}># nim (NVIDIA) | groq | openai</span><br />
            NVIDIA_API_KEY=nvapi-your-key <span style={{ color: 'var(--ink-muted)' }}># or GROQ_API_KEY</span>
          </div>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.68rem', marginTop: '0.35rem' }}>
            Get a free API key from <span style={{ color: 'var(--accent-indigo)' }}>build.nvidia.com</span> or <span style={{ color: 'var(--accent-indigo)' }}>console.groq.com</span>
          </p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex', gap: '0.5rem', padding: '0.75rem 1.1rem',
        borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about architecture, data flow, patterns..."
          disabled={loading}
          style={{
            flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, outline: 'none', padding: '0.55rem 0.75rem',
            color: 'var(--ink-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem',
            transition: 'border-color 200ms',
          }}
        />
        <button type="submit" disabled={loading || !query.trim()} style={{
          background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
          color: '#fff', border: 'none', borderRadius: 10,
          padding: '0.55rem 1.4rem', fontWeight: 700, fontSize: '0.82rem',
          fontFamily: 'var(--font-sans)', cursor: loading ? 'wait' : 'pointer',
          transition: 'all 200ms', opacity: loading || !query.trim() ? 0.5 : 1,
        }}>
          {loading ? '⏳' : '🚀 Ask'}
        </button>
      </form>
    </section>
  );
}
