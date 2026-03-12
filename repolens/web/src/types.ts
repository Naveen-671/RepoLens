export interface FunctionDetail {
  name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  description: string;
  lineNumber: number;
  complexity: number;
  isAsync: boolean;
  isExported: boolean;
  callsTo: string[];
  calledBy: string[];
}

export interface ClassDetail {
  name: string;
  methods: string[];
  properties: string[];
  extends: string;
  implements: string[];
  isExported: boolean;
  lineNumber: number;
}

export interface PackageDependency {
  name: string;
  version: string;
  type: 'production' | 'development';
  usedBy: string[];
  usageCount: number;
}

export interface FunctionFlowEdge {
  source: string;
  sourceFile: string;
  target: string;
  targetFile: string;
}

export interface RepoNode {
  id: string;
  type?: 'file' | 'external';
  summary?: string;
  functions?: string[];
  imports?: string[];
  classes?: string[];
  interfaces?: string[];
  cluster?: string;
  critical?: boolean;
  linesOfCode?: number;
  complexity?: number;
  healthScore?: number;
  functionDetails?: FunctionDetail[];
  classDetails?: ClassDetail[];
  dataFlowIn?: string[];
  dataFlowOut?: string[];
  externalImports?: string[];
}

export interface RepoEdge {
  source: string;
  target: string;
}

export interface RepoCluster {
  name: string;
  nodes: string[];
}

export interface RepoMetrics {
  totalFiles: number;
  totalLinesOfCode: number;
  totalFunctions: number;
  totalClasses: number;
  totalInterfaces: number;
  avgComplexity: number;
  avgHealthScore: number;
  complexityHotspots: Array<{ file: string; complexity: number }>;
  largestFiles: Array<{ file: string; lines: number }>;
}

export interface RepoOverview {
  purpose: string;
  techStack: string[];
  languages: Array<{ name: string; percentage: number }>;
  frameworks: string[];
  buildTools: string[];
  entryPoints: string[];
  directoryPurposes: Array<{ directory: string; purpose: string }>;
  keyInsights: string[];
}

export interface RepoGraphResponse {
  nodes: RepoNode[];
  edges: RepoEdge[];
  clusters: RepoCluster[];
  repoMetrics?: RepoMetrics;
  repoOverview?: RepoOverview;
  functionFlowEdges?: FunctionFlowEdge[];
  packageDependencies?: PackageDependency[];
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
