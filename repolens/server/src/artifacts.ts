import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RepoAnalysis, FunctionDetail, ClassDetail } from '../../parser';
import type { AiArtifacts } from '../../ai/inference';

interface CacheEntry<T> {
  updatedAtMs: number;
  value: T;
}

const artifactCache = new Map<string, CacheEntry<unknown>>();

interface FunctionFlowEdge {
  source: string;
  sourceFile: string;
  target: string;
  targetFile: string;
}

interface PackageDependency {
  name: string;
  version: string;
  type: 'production' | 'development';
  usedBy: string[];
  usageCount: number;
}

export interface RepoGraphPayload {
  nodes: Array<{
    id: string;
    type: string;
    summary: string;
    functions: string[];
    imports: string[];
    classes: string[];
    interfaces: string[];
    cluster?: string;
    critical: boolean;
    linesOfCode: number;
    complexity: number;
    healthScore: number;
    functionDetails?: FunctionDetail[];
    classDetails?: ClassDetail[];
    dataFlowIn?: string[];
    dataFlowOut?: string[];
    externalImports?: string[];
  }>;
  edges: Array<{ source: string; target: string }>;
  clusters: Array<{ name: string; nodes: string[] }>;
  repoMetrics: {
    totalFiles: number;
    totalLinesOfCode: number;
    totalFunctions: number;
    totalClasses: number;
    totalInterfaces: number;
    avgComplexity: number;
    avgHealthScore: number;
    complexityHotspots: Array<{ file: string; complexity: number }>;
    largestFiles: Array<{ file: string; lines: number }>;
  };
  repoOverview?: {
    purpose: string;
    techStack: string[];
    languages: Array<{ name: string; percentage: number }>;
    frameworks: string[];
    buildTools: string[];
    entryPoints: string[];
    directoryPurposes: Array<{ directory: string; purpose: string }>;
    keyInsights: string[];
  };
  functionFlowEdges?: FunctionFlowEdge[];
  packageDependencies?: PackageDependency[];
}

/**
 * Builds artifact directory path for a given repository id.
 */
export function getResultDir(repoId: string): string {
  return path.resolve(process.cwd(), 'data', 'results', repoId);
}

/**
 * Reads and caches JSON artifacts using mtime-based invalidation.
 */
export async function readArtifactJson<T>(repoId: string, fileName: string): Promise<T> {
  const artifactPath = path.join(getResultDir(repoId), fileName);
  const stat = await fs.stat(artifactPath);
  const cacheKey = `${repoId}:${fileName}`;
  const existing = artifactCache.get(cacheKey);

  if (existing && existing.updatedAtMs === stat.mtimeMs) {
    return existing.value as T;
  }

  const raw = await fs.readFile(artifactPath, 'utf8');
  const parsed = JSON.parse(raw) as T;
  artifactCache.set(cacheKey, {
    updatedAtMs: stat.mtimeMs,
    value: parsed,
  });

  return parsed;
}

/**
 * Writes a graph artifact based on parser and AI outputs.
 */
