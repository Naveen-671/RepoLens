import type { RepoGraphResponse, RepoSummaryResponse, RepoUiData } from './types';

/**
 * Loads graph and summary data for a repository id.
 */
export async function loadRepoUiData(repoId: string): Promise<RepoUiData> {
  try {
    const resolvedRepoId =
      repoId && repoId !== 'sample' ? repoId : await fetchLatestRepoId().catch(() => 'sample');

    const [graph, summary] = await Promise.all([
      fetchJson<RepoGraphResponse>(`/repo-graph/${encodeURIComponent(resolvedRepoId)}`),
      fetchJson<RepoSummaryResponse>(`/repo-summary/${encodeURIComponent(resolvedRepoId)}`),
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
 * Triggers analysis of a repository from the frontend.
 */
export async function analyzeRepoFromUi(repoUrl: string, options: { localRepo?: boolean; noAi?: boolean } = {}): Promise<{ repoId: string }> {
  const response = await fetch('/analyze-repo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, localRepo: options.localRepo, noAi: options.noAi }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Analysis failed' })) as { error?: string };
    throw new Error(err.error ?? 'Analysis failed');
  }
  return (await response.json()) as { repoId: string };
}

/**
 * Retrieves latest analyzed repository id from backend API.
 */
async function fetchLatestRepoId(): Promise<string> {
  const payload = await fetchJson<{ repoId: string }>('/repos/latest');
  return payload.repoId;
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
          classes: [],
          interfaces: [],
          cluster: 'authentication',
          linesOfCode: 15,
          complexity: 2,
          healthScore: 0.95,
        },
        {
          id: 'src/authController.ts',
          type: 'file',
          summary: 'Handles login API actions and dispatches auth service operations.',
          functions: ['loginUser', 'logoutUser'],
          imports: ['./services/authService'],
          classes: [],
          interfaces: [],
          cluster: 'authentication',
          critical: true,
          linesOfCode: 22,
          complexity: 3,
          healthScore: 0.92,
        },
        {
          id: 'src/services/authService.ts',
          type: 'file',
          summary: 'Provides token generation helper for authentication.',
          functions: ['authService'],
          imports: [],
          classes: [],
          interfaces: [],
          cluster: 'authentication',
          critical: true,
          linesOfCode: 10,
          complexity: 1,
          healthScore: 0.98,
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
      repoMetrics: {
        totalFiles: 3,
        totalLinesOfCode: 47,
        totalFunctions: 4,
        totalClasses: 0,
        totalInterfaces: 0,
        avgComplexity: 2,
        avgHealthScore: 0.95,
        complexityHotspots: [{ file: 'src/authController.ts', complexity: 3 }],
        largestFiles: [{ file: 'src/authController.ts', lines: 22 }],
      },
      repoOverview: {
        purpose: 'A sample authentication module with login form, controller, and service layers.',
        techStack: ['TypeScript', 'React'],
        languages: [{ name: 'TypeScript', percentage: 85 }, { name: 'TSX', percentage: 15 }],
        frameworks: ['React'],
        buildTools: [],
        entryPoints: ['src/loginForm.tsx'],
        directoryPurposes: [{ directory: 'src/', purpose: 'Application source code with auth components' }],
        keyInsights: ['Simple layered architecture', 'Clean separation of concerns'],
      },
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
