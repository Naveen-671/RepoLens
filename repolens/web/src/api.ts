import type { RepoGraphResponse, RepoSummaryResponse, RepoUiData } from './types';

/**
 * Loads graph and summary data for a repository id.
 */
export async function loadRepoUiData(repoId: string): Promise<RepoUiData> {
  try {
    const [graph, summary] = await Promise.all([
      fetchJson<RepoGraphResponse>(`/repo-graph/${encodeURIComponent(repoId)}`),
      fetchJson<RepoSummaryResponse>(`/repo-summary/${encodeURIComponent(repoId)}`),
    ]);

    return {
      graph,
      summary,
    };
  } catch {
    return buildFallbackData();
  }
}

/**
 * Fetches and parses JSON payload from an endpoint.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * Builds deterministic fallback data from the sample fixture shape.
 */
function buildFallbackData(): RepoUiData {
  return {
    graph: {
      nodes: [
        {
          id: 'src/loginForm.tsx',
          type: 'file',
          summary: 'Submits login flow from UI to controller.',
          functions: ['submitLogin'],
          imports: ['./authController'],
          cluster: 'authentication',
        },
        {
          id: 'src/authController.ts',
          type: 'file',
          summary: 'Handles login API actions and dispatches auth service operations.',
          functions: ['loginUser', 'logoutUser'],
          imports: ['./services/authService'],
          cluster: 'authentication',
          critical: true,
        },
        {
          id: 'src/services/authService.ts',
          type: 'file',
          summary: 'Provides token generation helper for authentication.',
          functions: ['authService'],
          imports: [],
          cluster: 'authentication',
          critical: true,
        },
      ],
      edges: [
        { source: 'src/loginForm.tsx', target: 'src/authController.ts' },
        { source: 'src/authController.ts', target: 'src/services/authService.ts' },
      ],
      clusters: [
        {
          name: 'authentication',
          nodes: ['src/loginForm.tsx', 'src/authController.ts', 'src/services/authService.ts'],
        },
      ],
    },
    summary: {
      architectureType: 'layered',
      explanation:
        'The repository follows a layered architecture where the UI depends on a controller layer that delegates to a service layer.',
      featureClusters: [
        {
          name: 'authentication',
          description: 'Login and token-related files.',
        },
      ],
      criticalFiles: [
        { file: 'src/authController.ts', score: 0.95 },
        { file: 'src/services/authService.ts', score: 0.86 },
      ],
    },
  };
}
