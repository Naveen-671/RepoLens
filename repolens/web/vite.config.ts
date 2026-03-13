import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3000',
      '/repos': 'http://localhost:3000',
      '/repo-graph': 'http://localhost:3000',
      '/repo-summary': 'http://localhost:3000',
      '/repo-health': 'http://localhost:3000',
      '/repo-flows': 'http://localhost:3000',
      '/repo-action': 'http://localhost:3000',
      '/analyze-repo': 'http://localhost:3000',
      '/file': 'http://localhost:3000',
      '/function-details': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/guided-learning': 'http://localhost:3000',
      '/data': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: false,
  },
});