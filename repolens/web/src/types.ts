export interface RepoNode {
  id: string;
  type?: 'file' | 'external';
  summary?: string;
  functions?: string[];
  imports?: string[];
  cluster?: string;
  critical?: boolean;
}

export interface RepoEdge {
  source: string;
  target: string;
}

export interface RepoCluster {
  name: string;
  nodes: string[];
}

export interface RepoGraphResponse {
  nodes: RepoNode[];
  edges: RepoEdge[];
  clusters: RepoCluster[];
}

export interface RepoSummaryResponse {
  architectureType: string;
  explanation: string;
  featureClusters: Array<{ name: string; description: string }>;
  criticalFiles: Array<{ file: string; score: number }>;
}

export interface RepoUiData {
  graph: RepoGraphResponse;
  summary: RepoSummaryResponse;
}
