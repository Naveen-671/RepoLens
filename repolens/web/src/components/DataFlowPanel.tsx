import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import type { RepoNode, RepoEdge, FunctionFlowEdge } from '../types';

/* ─── Props ─── */
interface DataFlowPanelProps {
  nodes: RepoNode[];
  edges: RepoEdge[];
  functionFlowEdges: FunctionFlowEdge[];
  onFileClick: (filePath: string) => void;
}

/* ─── Devicon map for package detection ─── */
const pkgIconMap: Record<string, string> = {
  react: 'devicon-react-original colored', express: 'devicon-express-original',
  typescript: 'devicon-typescript-plain colored', mongodb: 'devicon-mongodb-plain colored',
  postgresql: 'devicon-postgresql-plain colored', prisma: 'devicon-prisma-original',
  tailwindcss: 'devicon-tailwindcss-original colored', vite: 'devicon-vitejs-plain colored',
  nextjs: 'devicon-nextjs-plain', vue: 'devicon-vuejs-plain colored',
  angular: 'devicon-angularjs-plain colored', django: 'devicon-django-plain',
  flask: 'devicon-flask-original', redis: 'devicon-redis-plain colored',
  docker: 'devicon-docker-plain colored', graphql: 'devicon-graphql-plain colored',
  jest: 'devicon-jest-plain colored', vitest: 'devicon-vitest-plain colored',
  webpack: 'devicon-webpack-plain colored', nodejs: 'devicon-nodejs-plain colored',
};

function getPkgIcon(name: string): string | null {
  const key = name.toLowerCase().replace(/[@/\s]/g, '').replace(/\.js$/, '');
  return pkgIconMap[key] ?? null;
}

/* ─── Classify file by its role ─── */
function classifyFile(id: string, node: RepoNode): { role: string; color: string; icon: string } {
  const lower = id.toLowerCase();
  const summary = (node.summary ?? '').toLowerCase();

  if (/route|controller|handler|endpoint|api/.test(lower) || /route|endpoint|api handler/.test(summary))
    return { role: 'API / Route', color: '#818cf8', icon: '🌐' };
  if (/service|usecase|logic|business/.test(lower) || /service|business logic/.test(summary))
    return { role: 'Service', color: '#34d399', icon: '⚙️' };
  if (/model|schema|entity|migration|prisma|database|db/.test(lower) || /database|model|schema/.test(summary))
    return { role: 'Data / Model', color: '#fbbf24', icon: '🗄️' };
  if (/middleware|auth|guard|interceptor/.test(lower) || /middleware|authentication/.test(summary))
    return { role: 'Middleware', color: '#fb7185', icon: '🛡️' };
  if (/util|helper|lib|common|shared/.test(lower) || /utility|helper/.test(summary))
    return { role: 'Utility', color: '#a78bfa', icon: '🔧' };
  if (/test|spec|__test__|\.test\.|\.spec\./.test(lower))
    return { role: 'Test', color: '#64748b', icon: '🧪' };
  if (/component|page|view|screen|layout|ui/.test(lower) || /ui|component|render/.test(summary))
    return { role: 'UI / View', color: '#22d3ee', icon: '🎨' };
  if (/config|env|setting/.test(lower))
    return { role: 'Config', color: '#94a3b8', icon: '⚙️' };
  if (/index|main|app|server|entry/.test(lower))
    return { role: 'Entry Point', color: '#f472b6', icon: '🚀' };
  return { role: 'Module', color: '#64748b', icon: '📄' };
}

/* ─── Custom Node component ─── */
interface FlowNodeData {
  label: string;
  fullPath: string;
  role: string;
  color: string;
  icon: string;
  summary: string;
  functions: string[];
  classes: string[];
  linesOfCode: number;
  complexity: number;
  healthScore: number;
  externalImports: string[];
  dataFlowIn: string[];
  dataFlowOut: string[];
  incoming: number;
  outgoing: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onFileClick: (path: string) => void;
}

