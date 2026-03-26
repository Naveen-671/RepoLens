import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';

interface GuidedStep {
  stepNumber: number;
  title: string;
  explanation: string;
  keyFiles: string[];
  analogy?: string;
}

interface GuidedLearningProps {
  repoId: string;
  onFileClick: (path: string) => void;
}

const LEARNING_TOPICS = [
  { id: 'full overview', icon: '🎯', label: 'Full Project Overview', desc: 'Understand what this project does and why' },
  { id: 'tech stack', icon: '🛠️', label: 'Tech Stack & Packages', desc: 'Languages, frameworks, and tools used' },
  { id: 'architecture', icon: '🏗️', label: 'Architecture & Structure', desc: 'How the code is organized and connected' },
  { id: 'data flow', icon: '🔀', label: 'Data Flow & Processing', desc: 'How data moves through the application' },
  { id: 'api and routes', icon: '🌐', label: 'API & Routes', desc: 'HTTP endpoints and request handling' },
  { id: 'database and models', icon: '🗄️', label: 'Database & Models', desc: 'Data storage and schema design' },
  { id: 'authentication', icon: '🔐', label: 'Authentication & Security', desc: 'How users are verified and protected' },
  { id: 'testing', icon: '🧪', label: 'Testing Strategy', desc: 'How the codebase is tested' },
];

const STEP_COLORS = [
  'var(--accent-indigo)',
  'var(--accent-cyan)',
  'var(--accent-emerald)',
  'var(--accent-violet)',
  'var(--accent-amber)',
  'var(--accent-rose)',
  'var(--accent-indigo)',
];