export async function writeGraphArtifact(
  repoId: string,
  analysis: RepoAnalysis,
  ai: AiArtifacts | null,
): Promise<string> {
  const graphPath = path.join(getResultDir(repoId), 'graph.json');
  await fs.mkdir(path.dirname(graphPath), { recursive: true });

  const summaryByPath = new Map(ai?.fileSummaries.map((item) => [item.path, item.summary]) ?? []);
  const criticalSet = new Set(ai?.criticalFiles.map((item) => item.file) ?? []);
  const clusterMap = new Map<string, string>();

  const clusters = (ai?.clusters ?? []).map((cluster) => {
    cluster.files.forEach((filePath) => clusterMap.set(filePath, cluster.name));
    return { name: cluster.name, nodes: cluster.files };
  });

  // When AI inference wasn't available, infer clusters from directory structure
  if (clusters.length === 0) {
    const dirGroups = new Map<string, string[]>();
    for (const file of analysis.files) {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
      const existing = dirGroups.get(dir);
      if (existing) {
        existing.push(file.path);
      } else {
        dirGroups.set(dir, [file.path]);
      }
    }
    for (const [dir, files] of dirGroups) {
      const clusterName = dir === 'root' ? 'core' : dir.split('/').pop() ?? dir;
      clusters.push({ name: clusterName, nodes: files });
      for (const f of files) { clusterMap.set(f, clusterName); }
    }
  }

  // Compute edge-based criticality
  const edgeCount = new Map<string, number>();
  for (const edge of analysis.edges) {
    edgeCount.set(edge.target, (edgeCount.get(edge.target) ?? 0) + 1);
    edgeCount.set(edge.source, (edgeCount.get(edge.source) ?? 0) + 0.5);
  }
  const maxConnections = Math.max(...edgeCount.values(), 1);

  const nodes = analysis.files.map((file) => {
    const aiSummary = summaryByPath.get(file.path);
    const fileName = file.path.split('/').pop() ?? file.path;
    const fallbackSummary = file.functions.length > 0
      ? `Exports ${file.functions.slice(0, 3).join(', ')}${file.functions.length > 3 ? ` and ${file.functions.length - 3} more` : ''}.`
      : `${fileName} module.`;

    const isCritical = criticalSet.has(file.path) ||
      (edgeCount.get(file.path) ?? 0) / maxConnections > 0.5;

    const healthScore = computeFileHealthScore(file);

    return {
      id: file.path,
      type: 'file' as const,
      summary: aiSummary ?? fallbackSummary,
      functions: file.functions,
      imports: file.imports,
      classes: file.classes,
      interfaces: file.interfaces ?? [],
      cluster: clusterMap.get(file.path),
      critical: isCritical,
      linesOfCode: file.linesOfCode ?? 0,
      complexity: file.complexity ?? 1,
      healthScore,
      functionDetails: file.functionDetails ?? [],
      classDetails: file.classDetails ?? [],
      dataFlowIn: file.dataFlowIn ?? [],
      dataFlowOut: file.dataFlowOut ?? [],
      externalImports: file.externalImports ?? [],
    };
  });

  // Build function-level call graph edges across files
  const functionFlowEdges = buildFunctionFlowEdges(analysis);

  // Detect package dependencies from package.json if available
  const packageDependencies = await detectPackageDependencies(repoId, analysis);

  // Build repo overview without AI when not available
  const repoOverviewData = ai?.repoOverview ?? buildStaticRepoOverview(analysis, clusters);

  // Compute repo-wide metrics
  const totalLinesOfCode = analysis.files.reduce((sum, f) => sum + (f.linesOfCode ?? 0), 0);
  const totalFunctions = analysis.files.reduce((sum, f) => sum + f.functions.length, 0);
  const totalClasses = analysis.files.reduce((sum, f) => sum + f.classes.length, 0);
  const totalInterfaces = analysis.files.reduce((sum, f) => sum + (f.interfaces?.length ?? 0), 0);
  const avgComplexity = analysis.files.length > 0
    ? analysis.files.reduce((sum, f) => sum + (f.complexity ?? 1), 0) / analysis.files.length
    : 1;
  const avgHealthScore = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + n.healthScore, 0) / nodes.length
    : 0.5;

  const complexityHotspots = [...analysis.files]
    .sort((a, b) => (b.complexity ?? 1) - (a.complexity ?? 1))
    .slice(0, 10)
    .map((f) => ({ file: f.path, complexity: f.complexity ?? 1 }));

  const largestFiles = [...analysis.files]
    .sort((a, b) => (b.linesOfCode ?? 0) - (a.linesOfCode ?? 0))
    .slice(0, 10)
    .map((f) => ({ file: f.path, lines: f.linesOfCode ?? 0 }));

  const graph: RepoGraphPayload = {
    nodes,
    edges: analysis.edges.map((edge) => ({ source: edge.source, target: edge.target })),
    clusters,
    repoMetrics: {
      totalFiles: analysis.files.length,
      totalLinesOfCode,
      totalFunctions,
      totalClasses,
      totalInterfaces,
      avgComplexity: Number(avgComplexity.toFixed(1)),
      avgHealthScore: Number(avgHealthScore.toFixed(2)),
      complexityHotspots,
      largestFiles,
    },
    repoOverview: repoOverviewData,
    functionFlowEdges,
    packageDependencies,
  };

  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf8');
  return graphPath;
}

