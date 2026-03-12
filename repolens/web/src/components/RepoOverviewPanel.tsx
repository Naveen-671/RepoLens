import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { RepoOverview, RepoMetrics, RepoSummaryResponse } from '../types';

interface RepoOverviewPanelProps {
  overview: RepoOverview | undefined;
  metrics: RepoMetrics | undefined;
  summary: RepoSummaryResponse;
  onFileClick: (filePath: string) => void;
}

/* ─── Devicon class map ─── */
const deviconMap: Record<string, string> = {
  typescript: 'devicon-typescript-plain colored',
  javascript: 'devicon-javascript-plain colored',
  python: 'devicon-python-plain colored',
  java: 'devicon-java-plain colored',
  go: 'devicon-go-original-wordmark colored',
  rust: 'devicon-rust-original',
  ruby: 'devicon-ruby-plain colored',
  'c#': 'devicon-csharp-plain colored',
  csharp: 'devicon-csharp-plain colored',
  'c++': 'devicon-cplusplus-plain colored',
  cpp: 'devicon-cplusplus-plain colored',
  c: 'devicon-c-plain colored',
  swift: 'devicon-swift-plain colored',
  kotlin: 'devicon-kotlin-plain colored',
  php: 'devicon-php-plain colored',
  vue: 'devicon-vuejs-plain colored',
  svelte: 'devicon-svelte-plain colored',
  dart: 'devicon-dart-plain colored',
  react: 'devicon-react-original colored',
  angular: 'devicon-angularjs-plain colored',
  nextjs: 'devicon-nextjs-plain',
  'next.js': 'devicon-nextjs-plain',
  nodejs: 'devicon-nodejs-plain colored',
  'node.js': 'devicon-nodejs-plain colored',
  node: 'devicon-nodejs-plain colored',
  express: 'devicon-express-original',
  'express.js': 'devicon-express-original',
  django: 'devicon-django-plain',
  flask: 'devicon-flask-original',
  spring: 'devicon-spring-plain colored',
  docker: 'devicon-docker-plain colored',
  kubernetes: 'devicon-kubernetes-plain colored',
  mongodb: 'devicon-mongodb-plain colored',
  postgresql: 'devicon-postgresql-plain colored',
  postgres: 'devicon-postgresql-plain colored',
  mysql: 'devicon-mysql-plain colored',
  redis: 'devicon-redis-plain colored',
  graphql: 'devicon-graphql-plain colored',
  tailwind: 'devicon-tailwindcss-original colored',
  tailwindcss: 'devicon-tailwindcss-original colored',
  webpack: 'devicon-webpack-plain colored',
  vite: 'devicon-vitejs-plain colored',
  git: 'devicon-git-plain colored',
  npm: 'devicon-npm-original-wordmark colored',
  yarn: 'devicon-yarn-plain colored',
  pnpm: 'devicon-pnpm-plain colored',
  sass: 'devicon-sass-original colored',
  scss: 'devicon-sass-original colored',
  css: 'devicon-css3-plain colored',
  html: 'devicon-html5-plain colored',
  firebase: 'devicon-firebase-plain colored',
  jest: 'devicon-jest-plain colored',
  vitest: 'devicon-vitest-plain colored',
  eslint: 'devicon-eslint-original colored',
  babel: 'devicon-babel-plain colored',
  prisma: 'devicon-prisma-original',
  sqlite: 'devicon-sqlite-plain colored',
  tsx: 'devicon-react-original colored',
  jsx: 'devicon-react-original colored',
};

function getDeviconClass(tech: string): string | null {
  const key = tech.toLowerCase().replace(/\s+/g, '').replace(/\.js$/i, '');
  return deviconMap[key] ?? deviconMap[tech.toLowerCase()] ?? null;
}

const langColors: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f7df1e', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  'C#': '#178600', 'C++': '#f34b7d', C: '#555555', Swift: '#F05138',
  Kotlin: '#A97BFF', PHP: '#4F5D95', Vue: '#41b883', Svelte: '#ff3e00',
  Dart: '#00B4AB', TSX: '#3178c6', JSX: '#f7df1e', CSS: '#563d7c',
  HTML: '#e34c26', SCSS: '#c6538c',
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const formatted = display >= 1000 ? `${(display / 1000).toFixed(1)}K` : String(display);
  return <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem' }}>{formatted}</span>;
}