export function GuidedLearning({ repoId, onFileClick }: GuidedLearningProps) {
  const [steps, setSteps] = useState<GuidedStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const loadTopic = async (topic: string) => {
    setLoading(true);
    setError(null);
    setSelectedTopic(topic);
    setSteps([]);
    setActiveStep(0);
    setCompletedSteps(new Set());

    try {
      const res = await fetch(`${API_BASE}/guided-learning/${encodeURIComponent(repoId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error('Failed to generate learning guide');
      const json = (await res.json()) as { steps: GuidedStep[] };
      setSteps(json.steps ?? []);
    } catch {
      setError('Could not generate learning guide. Ensure the AI service is configured with a valid API key.');
    } finally {
      setLoading(false);
    }
  };

  const markComplete = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepNum);
      return next;
    });
    if (stepNum < steps.length - 1) {
      setActiveStep(stepNum + 1);
    }
  };

  const progress = steps.length > 0 ? Math.round((completedSteps.size / steps.length) * 100) : 0;

  return (
    <section className="panel p-0 overflow-hidden" aria-label="guided-learning" style={{ minHeight: 600 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
        background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(99,102,241,0.06) 100%)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(99,102,241,0.2) 100%)',
          fontSize: '1.15rem',
        }}>🎓</div>
        <div style={{ flex: 1 }}>
          <h2 className="panel-title" style={{ margin: 0 }}>Guided Learning</h2>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', margin: 0 }}>
            Step-by-step visual breakdown of the codebase
          </p>
        </div>
        {steps.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 80, height: 6, borderRadius: 3, background: 'var(--bg-surface)',
              overflow: 'hidden',
            }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  height: '100%', borderRadius: 3,
                  background: 'linear-gradient(90deg, var(--accent-emerald), var(--accent-cyan))',
                }}
              />
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              {progress}%
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '1.1rem' }}>
        {/* Topic Selection */}
        {!selectedTopic && !loading && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink-primary)', marginBottom: '0.4rem' }}>
                What would you like to learn?
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
                Choose a topic and I&apos;ll create a step-by-step visual guide to help you understand this codebase.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem', maxWidth: 700, margin: '0 auto' }}>
              {LEARNING_TOPICS.map((topic, i) => (
                <motion.button key={topic.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.03, y: -3 }} whileTap={{ scale: 0.97 }}
                  onClick={() => void loadTopic(topic.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                    padding: '0.85rem 1rem', borderRadius: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    cursor: 'pointer', color: 'var(--ink-primary)', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', transition: 'all 200ms',
                  }}
                >
                  <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: '0.1rem' }}>{topic.icon}</span>
                  <div>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem' }}>{topic.label}</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: '0.15rem', lineHeight: 1.45 }}>
                      {topic.desc}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '3rem 1rem' }}
          >
            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 4, margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '0.4rem' }}>
              Generating your learning guide...
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              AI is analyzing the codebase and creating a step-by-step breakdown
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              {['📖 Reading code', '🧠 Understanding patterns', '✏️ Writing guide'].map((s, i) => (
                <motion.span key={s}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.8 }}
                  style={{
                    padding: '0.3rem 0.6rem', borderRadius: 8,
                    background: 'rgba(99,102,241,0.08)', fontSize: '0.7rem',
                    color: 'var(--accent-indigo)', fontWeight: 600,
                  }}
                >{s}</motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '1rem', borderRadius: 12, marginTop: '0.5rem',
            background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
          }}>
            <p style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.85rem' }}>⚠ {error}</p>
            <button onClick={() => { setSelectedTopic(null); setError(null); }}
              style={{
                marginTop: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                color: 'var(--ink-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
              }}
            >← Choose another topic</button>
          </div>
        )}

        {/* Steps Display */}
        {steps.length > 0 && !loading && (
          <div>
            {/* Topic header + back button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => { setSelectedTopic(null); setSteps([]); setCompletedSteps(new Set()); }}
                style={{
                  padding: '0.35rem 0.65rem', borderRadius: 8,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  color: 'var(--ink-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem',
                }}
              >← Topics</button>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink-primary)', margin: 0 }}>
                {LEARNING_TOPICS.find((t) => t.id === selectedTopic)?.icon}{' '}
                {LEARNING_TOPICS.find((t) => t.id === selectedTopic)?.label ?? selectedTopic}
              </h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
                {steps.length} steps
              </span>
            </div>

            {/* Step timeline + content */}
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '0' }}>
              {steps.map((step, i) => {
                const isActive = activeStep === i;
                const isCompleted = completedSteps.has(i);
                const stepColor = STEP_COLORS[i % STEP_COLORS.length];

                return (
                  <React.Fragment key={i}>
                    {/* Timeline node */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <motion.button
                        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setActiveStep(i)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isCompleted
                            ? 'var(--accent-emerald)'
                            : isActive
                              ? stepColor
                              : 'var(--bg-elevated)',
                          border: `2px solid ${isCompleted ? 'var(--accent-emerald)' : isActive ? stepColor : 'var(--border-subtle)'}`,
                          color: isCompleted || isActive ? '#fff' : 'var(--ink-muted)',
                          fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                          transition: 'all 250ms',
                          boxShadow: isActive ? `0 0 12px ${stepColor}40` : 'none',
                        }}
                      >
                        {isCompleted ? '✓' : step.stepNumber}
                      </motion.button>
                      {i < steps.length - 1 && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 20,
                          background: isCompleted
                            ? 'var(--accent-emerald)'
                            : 'var(--border-subtle)',
                          transition: 'background 300ms',
                        }} />
                      )}
                    </div>

                    {/* Step content */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      style={{ paddingBottom: i < steps.length - 1 ? '0.85rem' : 0, paddingLeft: '0.5rem' }}
                    >
                      <button onClick={() => setActiveStep(i)} style={{
                        display: 'block', width: '100%', cursor: 'pointer',
                        background: 'none', border: 'none', textAlign: 'left', padding: 0,
                      }}>
                        <h4 style={{
                          fontSize: '0.88rem', fontWeight: 700, margin: '0.25rem 0 0.15rem',
                          color: isActive ? stepColor : isCompleted ? 'var(--accent-emerald)' : 'var(--ink-primary)',
                          transition: 'color 200ms',
                        }}>
                          {step.title}
                        </h4>
                      </button>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{
                              padding: '0.85rem 1rem', borderRadius: 12, marginTop: '0.35rem',
                              background: `${stepColor}08`,
                              border: `1px solid ${stepColor}20`,
                            }}>
                              {/* Explanation */}
                              <p style={{
                                fontSize: '0.84rem', lineHeight: 1.75, color: 'var(--ink-secondary)',
                                margin: '0 0 0.65rem',
                              }}>
                                {step.explanation}
                              </p>

                              {/* Analogy */}
                              {step.analogy && (
                                <div style={{
                                  display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                                  padding: '0.6rem 0.75rem', borderRadius: 10,
                                  background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)',
                                  marginBottom: '0.65rem',
                                }}>
                                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
                                  <div>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-emerald)', letterSpacing: '0.05em' }}>
                                      Real-world analogy
                                    </span>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', margin: '0.2rem 0 0', lineHeight: 1.6 }}>
                                      {step.analogy}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Key Files */}
                              {step.keyFiles.length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', letterSpacing: '0.05em' }}>
                                    📂 Key Files
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                                    {step.keyFiles.map((f) => (
                                      <motion.button key={f} whileHover={{ scale: 1.04 }}
                                        onClick={() => onFileClick(f)}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                                          padding: '0.25rem 0.55rem', borderRadius: 7,
                                          background: `${stepColor}10`,
                                          border: `1px solid ${stepColor}25`,
                                          color: stepColor, cursor: 'pointer',
                                          fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600,
                                        }}
                                      >📄 {f.split('/').pop()}</motion.button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Mark complete */}
                              <motion.button
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => markComplete(i)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                                  marginTop: '0.75rem', padding: '0.45rem 0.85rem', borderRadius: 9,
                                  background: isCompleted
                                    ? 'rgba(52,211,153,0.1)' : `${stepColor}15`,
                                  border: `1px solid ${isCompleted ? 'rgba(52,211,153,0.3)' : `${stepColor}30`}`,
                                  color: isCompleted ? 'var(--accent-emerald)' : stepColor,
                                  cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem',
                                  fontFamily: 'var(--font-sans)',
                                }}
                              >
                                {isCompleted ? '✅ Completed' : '✓ I understand, next step'}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Completion celebration */}
            <AnimatePresence>
              {completedSteps.size === steps.length && steps.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{
                    textAlign: 'center', padding: '1.5rem', marginTop: '1rem',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(99,102,241,0.08) 100%)',
                    border: '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🎉</div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '0.3rem' }}>
                    Topic Complete!
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '0.75rem' }}>
                    You&apos;ve completed all {steps.length} steps. Try another topic to keep learning!
                  </p>
                  <button onClick={() => { setSelectedTopic(null); setSteps([]); setCompletedSteps(new Set()); }}
                    style={{
                      padding: '0.5rem 1.2rem', borderRadius: 10,
                      background: 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-sans)',
                    }}
                  >📚 Explore more topics</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
