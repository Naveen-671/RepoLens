import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PackageDependency } from '../types';

interface PackagePanelProps {
  packages: PackageDependency[];
  onFileClick: (filePath: string) => void;
}

/* ─── Package Categories & Icons ─── */
const PKG_CATEGORIES: Record<string, { label: string; icon: string; color: string; keywords: string[] }> = {
  framework: { label: 'Frameworks', icon: '🏗️', color: '#818cf8', keywords: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastify', 'hono', 'nest', 'django', 'flask', 'rails', 'spring'] },
  database: { label: 'Database & ORM', icon: '🗄️', color: '#fbbf24', keywords: ['prisma', 'mongoose', 'sequelize', 'typeorm', 'knex', 'drizzle', 'mongodb', 'pg', 'mysql', 'redis', 'sqlite', 'better-sqlite'] },
  ai: { label: 'AI & ML', icon: '🧠', color: '#f472b6', keywords: ['openai', 'langchain', '@langchain', 'anthropic', '@google/generative', 'groq', 'huggingface', 'tensorflow', 'torch', 'ollama', 'ai', 'cohere'] },
  ui: { label: 'UI & Styling', icon: '🎨', color: '#22d3ee', keywords: ['tailwind', 'shadcn', 'radix', 'chakra', 'mui', 'material', 'antd', 'styled-component', 'emotion', 'sass', 'postcss', 'framer-motion', 'lucide', 'heroicon'] },
  testing: { label: 'Testing', icon: '🧪', color: '#a78bfa', keywords: ['jest', 'vitest', 'mocha', 'chai', 'cypress', 'playwright', 'testing-library', 'supertest', 'msw', 'sinon'] },
  build: { label: 'Build & Dev Tools', icon: '⚙️', color: '#94a3b8', keywords: ['vite', 'webpack', 'esbuild', 'rollup', 'turbo', 'tsup', 'swc', 'babel', 'eslint', 'prettier', 'typescript', 'ts-node', 'nodemon', 'tsx'] },
  auth: { label: 'Auth & Security', icon: '🔐', color: '#fb7185', keywords: ['passport', 'jsonwebtoken', 'jwt', 'bcrypt', 'oauth', 'clerk', 'auth0', 'next-auth', 'lucia', 'helmet', 'cors', 'csurf'] },
  api: { label: 'API & Network', icon: '🌐', color: '#34d399', keywords: ['axios', 'node-fetch', 'got', 'graphql', 'apollo', 'trpc', 'socket.io', 'ws', 'grpc', 'swagger', 'zod', 'joi', 'yup'] },
  devops: { label: 'DevOps & Cloud', icon: '☁️', color: '#60a5fa', keywords: ['docker', 'aws-sdk', '@aws-sdk', 'firebase', 'supabase', 'vercel', 'dotenv', 'winston', 'pino', 'sentry'] },
};

const DEVICON_MAP: Record<string, string> = {
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
  firebase: 'devicon-firebase-plain colored', sass: 'devicon-sass-original colored',
  babel: 'devicon-babel-plain colored', eslint: 'devicon-eslint-original colored',
  'socket.io': 'devicon-socketio-original', svelte: 'devicon-svelte-plain colored',
};

function getDevicon(name: string): string | null {
  const key = name.toLowerCase().replace(/[@/\s]/g, '').replace(/\.js$/, '');
  return DEVICON_MAP[key] ?? null;
}

function categorizePackage(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, info] of Object.entries(PKG_CATEGORIES)) {
    if (info.keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return 'other';
}

export function PackagePanel({ packages, onFileClick }: PackagePanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'production' | 'development'>('all');
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'categories' | 'list'>('cards');

  const filtered = useMemo(() => {
    let list = packages;
    if (filter !== 'all') list = list.filter((p) => p.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [packages, filter, search]);

  const prodCount = packages.filter((p) => p.type === 'production').length;
  const devCount = packages.filter((p) => p.type === 'development').length;
  const unusedCount = packages.filter((p) => p.usageCount === 0).length;
  const mostUsed = [...packages].sort((a, b) => b.usageCount - a.usageCount).slice(0, 8);

  const categorized = useMemo(() => {
    const map = new Map<string, PackageDependency[]>();
    for (const pkg of filtered) {
      const cat = categorizePackage(pkg.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(pkg);
    }
    return [...map.entries()]
      .map(([cat, pkgs]) => ({ cat, pkgs, info: PKG_CATEGORIES[cat] ?? { label: 'Other', icon: '📦', color: '#64748b', keywords: [] } }))
      .sort((a, b) => {
        const order = Object.keys(PKG_CATEGORIES);
        return (order.indexOf(a.cat) === -1 ? 99 : order.indexOf(a.cat)) - (order.indexOf(b.cat) === -1 ? 99 : order.indexOf(b.cat));
      });
  }, [filtered]);

  if (packages.length === 0) {
    return (
      <section className="panel p-5" aria-label="package-panel">
        <h2 className="panel-title">
          <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>📦</span>
          Package Dependencies
        </h2>
        <p style={{ color: 'var(--ink-muted)', marginTop: '0.75rem', fontSize: '0.82rem' }}>
          No package.json found in the repository.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-0 overflow-hidden" aria-label="package-panel">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            <span style={{ color: 'var(--accent-amber)', marginRight: '0.4rem' }}>📦</span>
            Package Ecosystem
          </h2>
          <span className="stat-badge stat-badge--emerald">{prodCount} prod</span>
          <span className="stat-badge stat-badge--violet">{devCount} dev</span>
          {unusedCount > 0 && <span className="stat-badge stat-badge--rose">⚠ {unusedCount} unused</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {([
            { key: 'cards' as const, label: '🃏 Cards' },
            { key: 'categories' as const, label: '🏷️ Categories' },
            { key: 'list' as const, label: '📋 List' },
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

      {/* Summary Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '0.5rem', padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <AnimatedStatCard label="Production" value={prodCount} color="var(--accent-emerald)" icon="🟢" />
        <AnimatedStatCard label="Development" value={devCount} color="var(--accent-violet)" icon="🟣" />
        <AnimatedStatCard label="Unused" value={unusedCount} color={unusedCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'} icon={unusedCount > 0 ? '⚠️' : '✅'} />
        <AnimatedStatCard label="Total" value={packages.length} color="var(--accent-indigo)" icon="📊" />
        <AnimatedStatCard label="Categories" value={categorized.length} color="var(--accent-cyan)" icon="🏷️" />
      </div>

      {/* Most Used - Visual Showcase */}
      {mostUsed.length > 0 && mostUsed[0].usageCount > 0 && (
        <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)', marginBottom: '0.5rem' }}>
            🏆 Most Used Packages
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {mostUsed.filter((p) => p.usageCount > 0).map((pkg, i) => {
              const icon = getDevicon(pkg.name);
              return (
                <motion.div key={pkg.name}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.7rem', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    cursor: 'pointer', transition: 'border-color 200ms',
                  }}
                >
                  {icon && <i className={icon} style={{ fontSize: '1.1rem' }} />}
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-indigo)', fontWeight: 700, display: 'block' }}>
                      {pkg.name}
                    </span>
                    <span style={{ fontSize: '0.58rem', color: 'var(--ink-muted)' }}>
                      {pkg.usageCount} files · {pkg.version}
                    </span>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(99,102,241,0.12)', fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-indigo)',
                  }}>{pkg.usageCount}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div style={{
        display: 'flex', gap: '0.35rem', alignItems: 'center',
        padding: '0.6rem 1.1rem', borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        <input
          type="text" placeholder="🔍 Search packages..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '0.4rem 0.6rem', borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
            color: 'var(--ink-primary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
            outline: 'none', transition: 'border-color 200ms',
          }}
        />
        {(['all', 'production', 'development'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.35rem 0.6rem', borderRadius: 8, fontSize: '0.72rem',
            border: `1px solid ${filter === f ? 'var(--accent-indigo)' : 'var(--border-subtle)'}`,
            background: filter === f ? 'rgba(99,102,241,0.12)' : 'transparent',
            color: filter === f ? 'var(--accent-indigo)' : 'var(--ink-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
            textTransform: 'capitalize', transition: 'all 200ms',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ padding: '1rem 1.1rem', maxHeight: 480, overflowY: 'auto' }}>
        {/* Cards View */}
        {viewMode === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
            {filtered.map((pkg, i) => {
              const icon = getDevicon(pkg.name);
              const cat = categorizePackage(pkg.name);
              const catInfo = PKG_CATEGORIES[cat] ?? { icon: '📦', color: '#64748b', label: 'Other' };
              const isExpanded = expandedPkg === pkg.name;
              return (
                <motion.div key={pkg.name}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  whileHover={{ y: -2 }}
                  onClick={() => setExpandedPkg(isExpanded ? null : pkg.name)}
                  style={{
                    padding: '0.7rem 0.85rem', borderRadius: 12,
                    background: isExpanded ? `${catInfo.color}08` : 'var(--bg-elevated)',
                    border: `1px solid ${isExpanded ? catInfo.color + '44' : 'var(--border-subtle)'}`,
                    cursor: 'pointer', transition: 'all 250ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: `${catInfo.color}15`, fontSize: icon ? '1.3rem' : '1.1rem',
                      flexShrink: 0,
                    }}>
                      {icon ? <i className={icon} style={{ fontSize: '1.3rem' }} /> : catInfo.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700,
                        color: 'var(--ink-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{pkg.name}</div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>{pkg.version}</span>
                        <span style={{
                          fontSize: '0.55rem', padding: '0.08rem 0.25rem', borderRadius: 3,
                          background: pkg.type === 'production' ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)',
                          color: pkg.type === 'production' ? 'var(--accent-emerald)' : 'var(--accent-violet)',
                          fontWeight: 600,
                        }}>
                          {pkg.type === 'production' ? 'prod' : 'dev'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: pkg.usageCount > 0 ? 'var(--accent-indigo)' : 'var(--accent-rose)',
                    }}>
                      {pkg.usageCount > 0 ? `${pkg.usageCount}` : '–'}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && pkg.usedBy.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}
                      >
                        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.25rem' }}>
                          Used by {pkg.usedBy.length} files:
                        </p>
                        {pkg.usedBy.slice(0, 6).map((f) => (
                          <button key={f} onClick={(e) => { e.stopPropagation(); onFileClick(f); }} style={{
                            display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                            color: 'var(--accent-indigo)', cursor: 'pointer', border: 'none',
                            background: 'none', padding: '0.1rem 0',
                          }}>{f}</button>
                        ))}
                        {pkg.usedBy.length > 6 && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--ink-muted)' }}>+{pkg.usedBy.length - 6} more</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Category View */}
        {viewMode === 'categories' && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {categorized.map(({ cat, pkgs, info }, i) => (
              <motion.div key={cat}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: `1px solid ${info.color}33`,
                  background: 'var(--bg-elevated)',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 0.85rem', background: `${info.color}08`,
                  borderBottom: `1px solid ${info.color}22`,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{info.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1, color: 'var(--ink-primary)' }}>{info.label}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: info.color, padding: '0.15rem 0.45rem', borderRadius: 6,
                    background: `${info.color}15`,
                  }}>{pkgs.length}</span>
                </div>
                <div style={{ padding: '0.5rem 0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {pkgs.map((pkg) => {
                    const icon = getDevicon(pkg.name);
                    return (
                      <motion.button key={pkg.name} whileHover={{ scale: 1.05 }}
                        onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.3rem 0.55rem', borderRadius: 8,
                          background: expandedPkg === pkg.name ? `${info.color}15` : 'var(--bg-surface)',
                          border: `1px solid ${expandedPkg === pkg.name ? info.color : 'var(--border-subtle)'}`,
                          cursor: 'pointer', color: 'var(--ink-primary)',
                          fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600,
                        }}
                      >
                        {icon && <i className={icon} style={{ fontSize: '0.85rem' }} />}
                        {pkg.name}
                        <span style={{ fontSize: '0.58rem', color: 'var(--ink-muted)' }}>{pkg.version}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* List View (classic) */}
        {viewMode === 'list' && (
          <div>
            {filtered.map((pkg) => {
              const icon = getDevicon(pkg.name);
              return (
                <div key={pkg.name} style={{ marginBottom: '0.25rem' }}>
                  <button onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '0.45rem 0.7rem', borderRadius: 8,
                      background: expandedPkg === pkg.name ? 'rgba(99,102,241,0.06)' : 'var(--bg-elevated)',
                      border: `1px solid ${expandedPkg === pkg.name ? 'rgba(99,102,241,0.2)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', color: 'var(--ink-primary)', transition: 'all 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {icon && <i className={icon} style={{ fontSize: '0.95rem' }} />}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>{pkg.name}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>{pkg.version}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: 4,
                        background: pkg.type === 'production' ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)',
                        color: pkg.type === 'production' ? 'var(--accent-emerald)' : 'var(--accent-violet)',
                        fontWeight: 600,
                      }}>{pkg.type === 'production' ? 'prod' : 'dev'}</span>
                      <span style={{
                        fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: pkg.usageCount > 0 ? 'var(--accent-indigo)' : 'var(--accent-rose)',
                      }}>{pkg.usageCount > 0 ? `${pkg.usageCount} files` : 'unused'}</span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedPkg === pkg.name && pkg.usedBy.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginLeft: '1rem', marginTop: '0.2rem' }}
                      >
                        <div style={{ padding: '0.4rem 0.55rem', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.3rem' }}>Used by:</p>
                          {pkg.usedBy.slice(0, 10).map((f) => (
                            <button key={f} onClick={() => onFileClick(f)} style={{
                              display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                              color: 'var(--accent-indigo)', cursor: 'pointer', border: 'none',
                              background: 'none', padding: '0.1rem 0',
                            }}>{f}</button>
                          ))}
                          {pkg.usedBy.length > 10 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>+{pkg.usedBy.length - 10} more</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unused Packages Warning */}
      {unusedCount > 0 && (
        <div style={{
          margin: '0 1.1rem 1rem', padding: '0.6rem 0.8rem', borderRadius: 10,
          background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
        }}>
          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-rose)', margin: 0 }}>
            ⚠ {unusedCount} Potentially Unused Package{unusedCount !== 1 ? 's' : ''}
          </h3>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', margin: '0.2rem 0 0' }}>
            Listed in package.json but not imported by any analyzed source file.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
            {packages.filter((p) => p.usageCount === 0).slice(0, 15).map((pkg) => (
              <span key={pkg.name} style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', padding: '0.15rem 0.4rem',
                borderRadius: 4, background: 'rgba(251,113,133,0.1)', color: 'var(--accent-rose)',
              }}>{pkg.name}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AnimatedStatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <motion.div whileHover={{ scale: 1.04, y: -2 }}
      style={{
        padding: '0.5rem 0.6rem', borderRadius: 10,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        textAlign: 'center', cursor: 'default', transition: 'border-color 200ms',
      }}
    >
      <span style={{ fontSize: '0.85rem', display: 'block' }}>{icon}</span>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color, marginTop: '0.15rem' }}>{value}</div>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.1rem' }}>
        {label}
      </div>
    </motion.div>
  );
}
