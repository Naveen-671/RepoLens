import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    void fetch(`/repo-flows/${encodeURIComponent(repoId)}`)
      .then((response) => response.json())
      .then((json: { flows?: FlowDefinition[] }) => {
        const loadedFlows = json.flows ?? [];
        setFlows(loadedFlows);
        setActiveFlowId(loadedFlows[0]?.id ?? '');
      })
      .catch(() => {
        setFlows([]);
      });
  }, [repoId]);

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
        style={{
          marginTop: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(99,102,241,0.25)',
          background: 'rgba(99,102,241,0.06)',
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent-indigo)',
            boxShadow: '0 0 8px var(--accent-indigo)',
          }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step {stepIndex + 1}{activeFlow ? ` of ${activeFlow.steps.length}` : ''}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--ink-primary)', marginTop: '0.35rem' }}>
          {currentStep?.nodeId ?? 'No flow available'}
        </p>
      </motion.div>

      {/* Step Timeline */}
      {activeFlow ? (
        <div style={{ marginTop: '1rem' }}>
          {activeFlow.steps.map((step, index) => {
            const isActive = index === stepIndex;
            const isPast = index < stepIndex;
            return (
              <div key={`${step.nodeId}:${index}`} style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                padding: '0.4rem 0',
                cursor: 'pointer',
              }}
              onClick={() => setStepIndex(index)}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20,
                }}>
                  <div style={{
                    width: isActive ? 12 : 8, height: isActive ? 12 : 8,
                    borderRadius: '50%',
                    background: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--bg-elevated)',
                    border: `2px solid ${isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--ink-muted)'}`,
                    boxShadow: isActive ? '0 0 10px var(--accent-indigo)' : 'none',
                    transition: 'all 200ms',
                  }} />
                  {index < activeFlow.steps.length - 1 && (
                    <div style={{
                      width: 2, height: 20,
                      background: isPast ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                      transition: 'background 200ms',
                    }} />
                  )}
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  color: isActive ? 'var(--accent-indigo)' : isPast ? 'var(--accent-emerald)' : 'var(--ink-muted)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'color 200ms',
                }}>
                  {step.nodeId}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--ink-muted)', marginTop: '1rem', fontSize: '0.85rem' }}>No flows available yet.</p>
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