function LanguageBar({ languages }: { languages: Array<{ name: string; percentage: number }> }) {
  if (languages.length === 0) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{
        display: 'flex', borderRadius: 8, overflow: 'hidden', height: 12,
        border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
      }}>
        {languages.map((lang) => (
          <motion.div
            key={lang.name}
            title={`${lang.name}: ${lang.percentage}%`}
            initial={{ width: 0 }}
            animate={{ width: `${lang.percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            style={{
              background: langColors[lang.name] ?? 'var(--accent-indigo)',
              minWidth: lang.percentage > 0 ? 3 : 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.5rem' }}>
        {languages.map((lang) => {
          const icon = getDeviconClass(lang.name);
          return (
            <div key={lang.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {icon ? (
                <i className={icon} style={{ fontSize: '0.9rem' }} />
              ) : (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: langColors[lang.name] ?? 'var(--accent-indigo)',
                }} />
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', fontWeight: 600 }}>
                {lang.name}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{lang.percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TechCard({ label }: { label: string }) {
  const icon = getDeviconClass(label);
  return (
    <motion.div className="tech-card" whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.97 }}>
      {icon ? (
        <i className={icon} style={{ fontSize: '1.6rem' }} />
      ) : (
        <span style={{
          fontSize: '1.4rem', width: 28, height: 28, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(99,102,241,0.15)', borderRadius: 6, color: 'var(--accent-indigo)',
          fontWeight: 800, fontFamily: 'var(--font-mono)',
        }}>
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="tech-card-label">{label}</span>
    </motion.div>
  );
}

export function RepoOverviewPanel({ overview, metrics, summary, onFileClick }: RepoOverviewPanelProps) {
  return (
    <section className="panel p-5" aria-label="repo-overview-panel">
      <h2 className="panel-title">
        <span style={{ color: 'var(--accent-indigo)', marginRight: '0.4rem' }}>◈</span>
        Repository Overview
      </h2>

      {/* Purpose */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          marginTop: '1rem', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(34,211,238,0.06), rgba(167,139,250,0.06))',
          border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid var(--accent-indigo)',
        }}
      >
        <p style={{ color: 'var(--ink-primary)', fontSize: '0.92rem', lineHeight: 1.7, fontWeight: 500, margin: 0 }}>
          {overview?.purpose || 'Analyzing repository purpose...'}
        </p>
      </motion.div>

      {/* Animated Quick Stats */}
      {metrics && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '0.6rem', marginTop: '1rem',
          }}
        >
          {[
            { label: 'Files', value: metrics.totalFiles, color: 'var(--accent-indigo)', icon: '📄' },
            { label: 'Lines', value: metrics.totalLinesOfCode, color: 'var(--accent-emerald)', icon: '📝' },
            { label: 'Functions', value: metrics.totalFunctions, color: 'var(--accent-cyan)', icon: '⚡' },
            { label: 'Classes', value: metrics.totalClasses, color: 'var(--accent-violet)', icon: '🏗️' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={staggerItem} className="metric-card-animated">
              <div style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{stat.icon}</div>
              <AnimatedNumber value={stat.value} color={stat.color} />
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Languages */}
      {overview && overview.languages.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Languages</h3>
          <LanguageBar languages={overview.languages} />
        </div>
      )}

      {/* Tech Stack with Logos */}
      {overview && (overview.techStack.length > 0 || overview.frameworks.length > 0) && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Tech Stack & Frameworks</h3>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}
          >
            {[...new Set([...(overview.techStack ?? []), ...(overview.frameworks ?? [])])].map((tech) => (
              <motion.div key={tech} variants={staggerItem}>
                <TechCard label={tech} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Build Tools */}
      {overview && overview.buildTools.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">Build & Tooling</h3>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}
          >
            {overview.buildTools.map((tool) => (
              <motion.div key={tool} variants={staggerItem}>
                <TechCard label={tool} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Architecture */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={{ marginTop: '1.25rem' }}
      >
        <h3 className="section-title">Architecture</h3>
        <div style={{
          marginTop: '0.5rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid var(--accent-violet)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="stat-badge stat-badge--violet" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
              🏛️ {summary.architectureType}
            </span>
          </div>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
            {summary.explanation}
          </p>
        </div>
      </motion.div>

      {/* Directory Structure */}
      {overview && overview.directoryPurposes.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">📁 Directory Structure</h3>
          <div className="stagger-children" style={{ marginTop: '0.5rem' }}>
            {overview.directoryPurposes.map((dir) => (
              <div key={dir.directory} style={{
                display: 'flex', gap: '0.5rem', padding: '0.5rem 0.6rem',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'baseline',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-cyan)',
                  fontWeight: 600, minWidth: '8rem', flexShrink: 0,
                }}>
                  📂 {dir.directory}/
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  {dir.purpose}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry Points */}
      {overview && overview.entryPoints.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">🚀 Entry Points</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {overview.entryPoints.map((entry) => (
              <motion.button
                key={entry}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onFileClick(entry)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '0.3rem 0.7rem',
                  borderRadius: 8, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                  color: 'var(--accent-emerald)', cursor: 'pointer',
                }}
              >
                ▸ {entry}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Key Insights */}
      {overview && overview.keyInsights.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">💡 Key Insights</h3>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ marginTop: '0.5rem', display: 'grid', gap: '0.4rem' }}
          >
            {overview.keyInsights.map((insight, i) => (
              <motion.div key={i} variants={staggerItem} style={{
                display: 'flex', gap: '0.5rem', padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)', fontSize: '0.82rem',
                color: 'var(--ink-secondary)', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--accent-amber)', flexShrink: 0, fontWeight: 700 }}>✦</span>
                {insight}
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Feature Clusters */}
      {summary.featureClusters.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <h3 className="section-title">🧩 Feature Clusters ({summary.featureClusters.length})</h3>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            style={{ marginTop: '0.5rem', display: 'grid', gap: '0.4rem' }}
          >
            {summary.featureClusters.map((cluster) => (
              <motion.div key={cluster.name} variants={staggerItem} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.7rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              }}>
                <span className="cluster-chip">{cluster.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{cluster.description}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}