/**
 * Computes a 0-1 health score for a file based on size, complexity, and structure.
 */
function computeFileHealthScore(file: {
  linesOfCode?: number;
  complexity?: number;
  functions: string[];
  classes: string[];
  commentLines?: number;
  exports: string[];
}): number {
  const loc = file.linesOfCode ?? 0;
  const complexity = file.complexity ?? 1;
  const commentRatio = loc > 0 ? (file.commentLines ?? 0) / loc : 0;

  // Penalize very large files
  const sizePenalty = loc > 500 ? Math.min(0.3, (loc - 500) / 2000) : 0;
  // Penalize high complexity
  const complexityPenalty = complexity > 15 ? Math.min(0.3, (complexity - 15) / 50) : 0;
  // Reward having comments
  const commentBonus = Math.min(0.1, commentRatio * 0.5);
  // Reward having exports (API surface)
  const exportBonus = file.exports.length > 0 ? 0.05 : 0;
  // Reward having functions/classes (structured code)
  const structureBonus = (file.functions.length + file.classes.length) > 0 ? 0.05 : 0;

  const score = Math.max(0, Math.min(1,
    1 - sizePenalty - complexityPenalty + commentBonus + exportBonus + structureBonus
  ));
  return Number(score.toFixed(2));
}

/**
 * Streams graph artifact file content directly to a writable response.
 */
export function streamGraphArtifact(repoId: string) {
  const graphPath = path.join(getResultDir(repoId), 'graph.json');
  return createReadStream(graphPath, { encoding: 'utf8' });
}

/**
 * Builds cross-file function call flow edges from parser analysis.
 */
