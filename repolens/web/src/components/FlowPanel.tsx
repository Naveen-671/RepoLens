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

/**
 * Renders animated request-flow controls and export tools.
 */
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
    if (!activeFlow) {
      return;
    }

    const labels = activeFlow.steps
      .map((step, index) => `<text x="20" y="${40 + index * 24}" font-size="14">${index + 1}. ${step.nodeId}</text>`)
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480"><rect width="100%" height="100%" fill="#f8fafc"/>${labels}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${repoId}-flow.svg`);
  };

  const recordWebm = async () => {
    if (!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream)) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    if (!context || !activeFlow) {
      return;
    }

    const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.start();

    for (let index = 0; index < activeFlow.steps.length; index += 1) {
      context.fillStyle = '#f8fafc';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#0f172a';
      context.font = '20px sans-serif';
      context.fillText('RepoLens Request Flow', 20, 40);
      context.font = '16px sans-serif';
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
    if (!activeFlow) {
      return;
    }
    setStepIndex((previous) => (previous + 1) % activeFlow.steps.length);
  };

  const stepBack = () => {
    if (!activeFlow) {
      return;
    }
    setStepIndex((previous) => (previous - 1 + activeFlow.steps.length) % activeFlow.steps.length);
  };

  return (
    <section className="panel p-5 mt-4" aria-label="flow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title">Request Flow Animation</h2>
        <div className="flex gap-2">
          <button className="small-btn" onClick={exportSvg}>
            Export SVG
          </button>
          <button className="small-btn" onClick={() => void recordWebm()}>
            Record GIF/webm
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <select
          value={activeFlowId}
          onChange={(event) => {
            setActiveFlowId(event.target.value);
            setStepIndex(0);
          }}
          className="border rounded-md px-2 py-1"
        >
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>

        <button className="small-btn" onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="small-btn" onClick={stepBack}>
          Step Back
        </button>
        <button className="small-btn" onClick={stepForward}>
          Step Forward
        </button>

        <label className="text-sm text-slate-700">
          Speed
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="ml-2"
          />
          <span className="ml-1">{speed.toFixed(1)}x</span>
        </label>
      </div>

      <motion.div
        className="rounded-lg border border-amber-300 bg-amber-50 p-3 mt-3"
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <p className="text-sm font-semibold text-amber-900">Current Step</p>
        <p className="critical-file mt-1">{currentStep?.nodeId ?? 'No flow available'}</p>
        <p className="text-sm text-slate-700 mt-1">{currentStep?.summary ?? 'Generate flows to view request journey.'}</p>
      </motion.div>

      {activeFlow ? (
        <ol className="mt-3 space-y-1 text-sm list-decimal list-inside">
          {activeFlow.steps.map((step, index) => {
            const isActive = index === stepIndex;
            return (
              <li key={`${step.nodeId}:${index}`} className={isActive ? 'text-amber-700 font-semibold' : 'text-slate-700'}>
                {step.nodeId}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-slate-600 mt-3">No flows available yet.</p>
      )}
    </section>
  );
}

/**
 * Downloads a blob URL as a file.
 */
function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/**
 * Wait helper used by frame-capture recording fallback.
 */
async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
