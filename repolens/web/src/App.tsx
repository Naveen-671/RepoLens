import { useMemo } from 'react';

/**
 * Renders the initial RepoLens placeholder interface.
 */
export default function App() {
  const buildDate = useMemo(() => new Date().toLocaleString(), []);

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', margin: '2rem' }}>
      <h1>RepoLens</h1>
      <p>Frontend placeholder is ready.</p>
      <small>Loaded at {buildDate}</small>
    </main>
  );
}