function buildFunctionFlowEdges(analysis: RepoAnalysis): FunctionFlowEdge[] {
  const edges: FunctionFlowEdge[] = [];

  // Build a map of all exported functions to their file
  const exportedFunctions = new Map<string, string>();
  for (const file of analysis.files) {
    const details = file.functionDetails ?? [];
    for (const fn of details) {
      if (fn.isExported) {
        exportedFunctions.set(fn.name, file.path);
      }
    }
    // Also map plain exports
    for (const exp of file.exports) {
      if (!exportedFunctions.has(exp)) {
        exportedFunctions.set(exp, file.path);
      }
    }
  }

  // For each file's functions, check what exported functions they call
  for (const file of analysis.files) {
    const details = file.functionDetails ?? [];
    for (const fn of details) {
      for (const callTarget of fn.callsTo) {
        const targetFile = exportedFunctions.get(callTarget);
        if (targetFile && targetFile !== file.path) {
          edges.push({
            source: fn.name,
            sourceFile: file.path,
            target: callTarget,
            targetFile,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.sourceFile}:${e.source}->${e.targetFile}:${e.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Detects package dependencies from package.json in the repo.
 */
async function detectPackageDependencies(repoId: string, analysis: RepoAnalysis): Promise<PackageDependency[]> {
  const packages: PackageDependency[] = [];

  // Try to read package.json from the repo cache
  const repoDir = path.resolve(process.cwd(), 'data', 'repos');
  const possiblePaths = [
    path.join(repoDir, repoId, 'source', 'package.json'),
    path.join(repoDir, repoId, 'package.json'),
  ];

  let pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;
  for (const p of possiblePaths) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      pkgJson = JSON.parse(raw);
      break;
    } catch {
      continue;
    }
  }

  if (!pkgJson) return packages;

  // Count how many files import each package
  const importUsage = new Map<string, string[]>();
  for (const file of analysis.files) {
    for (const imp of file.externalImports ?? []) {
      // Extract base package name (handle scoped packages)
      const pkgName = imp.startsWith('@')
        ? imp.split('/').slice(0, 2).join('/')
        : imp.split('/')[0];
      if (!importUsage.has(pkgName)) {
        importUsage.set(pkgName, []);
      }
      importUsage.get(pkgName)!.push(file.path);
    }
  }

  for (const [name, version] of Object.entries(pkgJson.dependencies ?? {})) {
    const usedBy = [...new Set(importUsage.get(name) ?? [])];
    packages.push({
      name,
      version,
      type: 'production',
      usedBy,
      usageCount: usedBy.length,
    });
  }

  for (const [name, version] of Object.entries(pkgJson.devDependencies ?? {})) {
    if (packages.some((p) => p.name === name)) continue;
    const usedBy = [...new Set(importUsage.get(name) ?? [])];
    packages.push({
      name,
      version,
      type: 'development',
      usedBy,
      usageCount: usedBy.length,
    });
  }

  return packages.sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Builds a static repo overview without AI, from parser data alone.
 */
function buildStaticRepoOverview(
  analysis: RepoAnalysis,
  clusters: Array<{ name: string; nodes: string[] }>,
): RepoGraphPayload['repoOverview'] {
  // Language detection
  const extToLang: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.java': 'Java', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby',
    '.cs': 'C#', '.cpp': 'C++', '.c': 'C', '.swift': 'Swift', '.kt': 'Kotlin',
    '.php': 'PHP', '.vue': 'Vue', '.svelte': 'Svelte', '.dart': 'Dart',
  };

  const langCount = new Map<string, number>();
  const filenames = new Set<string>();
  for (const file of analysis.files) {
    const ext = '.' + file.path.split('.').pop()?.toLowerCase();
    const lang = extToLang[ext];
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
    filenames.add(file.path.split('/').pop()?.toLowerCase() ?? '');
  }

  const totalLangFiles = [...langCount.values()].reduce((s, c) => s + c, 0) || 1;
  const languages = [...langCount.entries()]
    .map(([name, count]) => ({ name, percentage: Math.round((count / totalLangFiles) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);

  // Framework detection
  const allImports = new Set(analysis.files.flatMap((f) => f.externalImports ?? []));
  const frameworkPatterns: Array<[string, string]> = [
    ['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue.js'], ['angular', 'Angular'],
    ['svelte', 'Svelte'], ['express', 'Express'], ['fastify', 'Fastify'], ['koa', 'Koa'],
    ['nest', 'NestJS'], ['django', 'Django'], ['flask', 'Flask'],
    ['prisma', 'Prisma'], ['typeorm', 'TypeORM'], ['mongoose', 'Mongoose'],
    ['tailwindcss', 'Tailwind CSS'], ['jest', 'Jest'], ['vitest', 'Vitest'],
    ['redux', 'Redux'], ['zustand', 'Zustand'], ['graphql', 'GraphQL'], ['trpc', 'tRPC'],
    ['socket.io', 'Socket.IO'], ['axios', 'Axios'], ['framer-motion', 'Framer Motion'],
    ['reactflow', 'React Flow'],
  ];
  const frameworks: string[] = [];
  for (const [pattern, name] of frameworkPatterns) {
    if ([...allImports].some((imp) => imp.toLowerCase().includes(pattern))) {
      frameworks.push(name);
    }
  }

  // Build tools detection from filenames
  const buildTools: string[] = [];
  const configPatterns: Array<[string, string]> = [
    ['package.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'Yarn'],
    ['tsconfig.json', 'TypeScript'], ['vite.config', 'Vite'], ['webpack.config', 'Webpack'],
    ['dockerfile', 'Docker'], ['.github', 'GitHub Actions'],
  ];
  for (const [pattern, name] of configPatterns) {
    if ([...filenames].some((f) => f.includes(pattern))) {
      buildTools.push(name);
    }
  }

  // Detect entry points
  const entryPoints = analysis.files
    .filter((f) => /(index|main|app|server)\.(ts|js|tsx|jsx)$/.test(f.path))
    .map((f) => f.path)
    .slice(0, 5);

  // Build directory purposes
  const dirMap = new Map<string, number>();
  for (const file of analysis.files) {
    const parts = file.path.split('/');
    const topDir = parts.length > 1 ? parts[0] : '.';
    dirMap.set(topDir, (dirMap.get(topDir) ?? 0) + 1);
  }
  const directoryPurposes = [...dirMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([dir, count]) => ({
      directory: dir,
      purpose: inferDirectoryPurpose(dir, count),
    }));

  // Key insights from static analysis
  const keyInsights: string[] = [];
  const totalLoc = analysis.files.reduce((s, f) => s + (f.linesOfCode ?? 0), 0);
  const avgComplexity = analysis.files.length > 0
    ? analysis.files.reduce((s, f) => s + (f.complexity ?? 1), 0) / analysis.files.length
    : 1;

  keyInsights.push(`${analysis.files.length} source files with ${totalLoc.toLocaleString()} total lines of code`);
  if (frameworks.length > 0) keyInsights.push(`Uses ${frameworks.slice(0, 4).join(', ')}`);
  if (avgComplexity > 15) keyInsights.push(`High average complexity (${avgComplexity.toFixed(1)}) — consider refactoring`);
  else if (avgComplexity < 5) keyInsights.push(`Low average complexity (${avgComplexity.toFixed(1)}) — well-structured code`);
  if (clusters.length > 1) keyInsights.push(`Organized into ${clusters.length} feature modules`);

  const totalFns = analysis.files.reduce((s, f) => s + f.functions.length, 0);
  const totalExported = analysis.files.reduce((s, f) => s + (f.functionDetails?.filter((d) => d.isExported).length ?? 0), 0);
  if (totalFns > 0) keyInsights.push(`${totalFns} functions total, ${totalExported} exported (public API surface)`);

  // Build purpose from what we know
  const topLangs = languages.slice(0, 2).map((l) => l.name).join('/');
  const purpose = entryPoints.some((e) => /server/.test(e))
    ? `A ${topLangs} application with server-side components${frameworks.length > 0 ? ` using ${frameworks[0]}` : ''}.`
    : frameworks.length > 0
    ? `A ${topLangs} project built with ${frameworks.slice(0, 2).join(' and ')}.`
    : `A ${topLangs} software project with ${analysis.files.length} source files.`;

  return {
    purpose,
    techStack: [...new Set([...languages.map((l) => l.name), ...frameworks])],
    languages,
    frameworks,
    buildTools,
    entryPoints,
    directoryPurposes,
    keyInsights,
  };
}

/**
 * Infers directory purpose from name heuristics.
 */
function inferDirectoryPurpose(dir: string, fileCount: number): string {
  const lower = dir.toLowerCase();
  const purposeMap: Record<string, string> = {
    src: 'Main source code',
    lib: 'Library code and utilities',
    server: 'Server-side application logic',
    api: 'API route handlers',
    web: 'Frontend web application',
    client: 'Client-side application',
    components: 'UI components',
    utils: 'Utility functions and helpers',
    helpers: 'Helper functions',
    services: 'Service layer / business logic',
    models: 'Data models and schemas',
    types: 'Type definitions',
    config: 'Configuration files',
    tests: 'Test files',
    test: 'Test files',
    __tests__: 'Test files',
    scripts: 'Build and utility scripts',
    middleware: 'Middleware functions',
    routes: 'Route definitions',
    controllers: 'Request handlers / controllers',
    hooks: 'Custom hooks',
    store: 'State management',
    styles: 'Stylesheets and themes',
    public: 'Static public assets',
    assets: 'Asset files',
    docs: 'Documentation',
    parser: 'Code parsing logic',
    ai: 'AI/ML integration',
    graph: 'Graph data structures',
    cli: 'Command-line interface',
    data: 'Data storage and caching',
  };
  return purposeMap[lower] ?? `Contains ${fileCount} source files`;
}
