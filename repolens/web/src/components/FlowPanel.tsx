import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface FlowStep {
  nodeId: string;
  summary: string;
}

interface FlowDefinition {
  id: string;
  name: string;
  entryPoint: string;
  steps: FlowStep[];
}

interface FlowPanelProps {
  repoId: string;
  onStepNodeChange: (nodeId: string) => void;
}

export function FlowPanel({ repoId, onStepNodeChange }: FlowPanelProps) {
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string>('');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [generating, setGenerating] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const applyFlows = (loadedFlows: FlowDefinition[]) => {
    setFlows(loadedFlows);
    setActiveFlowId(loadedFlows[0]?.id ?? '');
    setStepIndex(0);
  };

  const generateFlows = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/repo-flows/${encodeURIComponent(repoId)}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = (await res.json()) as { flows?: FlowDefinition[] };
        applyFlows(json.flows ?? []);
      }
    } catch { /* ignore */ }
    setGenerating(false);
  }, [repoId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/repo-flows/${encodeURIComponent(repoId)}`);
        const json = (await res.json()) as { flows?: FlowDefinition[] };
        const loadedFlows = json.flows ?? [];
        if (loadedFlows.length > 0) {
          applyFlows(loadedFlows);
        } else {
          await generateFlows();
        }
      } catch {
        await generateFlows();
      }
    })();
  }, [repoId, generateFlows]);

  const activeFlow = useMemo(
    () => flows.find((flow) => flow.id === activeFlowId) ?? flows[0] ?? null,
    [flows, activeFlowId],
  );

  useEffect(() => {
    if (!playing || !activeFlow) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setStepIndex((previous) => {
        const next = (previous + 1) % activeFlow.steps.length;
        onStepNodeChange(activeFlow.steps[next].nodeId);
        return next;
      });
    }, Math.max(300, 900 / speed));

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, activeFlow, speed, onStepNodeChange]);

  useEffect(() => {
    if (activeFlow?.steps[stepIndex]) {
      onStepNodeChange(activeFlow.steps[stepIndex].nodeId);
    }
  }, [activeFlow, stepIndex, onStepNodeChange]);

  const currentStep = activeFlow?.steps[stepIndex] ?? null;

  const exportSvg = () => {
    if (!activeFlow) return;
    const labels = activeFlow.steps
      .map((step, index) => `<text x="20" y="${40 + index * 24}" font-size="14" fill="#f1f5f9">${index + 1}. ${step.nodeId}</text>`)
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480"><rect width="100%" height="100%" fill="#0b0f1a" rx="12"/><text x="20" y="24" font-size="16" fill="#818cf8" font-weight="bold">RepoLens Flow</text>${labels}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${repoId}-flow.svg`);
  };

  const recordWebm = async () => {
    if (!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream)) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    if (!context || !activeFlow) return;

    const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.start();
    for (let index = 0; index < activeFlow.steps.length; index += 1) {
      context.fillStyle = '#0b0f1a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#818cf8';
      context.font = 'bold 20px Inter, sans-serif';
      context.fillText('RepoLens Request Flow', 20, 40);
      context.fillStyle = '#f1f5f9';
      context.font = '16px JetBrains Mono, monospace';
      context.fillText(`${index + 1}. ${activeFlow.steps[index].nodeId}`, 20, 90);
      await delay(250);
    }
    recorder.stop();
    await delay(250);
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${repoId}-flow.webm`);
  };

  const stepForward = () => {
    if (!activeFlow) return;
    setStepIndex((p) => (p + 1) % activeFlow.steps.length);
  };

  const stepBack = () => {
    if (!activeFlow) return;
    setStepIndex((p) => (p - 1 + activeFlow.steps.length) % activeFlow.steps.length);
  };

  return (
    <section className="panel p-5" aria-label="flow-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>▸</span>
          Request Flow Animation
        </h2>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button className="small-btn" onClick={exportSvg}>Export SVG</button>
          <button className="small-btn" onClick={() => void recordWebm()}>Record</button>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center',
        marginTop: '1rem', padding: '0.6rem 0.75rem',
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}>
        <select
          value={activeFlowId}
          onChange={(e) => { setActiveFlowId(e.target.value); setStepIndex(0); }}
          style={{
            background: 'var(--bg-surface)', color: 'var(--ink-primary)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.5rem', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
          }}
        >
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>{flow.name}</option>
          ))}
        </select>

        <button className="small-btn" onClick={() => setPlaying((v) => !v)} style={playing ? {
          background: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.3)', color: 'var(--accent-amber)',
        } : {}}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="small-btn" onClick={stepBack}>◂ Back</button>
        <button className="small-btn" onClick={stepForward}>Next ▸</button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
          Speed
          <input type="range" min={0.5} max={2} step={0.1} value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: 70, accentColor: 'var(--accent-indigo)' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)', fontWeight: 600 }}>
            {speed.toFixed(1)}x
          </span>
        </label>
      </div>

      {/* Current Step Highlight */}
      <motion.div
        key={currentStep?.nodeId ?? 'none'}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          marginTop: '1rem',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(99,102,241,0.3)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(167,139,250,0.06))',
          borderLeft: '3px solid var(--accent-indigo)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--accent-indigo)',
              boxShadow: '0 0 12px var(--accent-indigo)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step {stepIndex + 1}{activeFlow ? ` of ${activeFlow.steps.length}` : ''}
          </span>
          {playing && <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)', fontWeight: 600 }}>PLAYING</span>}
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-primary)', marginTop: '0.4rem', fontWeight: 600 }}>
          {currentStep?.nodeId ?? 'No flow available'}
        </p>
        {currentStep?.summary && (
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
            {currentStep.summary}
          </p>
        )}
      </motion.div>

      {/* Visual Flow Graph */}
      {activeFlow ? (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            overflowX: 'auto', padding: '0.75rem 0.5rem',
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            {activeFlow.steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isPast = index < stepIndex;
              return (
                <React.Fragment key={`${step.nodeId}:${index}`}>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setStepIndex(index)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: 8,
                      background: isActive
                        ? 'rgba(99,102,241,0.2)'
                        : isPast
                        ? 'rgba(52,211,153,0.1)'
                        : 'var(--bg-surface)',
                      border: `1.5px solid ${
                        isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--border-subtle)'
                      }`,
                      boxShadow: isActive ? '0 0 12px rgba(99,102,241,0.2)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 200ms',
                      flexShrink: 0,
                      minWidth: 60,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 700, color: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--ink-muted)',
                      marginBottom: '0.15rem',
                    }}>
                      {index + 1}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                      color: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--ink-secondary)' : 'var(--ink-muted)',
                      fontWeight: isActive ? 600 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: 120,
                    }}>
                      {step.nodeId.split('/').pop()}
                    </div>
                  </motion.div>
                  {index < activeFlow.steps.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: index * 0.05 + 0.03 }}
                      style={{
                        width: 28, height: 2, flexShrink: 0,
                        background: isPast ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        position: 'absolute', right: -3, top: -3,
                        width: 0, height: 0,
                        borderTop: '4px solid transparent',
                        borderBottom: '4px solid transparent',
                        borderLeft: `6px solid ${isPast ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
                      }} />
                    </motion.div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step Details List */}
          <div style={{ marginTop: '0.85rem', maxHeight: 320, overflowY: 'auto' }}>
            {activeFlow.steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isPast = index < stepIndex;
              return (
                <motion.div
                  key={`detail-${step.nodeId}:${index}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => setStepIndex(index)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
                    padding: '0.55rem 0.75rem',
                    cursor: 'pointer',
                    borderLeft: `2px solid ${isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
                    background: isActive ? 'rgba(99,102,241,0.04)' : 'transparent',
                    transition: 'all 200ms',
                    marginBottom: '0.15rem',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700,
                    color: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--ink-muted)',
                    minWidth: 20,
                  }}>
                    {index + 1}.
                  </span>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                      color: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--ink-primary)' : 'var(--ink-muted)',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {step.nodeId}
                    </div>
                    {step.summary && step.summary !== 'No summary available.' && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                        {step.summary}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ink-muted)' }}>
          {generating ? (
            <>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Generating request flows...</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>No flows generated yet for this repository.</p>
              <button className="small-btn" onClick={() => void generateFlows()} style={{
                background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)',
                color: 'var(--accent-indigo)', padding: '0.5rem 1.2rem', fontSize: '0.82rem',
              }}>
                ▸ Generate Request Flows
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => { setTimeout(resolve, ms); });
}
