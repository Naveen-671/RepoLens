import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RepoNode } from '../types';

interface SchemaViewProps {
  nodes: RepoNode[];
  onFileClick: (filePath: string) => void;
}

interface DetectedModel {
  name: string;
  file: string;
  type: 'class' | 'interface' | 'schema';
  fields: Array<{ name: string; type: string }>;
  relationships: string[];
}

/* ─── Detect models/schemas from AST data ─── */
function detectModels(nodes: RepoNode[]): DetectedModel[] {
  const models: DetectedModel[] = [];

  for (const node of nodes) {
    const id = node.id.toLowerCase();
    const isModelFile = /model|schema|entity|migration|prisma|types?\./.test(id);
    const summary = (node.summary ?? '').toLowerCase();
    const isModelSummary = /model|schema|database|entity|interface|type definition/.test(summary);

    if (!isModelFile && !isModelSummary) continue;

    // Extract from classDetails
    if (node.classDetails) {
      for (const cls of node.classDetails) {
        const fields = cls.properties.map((p) => {
          const parts = p.split(':');
          return { name: parts[0]?.trim() ?? p, type: parts[1]?.trim() ?? 'unknown' };
        });
        const rels: string[] = [];
        if (cls.extends) rels.push(`extends ${cls.extends}`);
        if (cls.implements?.length) rels.push(...cls.implements.map((i) => `implements ${i}`));

        models.push({
          name: cls.name,
          file: node.id,
          type: 'class',
          fields,
          relationships: rels,
        });
      }
    }

    // Extract from interfaces
    if (node.interfaces && node.interfaces.length > 0) {
      for (const iface of node.interfaces) {
        models.push({
          name: iface,
          file: node.id,
          type: 'interface',
          fields: [],
          relationships: [],
        });
      }
    }

    // Extract from classes list (fallback)
    if (node.classes && !node.classDetails) {
      for (const cls of node.classes) {
        models.push({
          name: cls,
          file: node.id,
          type: 'class',
          fields: [],
          relationships: [],
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return models.filter((m) => {
    const key = `${m.name}:${m.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ─── Color for type ─── */
function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (/string|text|char|varchar/.test(t)) return '#34d399';
  if (/number|int|float|decimal|bigint/.test(t)) return '#818cf8';
  if (/bool/.test(t)) return '#fbbf24';
  if (/date|time/.test(t)) return '#f472b6';
  if (/\[\]|array|list/.test(t)) return '#22d3ee';
  if (/object|record|map/.test(t)) return '#a78bfa';
  return '#94a3b8';
}

export function SchemaView({ nodes, onFileClick }: SchemaViewProps) {
  const models = useMemo(() => detectModels(nodes), [nodes]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase();
    return models.filter((m) =>
      m.name.toLowerCase().includes(q) || m.file.toLowerCase().includes(q),
    );
  }, [models, searchQuery]);

  const modelsByFile = useMemo(() => {
    const map = new Map<string, DetectedModel[]>();
    for (const m of filteredModels) {
      if (!map.has(m.file)) map.set(m.file, []);
      map.get(m.file)!.push(m);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredModels]);

  const typeIcons = { class: '🏗️', interface: '📋', schema: '🗄️' };

  if (models.length === 0) {
    return (
      <section className="panel p-5" aria-label="schema-view">
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>🗄️</span>
          Data Models & Schemas
        </h2>
        <div style={{
          textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--ink-muted)',
        }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>No data models detected</p>
          <p style={{ fontSize: '0.78rem' }}>
            Models, schemas, and type definitions will appear here when detected in the codebase.
          </p>
        </div>
      </section>
    );
  }

  const selected = selectedModel ? models.find((m) => m.name === selectedModel) : null;

  return (
    <section className="panel p-0 overflow-hidden" aria-label="schema-view">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>🗄️</span>
            Data Models & Schemas
          </h2>
          <span className="stat-badge stat-badge--indigo">{models.length} models</span>
          <span className="stat-badge stat-badge--violet">{modelsByFile.length} files</span>
        </div>
        <input type="text" placeholder="🔍 Search models..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '0.35rem 0.6rem', borderRadius: 8, minWidth: 180,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--ink-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 400 }}>
        {/* Left: Model List */}
        <div style={{ borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', maxHeight: 500, padding: '0.75rem' }}>
          {modelsByFile.map(([file, fileModels], fi) => (
            <motion.div key={file}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: fi * 0.05 }}
              style={{ marginBottom: '0.6rem' }}
            >
              <button onClick={() => onFileClick(file)} style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: 'var(--accent-cyan)', cursor: 'pointer', background: 'none', border: 'none',
                padding: '0.15rem 0', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)',
              }}>
                📄 {file}
              </button>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                {fileModels.map((model) => (
                  <motion.button key={model.name} whileHover={{ x: 3 }}
                    onClick={() => setSelectedModel(selectedModel === model.name ? null : model.name)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                      gap: '0.4rem', padding: '0.45rem 0.6rem', borderRadius: 8,
                      background: selectedModel === model.name ? 'rgba(99,102,241,0.1)' : 'var(--bg-elevated)',
                      border: `1px solid ${selectedModel === model.name ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', color: 'var(--ink-primary)', transition: 'all 200ms',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>{typeIcons[model.type]}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 }}>
                        {model.name}
                      </span>
                      <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.1rem' }}>
                        <span style={{
                          fontSize: '0.55rem', padding: '0.05rem 0.25rem', borderRadius: 3,
                          background: model.type === 'class' ? 'rgba(129,140,248,0.12)' : 'rgba(52,211,153,0.12)',
                          color: model.type === 'class' ? '#818cf8' : '#34d399',
                          fontWeight: 600, textTransform: 'uppercase',
                        }}>{model.type}</span>
                        {model.fields.length > 0 && (
                          <span style={{ fontSize: '0.55rem', color: 'var(--ink-muted)' }}>
                            {model.fields.length} fields
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', transform: selectedModel === model.name ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>▶</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Details */}
        <div style={{ padding: '0.75rem', overflowY: 'auto', maxHeight: 500 }}>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.name}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>{typeIcons[selected.type]}</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', margin: 0 }}>
                      {selected.name}
                    </h3>
                    <button onClick={() => onFileClick(selected.file)} style={{
                      fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}>📄 {selected.file}</button>
                  </div>
                </div>

                {/* Fields Table */}
                {selected.fields.length > 0 && (
                  <div style={{
                    borderRadius: 10, border: '1px solid var(--border-subtle)',
                    overflow: 'hidden', marginBottom: '0.75rem',
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      padding: '0.4rem 0.65rem', background: 'rgba(99,102,241,0.06)',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: 'var(--ink-muted)',
                    }}>
                      <span>Field</span>
                      <span>Type</span>
                    </div>
                    {selected.fields.map((field) => (
                      <div key={field.name} style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        padding: '0.35rem 0.65rem',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-primary)' }}>
                          {field.name}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                          color: typeColor(field.type), fontWeight: 500,
                        }}>
                          {field.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Relationships */}
                {selected.relationships.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>
                      🔗 Relationships
                    </h4>
                    <div style={{ display: 'grid', gap: '0.2rem' }}>
                      {selected.relationships.map((rel, i) => (
                        <div key={i} style={{
                          padding: '0.3rem 0.5rem', borderRadius: 6,
                          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)',
                          fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#a78bfa',
                        }}>{rel}</div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.fields.length === 0 && selected.relationships.length === 0 && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                    Detailed field information not available for this model.
                    <br />Check the source file for full schema definition.
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)' }}
              >
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>👈</span>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Select a model to view details</p>
                <p style={{ fontSize: '0.72rem' }}>Click on any class, interface, or schema to see its fields and relationships.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