function FlowNodeComponent({ data, id }: { data: FlowNodeData; id: string }) {
  const expanded = data.isExpanded;

  return (
    <div
      onClick={() => data.onToggleExpand(id)}
      style={{
        background: expanded ? 'rgba(17,24,39,0.98)' : 'rgba(17,24,39,0.92)',
        border: `2px solid ${data.color}`,
        borderRadius: 16,
        padding: expanded ? '1rem' : '0.65rem 0.85rem',
        minWidth: expanded ? 340 : 180,
        maxWidth: expanded ? 420 : 220,
        cursor: 'pointer',
        boxShadow: expanded
          ? `0 0 30px ${data.color}33, 0 12px 40px rgba(0,0,0,0.5)`
          : `0 4px 16px rgba(0,0,0,0.3)`,
        transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{
        background: data.color, border: 'none', width: 8, height: 8,
      }} />
      <Handle type="source" position={Position.Right} style={{
        background: data.color, border: 'none', width: 8, height: 8,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: expanded ? '1.2rem' : '0.9rem' }}>{data.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: expanded ? '0.82rem' : '0.72rem',
            fontWeight: 700, color: '#f1f5f9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{data.label}</div>
          <div style={{
            fontSize: '0.58rem', fontWeight: 600,
            color: data.color, textTransform: 'uppercase', letterSpacing: '0.08em',
            marginTop: '0.1rem',
          }}>{data.role}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.55rem', color: '#34d399', fontFamily: "'JetBrains Mono', monospace" }}>↓{data.incoming}</span>
          <span style={{ fontSize: '0.55rem', color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>↑{data.outgoing}</span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: `1px solid ${data.color}33` }}>
          {data.summary && (
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.55, margin: '0 0 0.65rem' }}>
              {data.summary}
            </p>
          )}

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {data.linesOfCode > 0 && (
              <span style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 600 }}>
                {data.linesOfCode} LOC
              </span>
            )}
            {data.complexity > 0 && (
              <span style={{
                fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 6,
                background: data.complexity > 10 ? 'rgba(251,113,133,0.12)' : 'rgba(52,211,153,0.12)',
                color: data.complexity > 10 ? '#fb7185' : '#34d399', fontWeight: 600,
              }}>⚡ {data.complexity}</span>
            )}
            {data.healthScore > 0 && (
              <span style={{
                fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 6,
                background: data.healthScore >= 0.8 ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                color: data.healthScore >= 0.8 ? '#34d399' : '#fbbf24', fontWeight: 600,
              }}>♥ {Math.round(data.healthScore * 100)}%</span>
            )}
          </div>

          {/* Functions */}
          {data.functions.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.25rem' }}>
                ⚡ Functions ({data.functions.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                {data.functions.slice(0, 8).map((fn) => (
                  <span key={fn} style={{ fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace", padding: '0.12rem 0.35rem', borderRadius: 4, background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                    {fn}()
                  </span>
                ))}
                {data.functions.length > 8 && (
                  <span style={{ fontSize: '0.58rem', color: '#64748b' }}>+{data.functions.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Classes */}
          {data.classes.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.25rem' }}>
                🏗️ Classes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                {data.classes.map((cls) => (
                  <span key={cls} style={{ fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace", padding: '0.12rem 0.35rem', borderRadius: 4, background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External Imports */}
          {data.externalImports.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.25rem' }}>
                📦 Packages Used
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {data.externalImports.slice(0, 10).map((imp) => {
                  const icon = getPkgIcon(imp);
                  return (
                    <span key={imp} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace", padding: '0.12rem 0.4rem', borderRadius: 4, background: 'rgba(34,211,238,0.08)', color: '#22d3ee' }}>
                      {icon && <i className={icon} style={{ fontSize: '0.7rem' }} />}
                      {imp}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data Flow */}
          {(data.dataFlowIn.length > 0 || data.dataFlowOut.length > 0) && (
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.25rem' }}>
                🔀 Data Flow
              </div>
              {data.dataFlowIn.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.2rem' }}>
                  {data.dataFlowIn.slice(0, 5).map((d) => (
                    <span key={d} style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
                      ← {d.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}
              {data.dataFlowOut.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {data.dataFlowOut.slice(0, 5).map((d) => (
                    <span key={d} style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(99,102,241,0.08)', color: '#818cf8' }}>
                      → {d.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); data.onFileClick(data.fullPath); }}
            style={{
              marginTop: '0.6rem', width: '100%', padding: '0.4rem', borderRadius: 8,
              border: `1px solid ${data.color}44`, background: `${data.color}15`,
              color: data.color, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", transition: 'all 200ms',
            }}
          >View in Architecture →</button>
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent as NodeTypes[string],
};

/* ─── Layout (topological layering) ─── */
function layoutNodes(
  repoNodes: RepoNode[], repoEdges: RepoEdge[], expandedNodes: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  const bwd = new Map<string, Set<string>>();

  for (const n of repoNodes) {
    inDeg.set(n.id, 0);
    outDeg.set(n.id, 0);
    bwd.set(n.id, new Set());
  }
  for (const e of repoEdges) {
    bwd.get(e.target)?.add(e.source);
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  // Topological layering
  const layers: string[][] = [];
  const assigned = new Set<string>();
  const remaining = new Set(repoNodes.map((n) => n.id));

  while (remaining.size > 0) {
    const layer: string[] = [];
    for (const id of remaining) {
      if ([...(bwd.get(id) ?? [])].every((d) => assigned.has(d))) {
        layer.push(id);
      }
    }
    if (layer.length === 0) layer.push([...remaining][0]);
    for (const id of layer) {
      remaining.delete(id);
      assigned.add(id);
    }
    layer.sort((a, b) => (outDeg.get(b) ?? 0) - (outDeg.get(a) ?? 0));
    layers.push(layer);
  }

  const LAYER_GAP_X = 320;
  const NODE_GAP_Y = 140;
  const EXPANDED_GAP_Y = 320;
  const nodeMap = new Map(repoNodes.map((n) => [n.id, n]));
  const flowNodes: Node[] = [];

  for (let col = 0; col < layers.length; col++) {
    const layer = layers[col];
    const totalHeight = layer.reduce((sum, id) => sum + (expandedNodes.has(id) ? EXPANDED_GAP_Y : NODE_GAP_Y), 0);
    let y = -totalHeight / 2;

    for (const id of layer) {
      const n = nodeMap.get(id);
      if (!n) continue;
      const info = classifyFile(id, n);
      const isExp = expandedNodes.has(id);

      flowNodes.push({
        id,
        type: 'flowNode',
        position: { x: col * LAYER_GAP_X, y },
        data: {
          label: id.split('/').pop() ?? id,
          fullPath: id,
          role: info.role,
          color: info.color,
          icon: info.icon,
          summary: n.summary ?? '',
          functions: n.functions ?? [],
          classes: n.classes ?? [],
          linesOfCode: n.linesOfCode ?? 0,
          complexity: n.complexity ?? 0,
          healthScore: n.healthScore ?? 0,
          externalImports: n.externalImports ?? [],
          dataFlowIn: n.dataFlowIn ?? [],
          dataFlowOut: n.dataFlowOut ?? [],
          incoming: inDeg.get(id) ?? 0,
          outgoing: outDeg.get(id) ?? 0,
          isExpanded: isExp,
        },
      });

      y += isExp ? EXPANDED_GAP_Y : NODE_GAP_Y;
    }
  }

  const flowEdges: Edge[] = repoEdges.map((e) => {
    const srcNode = nodeMap.get(e.source);
    const info = srcNode ? classifyFile(e.source, srcNode) : { color: '#64748b' };
    return {
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: info.color, width: 14, height: 14 },
      style: { stroke: info.color, strokeWidth: 2, opacity: 0.6 },
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}

/* ─── Role Legend ─── */
const ROLE_LEGEND = [
  { role: 'Entry Point', color: '#f472b6', icon: '🚀' },
  { role: 'API / Route', color: '#818cf8', icon: '🌐' },
  { role: 'Service', color: '#34d399', icon: '⚙️' },
  { role: 'Middleware', color: '#fb7185', icon: '🛡️' },
  { role: 'Data / Model', color: '#fbbf24', icon: '🗄️' },
  { role: 'UI / View', color: '#22d3ee', icon: '🎨' },
  { role: 'Utility', color: '#a78bfa', icon: '🔧' },
  { role: 'Config', color: '#94a3b8', icon: '⚙️' },
  { role: 'Test', color: '#64748b', icon: '🧪' },
];

/* ─── Main Component ─── */
export function DataFlowPanel({ nodes, edges, functionFlowEdges, onFileClick }: DataFlowPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'graph' | 'layers' | 'roles'>('graph');
  const [highlightRole, setHighlightRole] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSelectedFile(id);
  }, []);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => layoutNodes(nodes, edges, expandedNodes),
    [nodes, edges, expandedNodes],
  );

  const augmentedNodes = useMemo(() =>
    flowNodes.map((n) => ({
      ...n,
      data: { ...n.data, onToggleExpand, onFileClick },
    })),
    [flowNodes, onToggleExpand, onFileClick],
  );

  const filteredNodes = useMemo(() => {
    if (!highlightRole) return augmentedNodes;
    return augmentedNodes.map((n) => ({
      ...n,
      style: { ...n.style, opacity: n.data.role === highlightRole ? 1 : 0.15 },
    }));
  }, [augmentedNodes, highlightRole]);

  const adjacency = useMemo(() => {
    if (!selectedFile) return { incoming: [] as string[], outgoing: [] as string[] };
    const inc: string[] = [];
    const out: string[] = [];
    for (const e of edges) {
      if (e.target === selectedFile) inc.push(e.source);
      if (e.source === selectedFile) out.push(e.target);
    }
    return { incoming: inc, outgoing: out };
  }, [selectedFile, edges]);

  const circularDeps = useMemo(() => {
    const fwd = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!fwd.has(e.source)) fwd.set(e.source, new Set());
      fwd.get(e.source)!.add(e.target);
    }
    const cycles: string[][] = [];
    for (const e of edges) {
      if (fwd.get(e.target)?.has(e.source)) {
        const key = [e.source, e.target].sort().join('|');
        if (!cycles.some((c) => [...c].sort().join('|') === key)) {
          cycles.push([e.source, e.target]);
        }
      }
    }
    return cycles;
  }, [edges]);

  const fnChains = useMemo(() => {
    if (functionFlowEdges.length === 0) return [];
    const fnEdgeMap = new Map<string, FunctionFlowEdge[]>();
    for (const e of functionFlowEdges) {
      if (!fnEdgeMap.has(e.sourceFile)) fnEdgeMap.set(e.sourceFile, []);
      fnEdgeMap.get(e.sourceFile)!.push(e);
    }
    const chains: Array<{ files: string[]; functions: string[]; desc: string }> = [];
    for (const [, outEdges] of fnEdgeMap) {
      for (const edge of outEdges.slice(0, 2)) {
        const chain = [edge];
        let current = edge.targetFile;
        const visited = new Set([edge.sourceFile, current]);
        for (let i = 0; i < 4; i++) {
          const next = (fnEdgeMap.get(current) ?? []).find((e) => !visited.has(e.targetFile));
          if (!next) break;
          chain.push(next);
          visited.add(next.targetFile);
          current = next.targetFile;
        }
        if (chain.length >= 2) {
          chains.push({
            files: [edge.sourceFile, ...chain.map((e) => e.targetFile)],
            functions: [chain[0].source, ...chain.map((e) => e.target)],
            desc: `${chain[0].source}() → ${chain.map((e) => e.target + '()').join(' → ')}`,
          });
        }
      }
    }
    return chains.sort((a, b) => b.functions.length - a.functions.length).slice(0, 8);
  }, [functionFlowEdges]);

  const roleDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
      const { role } = classifyFile(n.id, n);
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([role, count]) => ({ role, count, info: ROLE_LEGEND.find((r) => r.role === role) }))
      .sort((a, b) => b.count - a.count);
  }, [nodes]);

  const selectedNode = selectedFile ? nodes.find((n) => n.id === selectedFile) : null;

  return (
    <section className="panel p-0 overflow-hidden" aria-label="data-flow-panel" style={{ minHeight: 700 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 className="panel-title">
            <span style={{ color: 'var(--accent-cyan)', marginRight: '0.4rem' }}>🔀</span>
            Data Flow Graph
          </h2>
          <span className="stat-badge stat-badge--indigo">{nodes.length} files</span>
          <span className="stat-badge stat-badge--emerald">{edges.length} edges</span>
          {circularDeps.length > 0 && (
            <span className="stat-badge stat-badge--rose">⚠ {circularDeps.length} circular</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {([
            { key: 'graph' as const, label: '🔗 Graph' },
            { key: 'layers' as const, label: '📊 Layers' },
            { key: 'roles' as const, label: '🏷️ By Role' },
          ]).map((v) => (
            <button key={v.key} onClick={() => setViewMode(v.key)} style={{
              padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.72rem',
              cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-sans)',
              border: viewMode === v.key ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
              background: viewMode === v.key ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: viewMode === v.key ? 'var(--accent-indigo)' : 'var(--ink-muted)',
              transition: 'all 200ms',
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Role Filter */}
      <div style={{
        display: 'flex', gap: '0.35rem', padding: '0.5rem 1.1rem',
        borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filter:
        </span>
        <button onClick={() => setHighlightRole(null)} style={{
          padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.65rem', cursor: 'pointer',
          border: !highlightRole ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
          background: !highlightRole ? 'rgba(99,102,241,0.12)' : 'transparent',
          color: !highlightRole ? 'var(--accent-indigo)' : 'var(--ink-muted)',
          fontWeight: 600, fontFamily: 'var(--font-sans)',
        }}>All</button>
        {ROLE_LEGEND.map((r) => (
          <button key={r.role} onClick={() => setHighlightRole(highlightRole === r.role ? null : r.role)} style={{
            padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.65rem', cursor: 'pointer',
            border: highlightRole === r.role ? `1px solid ${r.color}` : '1px solid var(--border-subtle)',
            background: highlightRole === r.role ? `${r.color}20` : 'transparent',
            color: highlightRole === r.role ? r.color : 'var(--ink-muted)',
            fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 200ms',
          }}>{r.icon} {r.role}</button>
        ))}
      </div>

      {/* Graph View */}
      {viewMode === 'graph' && (
        <div style={{ height: 560 }}>
          <ReactFlow
            nodes={filteredNodes} edges={flowEdges} nodeTypes={nodeTypes}
            fitView minZoom={0.1} maxZoom={2} nodesDraggable
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap nodeStrokeWidth={3} zoomable pannable
              nodeColor={(node: { data?: { color?: string } }) => node.data?.color ?? '#64748b'}
              maskColor="rgba(11,15,26,0.7)"
            />
            <Controls />
            <Background color="#1e293b" gap={24} size={1} />
          </ReactFlow>
        </div>
      )}

      {/* Layers View */}
      {viewMode === 'layers' && (
        <div style={{ padding: '1.25rem', maxHeight: 560, overflowY: 'auto' }}>
          <LayersView nodes={nodes} edges={edges} onToggleExpand={onToggleExpand}
            selectedFile={selectedFile}
          />
        </div>
      )}

      {/* Roles View */}
      {viewMode === 'roles' && (
        <div style={{ padding: '1.25rem', maxHeight: 560, overflowY: 'auto' }}>
          <RolesView nodes={nodes} onFileClick={(id) => { setSelectedFile(id); onFileClick(id); }} />
        </div>
      )}

      {/* Bottom Panel */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        display: 'grid', gridTemplateColumns: selectedFile ? '1fr 1fr' : '1fr', gap: 0,
      }}>
        <AnimatePresence>
          {selectedFile && selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ padding: '1rem 1.25rem', borderRight: '1px solid var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{classifyFile(selectedFile, selectedNode).icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                  {selectedFile}
                </span>
              </div>
              {selectedNode.summary && (
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: '0 0 0.6rem' }}>
                  {selectedNode.summary}
                </p>
              )}
              {adjacency.incoming.length > 0 && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                    Imported by ({adjacency.incoming.length}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                    {adjacency.incoming.slice(0, 6).map((f) => (
                      <button key={f} onClick={() => onFileClick(f)} style={{
                        fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.12rem 0.35rem',
                        borderRadius: 4, background: 'rgba(52,211,153,0.08)', color: 'var(--accent-emerald)',
                        border: 'none', cursor: 'pointer',
                      }}>{f.split('/').pop()}</button>
                    ))}
                  </div>
                </div>
              )}
              {adjacency.outgoing.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase' }}>
                    Imports ({adjacency.outgoing.length}):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                    {adjacency.outgoing.slice(0, 6).map((f) => (
                      <button key={f} onClick={() => onFileClick(f)} style={{
                        fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0.12rem 0.35rem',
                        borderRadius: 4, background: 'rgba(99,102,241,0.08)', color: 'var(--accent-indigo)',
                        border: 'none', cursor: 'pointer',
                      }}>{f.split('/').pop()}</button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Function Chains + Roles */}
        <div style={{ padding: '1rem 1.25rem' }}>
          <h3 style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', margin: '0 0 0.5rem' }}>
            ⛓ Function Call Chains ({fnChains.length})
          </h3>
          {fnChains.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {fnChains.slice(0, 5).map((chain, i) => (
                <div key={i} style={{ padding: '0.45rem 0.6rem', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                    {chain.functions.map((fn, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>→</span>}
                        <button onClick={() => onFileClick(chain.files[j])} style={{
                          padding: '0.1rem 0.3rem', borderRadius: 4,
                          background: 'rgba(52,211,153,0.1)', border: 'none',
                          color: 'var(--accent-emerald)', cursor: 'pointer',
                          fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                        }}>{fn}()</button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                    {chain.files.map((f) => f.split('/').pop()).join(' → ')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>No cross-file function call chains detected.</p>
          )}

          <h3 style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', margin: '0.85rem 0 0.4rem' }}>
            🏷️ File Role Distribution
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {roleDistribution.map((r) => (
              <div key={r.role} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', borderRadius: 6,
                background: `${r.info?.color ?? '#64748b'}15`,
                border: `1px solid ${r.info?.color ?? '#64748b'}33`,
              }}>
                <span style={{ fontSize: '0.7rem' }}>{r.info?.icon}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: r.info?.color ?? '#64748b' }}>{r.role}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.info?.color ?? '#64748b' }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Layers View ─── */
function LayersView({ nodes, edges, onToggleExpand, selectedFile }: {
  nodes: RepoNode[]; edges: RepoEdge[];
  onToggleExpand: (id: string) => void;
  selectedFile: string | null;
}) {
  const layers = useMemo(() => {
    const bwd = new Map<string, Set<string>>();
    for (const n of nodes) bwd.set(n.id, new Set());
    for (const e of edges) bwd.get(e.target)?.add(e.source);
    const result: Array<{ depth: number; files: RepoNode[] }> = [];
    const assigned = new Set<string>();
    const remaining = new Set(nodes.map((n) => n.id));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let depth = 0;
    while (remaining.size > 0) {
      const layer: string[] = [];
      for (const id of remaining) {
        if ([...(bwd.get(id) ?? [])].every((d) => assigned.has(d))) layer.push(id);
      }
      if (layer.length === 0) layer.push([...remaining][0]);
      for (const id of layer) { remaining.delete(id); assigned.add(id); }
      result.push({ depth, files: layer.map((id) => nodeMap.get(id)!).filter(Boolean) });
      depth++;
    }
    return result;
  }, [nodes, edges]);

  const layerLabels = ['Entry', 'Controllers', 'Services', 'Utilities', 'Data', 'Config'];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {layers.map((layer, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          style={{ padding: '0.85rem', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)', padding: '0.15rem 0.4rem', borderRadius: 4, background: 'rgba(34,211,238,0.1)' }}>
              Layer {i}
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-muted)' }}>{layerLabels[i] ?? `Depth ${i}`}</span>
            <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>({layer.files.length} files)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {layer.files.map((file) => {
              const info = classifyFile(file.id, file);
              const isSelected = selectedFile === file.id;
              return (
                <motion.button key={file.id} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                  onClick={() => onToggleExpand(file.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.35rem 0.6rem', borderRadius: 8,
                    background: isSelected ? `${info.color}20` : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? info.color : 'var(--border-subtle)'}`,
                    color: isSelected ? info.color : 'var(--ink-primary)',
                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                    fontWeight: 600, transition: 'all 200ms',
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}>{info.icon}</span>
                  {file.id.split('/').pop()}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Roles View ─── */
function RolesView({ nodes, onFileClick }: { nodes: RepoNode[]; onFileClick: (path: string) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ node: RepoNode; info: ReturnType<typeof classifyFile> }>>();
    for (const n of nodes) {
      const info = classifyFile(n.id, n);
      if (!map.has(info.role)) map.set(info.role, []);
      map.get(info.role)!.push({ node: n, info });
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [nodes]);

  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {grouped.map(([role, files], i) => {
        const info = files[0]?.info;
        const isExpanded = expandedRole === role;
        return (
          <motion.div key={role}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${info?.color ?? 'var(--border-subtle)'}33`, background: 'var(--bg-elevated)' }}
          >
            <button onClick={() => setExpandedRole(isExpanded ? null : role)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1rem', cursor: 'pointer',
                background: `${info?.color ?? '#64748b'}10`,
                border: 'none', borderBottom: isExpanded ? `1px solid ${info?.color ?? '#64748b'}33` : 'none',
                color: 'var(--ink-primary)', fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{info?.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1, textAlign: 'left' }}>{role}</span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: info?.color ?? '#64748b', padding: '0.15rem 0.5rem', borderRadius: 6,
                background: `${info?.color ?? '#64748b'}15`,
              }}>{files.length}</span>
              <span style={{
                fontSize: '0.75rem', color: 'var(--ink-muted)',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms',
              }}>▶</span>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '0.6rem 1rem', display: 'grid', gap: '0.3rem' }}>
                    {files.map(({ node }) => (
                      <motion.button key={node.id} whileHover={{ x: 4 }} onClick={() => onFileClick(node.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem', borderRadius: 8,
                          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                          cursor: 'pointer', color: 'var(--ink-primary)',
                          fontFamily: 'var(--font-mono)', fontSize: '0.72rem', width: '100%', textAlign: 'left',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.id}</span>
                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          {(node.linesOfCode ?? 0) > 0 && <span style={{ fontSize: '0.58rem', color: 'var(--ink-muted)' }}>{node.linesOfCode} LOC</span>}
                          {(node.functions?.length ?? 0) > 0 && <span style={{ fontSize: '0.58rem', color: 'var(--accent-emerald)' }}>{node.functions!.length} fn</span>}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
