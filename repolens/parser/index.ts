import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import simpleGit from 'simple-git';
import { Project, ScriptKind, SyntaxKind } from 'ts-morph';
import { validateRemoteEnvVars } from '../ai/env';

const DEFAULT_EXTENSIONS = ['ts', 'js', 'py', 'java', 'go', 'tsx', 'jsx'] as const;
const PARSE_BATCH_SIZE = 50;
const CHECKPOINT_INTERVAL = 100;

export interface AnalyzeOptions {
  depth?: number;
  extensions?: string[];
  force?: boolean;
}

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

export interface FileAnalysis {
  path: string;
  size: number;
  imports: string[];
  externalImports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  calls: string[];
  linesOfCode: number;
  blankLines: number;
  commentLines: number;
  complexity: number;
  interfaces: string[];
  typeAliases: string[];
  hasDefaultExport: boolean;
  functionDetails: FunctionDetail[];
  classDetails: ClassDetail[];
  dataFlowIn: string[];
  dataFlowOut: string[];
}

export interface AnalysisNode {
  id: string;
}

export interface AnalysisEdge {
  source: string;
  target: string;
  type: 'import';
}

export interface RepoAnalysis {
  repo: string;
  files: FileAnalysis[];
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
}

export interface AnalyzeResult {
  analysis: RepoAnalysis;
  analysisPath: string;
  repoHash: string;
  repoPath: string;
}

/**
 * Runs repository analysis and writes deterministic parser + graph artifacts.
 */
export async function analyzeRepository(input: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const depth = options.depth ?? 1;
  const extensions = (options.extensions?.length ? options.extensions : [...DEFAULT_EXTENSIONS]).map((ext) =>
    ext.replace(/^\./, ''),
  );
  const force = Boolean(options.force);

  const repoHash = createHash('sha256').update(input).digest('hex').slice(0, 16);
  const repoRootDir = path.resolve(process.cwd(), 'data', 'repos', repoHash);
  const repoSourceDir = path.join(repoRootDir, 'source');
  const repoCachePath = path.join(repoRootDir, 'analysis.json');
  const resultDir = path.resolve(process.cwd(), 'data', 'results', repoHash);
  const analysisPath = path.join(resultDir, 'analysis.json');
  const checkpointPath = path.join(resultDir, 'analysis.checkpoint.json');

  await fs.mkdir(repoRootDir, { recursive: true });
  await fs.mkdir(resultDir, { recursive: true });

  if (!force) {
    const cached = await readJsonIfExists<RepoAnalysis>(repoCachePath);
    if (cached) {
      await fs.writeFile(analysisPath, JSON.stringify(cached, null, 2), 'utf8');
      return {
        analysis: cached,
        analysisPath,
        repoHash,
        repoPath: isRemoteUrl(input) ? repoSourceDir : path.resolve(input),
      };
    }
  }

  const repoPath = isRemoteUrl(input)
    ? await cloneRepositoryToLocal(input, repoSourceDir, depth, force)
    : await resolveLocalRepositoryPath(input);

  const filePaths = await scanRepositoryFiles(repoPath, extensions);
  const fileSet = new Set(filePaths);
  const files: FileAnalysis[] = [];

  for (let index = 0; index < filePaths.length; index += PARSE_BATCH_SIZE) {
    const batchPaths = filePaths.slice(index, index + PARSE_BATCH_SIZE);
    const batchResults = await Promise.all(batchPaths.map((filePath) => analyzeFile(repoPath, filePath)));
    files.push(...batchResults);

    if (files.length % CHECKPOINT_INTERVAL === 0 || files.length === filePaths.length) {
      const checkpoint = buildAnalysis(input, files, fileSet);
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf8');
    }
  }

  const analysis = buildAnalysis(input, files, fileSet);
  await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');
  await fs.writeFile(repoCachePath, JSON.stringify(analysis, null, 2), 'utf8');

  return {
    analysis,
    analysisPath,
    repoHash,
    repoPath,
  };
}

/**
 * Scans repository files for the selected extension set.
 */
export async function scanRepositoryFiles(repoPath: string, extensions: string[]): Promise<string[]> {
  const patterns = extensions.map((ext) => `**/*.${ext}`);
  const files = await fg(patterns, {
    cwd: repoPath,
    onlyFiles: true,
    dot: false,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'out/**'],
  });

  return files.map(toPosixPath).sort((a, b) => a.localeCompare(b));
}

/**
 * Builds file graph nodes and import edges from analyzed file records.
 */
export function buildAnalysis(repo: string, files: FileAnalysis[], fileSet: Set<string>): RepoAnalysis {
  const normalizedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const nodes = normalizedFiles.map((file) => ({ id: file.path }));
  const edges: AnalysisEdge[] = [];

  for (const file of normalizedFiles) {
    for (const importSpecifier of file.imports) {
      const target = resolveImportToRepoPath(file.path, importSpecifier, fileSet);
      if (target) {
        edges.push({ source: file.path, target, type: 'import' });
      }
    }
  }

  edges.sort((a, b) => {
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }
    return a.target.localeCompare(b.target);
  });

  return {
    repo,
    files: normalizedFiles,
    nodes,
    edges,
  };
}

/**
 * Analyzes one file and extracts symbols/imports/calls.
 */
export async function analyzeFile(repoPath: string, relativeFilePath: string): Promise<FileAnalysis> {
  const absolutePath = path.join(repoPath, relativeFilePath);
  const sourceText = await fs.readFile(absolutePath, 'utf8');
  const stats = await fs.stat(absolutePath);
  const extension = path.extname(relativeFilePath).replace('.', '').toLowerCase();

  if (['ts', 'tsx', 'js', 'jsx'].includes(extension)) {
    try {
      return analyzeWithTsMorph(relativeFilePath, stats.size, sourceText, extension);
    } catch {
      // ts-morph can crash on certain syntax patterns — fall through to regex
    }
  }

  const treeSitterParsed = await attemptTreeSitterParse(sourceText, extension);
  if (treeSitterParsed) {
    const imports = dedupeSort(treeSitterParsed.imports);
    const lines = sourceText.split(/\r?\n/);
    return {
      path: relativeFilePath,
      size: stats.size,
      imports,
      externalImports: dedupeSort(imports.filter((item) => !item.startsWith('.'))),
      exports: dedupeSort(treeSitterParsed.exports),
      functions: dedupeSort(treeSitterParsed.functions),
      classes: dedupeSort(treeSitterParsed.classes),
      calls: dedupeSort(treeSitterParsed.calls),
      linesOfCode: lines.length,
      blankLines: lines.filter((l) => l.trim().length === 0).length,
      commentLines: lines.filter((l) => {
        const t = l.trim();
        return t.startsWith('//') || t.startsWith('#') || t.startsWith('/*') || t.startsWith('*');
      }).length,
      complexity: computeCyclomaticComplexity(sourceText),
      interfaces: [],
      typeAliases: [],
      hasDefaultExport: /export\s+default\b/.test(sourceText),
      functionDetails: dedupeSort(treeSitterParsed.functions).map((name) => ({
        name, params: [], returnType: 'unknown', description: '', lineNumber: 0,
        complexity: 1, isAsync: false, isExported: false, callsTo: [], calledBy: [],
      })),
      classDetails: dedupeSort(treeSitterParsed.classes).map((name) => ({
        name, methods: [], properties: [], extends: '', implements: [],
        isExported: false, lineNumber: 0,
      })),
      dataFlowIn: dedupeSort(imports.filter((i) => i.startsWith('.'))),
      dataFlowOut: dedupeSort(treeSitterParsed.exports),
    };
  }

  return analyzeWithRegexFallback(relativeFilePath, stats.size, sourceText);
}

/**
 * Uses ts-morph to parse TS/JS and gather rich metadata including function details.
 */
function analyzeWithTsMorph(
  relativeFilePath: string,
  size: number,
  sourceText: string,
  extension: string,
): FileAnalysis {
  const project = new Project({ useInMemoryFileSystem: true });
  const scriptKind = extension === 'tsx' ? ScriptKind.TSX : extension === 'jsx' ? ScriptKind.JSX : undefined;
  const sourceFile = project.createSourceFile(relativeFilePath, sourceText, {
    overwrite: true,
    scriptKind,
  });

  const imports = sourceFile
    .getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue());

  sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((node) => node.getExpression().getText() === 'require')
    .forEach((node) => {
      const firstArg = node.getArguments()[0];
      if (firstArg) {
        imports.push(firstArg.getText().replace(/['"]/g, ''));
      }
    });

  let exportedNames: Set<string>;
  try {
    exportedNames = new Set([...sourceFile.getExportedDeclarations().keys()]);
  } catch {
    exportedNames = new Set<string>();
  }
  const exports = [...exportedNames];

  const allFunctions = sourceFile.getFunctions();
  const functions = allFunctions
    .map((fn) => fn.getName())
    .filter((name): name is string => Boolean(name));

  // Extract rich function details
  const functionDetails: FunctionDetail[] = [];
  for (const fn of allFunctions) {
    const fnName = fn.getName();
    if (!fnName) continue;

    const params = fn.getParameters().map((p) => {
      let type = 'unknown';
      try { type = p.getType().getText(p).replace(/import\([^)]*\)\./g, '').slice(0, 100); } catch { /* ignore */ }
      return { name: p.getName(), type };
    });

    let returnType = 'unknown';
    try { returnType = fn.getReturnType().getText(fn).replace(/import\([^)]*\)\./g, '').slice(0, 100); } catch { /* ignore */ }

    // Extract JSDoc description
    const jsDocs = fn.getJsDocs();
    const description = jsDocs.length > 0
      ? jsDocs[0].getDescription().trim().split('\n')[0].slice(0, 200)
      : '';

    const fnBody = fn.getBody()?.getText() ?? '';
    const callsInFn = extractCallNames(fnBody);

    functionDetails.push({
      name: fnName,
      params,
      returnType,
      description,
      lineNumber: fn.getStartLineNumber(),
      complexity: computeCyclomaticComplexity(fnBody),
      isAsync: fn.isAsync(),
      isExported: exportedNames.has(fnName),
      callsTo: callsInFn,
      calledBy: [],
    });
  }

  // Also extract arrow functions assigned to const/let/var
  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const init = varDecl.getInitializer();
    if (!init) continue;
    const kind = init.getKind();
    if (kind !== SyntaxKind.ArrowFunction && kind !== SyntaxKind.FunctionExpression) continue;

    const fnName = varDecl.getName();
    if (!fnName || functionDetails.some((d) => d.name === fnName)) continue;

    const arrowFn = init;
    const params: Array<{ name: string; type: string }> = [];
    const fnBody = arrowFn.getText();

    // Extract params from arrow function text
    const paramMatch = fnBody.match(/^\s*(?:async\s+)?\(([^)]*)\)/);
    if (paramMatch?.[1]) {
      for (const p of paramMatch[1].split(',')) {
        const parts = p.trim().split(/\s*:\s*/);
        if (parts[0]) {
          params.push({
            name: parts[0].replace(/[?]/g, '').trim(),
            type: parts[1]?.trim().slice(0, 100) || 'unknown',
          });
        }
      }
    }

    const callsInFn = extractCallNames(fnBody);
    const varStmt = varDecl.getParent().getParent();
    const isExported = varStmt ? exportedNames.has(fnName) : false;
    const isAsync = /^\s*async\s/.test(fnBody);

    // JSDoc on the variable statement
    let description = '';
    const parent = varDecl.getParent()?.getParent();
    if (parent && 'getJsDocs' in parent) {
      const jsDocs = (parent as { getJsDocs: () => Array<{ getDescription: () => string }> }).getJsDocs();
      if (jsDocs.length > 0) {
        description = jsDocs[0].getDescription().trim().split('\n')[0].slice(0, 200);
      }
    }

    functionDetails.push({
      name: fnName,
      params,
      returnType: 'unknown',
      description,
      lineNumber: varDecl.getStartLineNumber(),
      complexity: computeCyclomaticComplexity(fnBody),
      isAsync,
      isExported,
      callsTo: callsInFn,
      calledBy: [],
    });

    if (!functions.includes(fnName)) {
      functions.push(fnName);
    }
  }

  // Extract class details
  const classNodes = sourceFile.getClasses();
  const classes = classNodes
    .map((klass) => klass.getName())
    .filter((name): name is string => Boolean(name));

  const classDetails: ClassDetail[] = classNodes
    .filter((klass) => Boolean(klass.getName()))
    .map((klass) => {
      let extendsName = '';
      let implementsNames: string[] = [];
      try { extendsName = klass.getExtends()?.getText() ?? ''; } catch { /* ignore */ }
      try { implementsNames = klass.getImplements().map((i) => i.getText()); } catch { /* ignore */ }
      return {
        name: klass.getName()!,
        methods: klass.getMethods().map((m) => m.getName()).filter(Boolean),
        properties: klass.getProperties().map((p) => p.getName()).filter(Boolean),
        extends: extendsName,
        implements: implementsNames,
        isExported: exportedNames.has(klass.getName()!),
        lineNumber: klass.getStartLineNumber(),
      };
    });

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).map((callExpression) => {
    const expressionText = callExpression.getExpression().getText();
    const expressionParts = expressionText.split('.');
    return expressionParts[expressionParts.length - 1];
  });

  const interfaces = sourceFile
    .getInterfaces()
    .map((iface) => iface.getName())
    .filter(Boolean);

  const typeAliases = sourceFile
    .getTypeAliases()
    .map((ta) => ta.getName())
    .filter(Boolean);

  let hasDefaultExport = false;
  try { hasDefaultExport = sourceFile.getDefaultExportSymbol() !== undefined; } catch { /* ignore */ }

  // LOC metrics
  const lines = sourceText.split(/\r?\n/);
  const linesOfCode = lines.length;
  const blankLines = lines.filter((l) => l.trim().length === 0).length;
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#');
  }).length;

  const complexity = computeCyclomaticComplexity(sourceText);

  // Data flow: what data this file receives (imports) and produces (exports)
  const dataFlowIn = dedupeSort(imports.filter((i) => i.startsWith('.')));
  const dataFlowOut = dedupeSort(exports);

  const sortedImports = dedupeSort(imports);
  return {
    path: relativeFilePath,
    size,
    imports: sortedImports,
    externalImports: dedupeSort(sortedImports.filter((item) => !item.startsWith('.'))),
    exports: dedupeSort(exports),
    functions: dedupeSort(functions),
    classes: dedupeSort(classes),
    calls: dedupeSort(calls.filter(Boolean)),
    linesOfCode,
    blankLines,
    commentLines,
    complexity,
    interfaces: dedupeSort(interfaces),
    typeAliases: dedupeSort(typeAliases),
    hasDefaultExport,
    functionDetails,
    classDetails,
    dataFlowIn,
    dataFlowOut,
  };
}

/**
 * Extracts function call names from a code body text.
 */
function extractCallNames(body: string): string[] {
  const calls: string[] = [];
  const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;
  const ignore = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'function', 'new', 'typeof', 'void', 'throw', 'delete', 'await', 'import', 'require', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Map', 'Set', 'Error', 'JSON', 'Math', 'Date', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
  while ((match = regex.exec(body)) !== null) {
    if (match[1] && !ignore.has(match[1])) {
      calls.push(match[1]);
    }
  }
  return [...new Set(calls)].sort();
}

/**
 * Uses conservative regex extraction for non-TS/JS files.
 */
function analyzeWithRegexFallback(relativeFilePath: string, size: number, sourceText: string): FileAnalysis {
  const imports = [
    ...captureRegex(sourceText, /import\s+[^'"\n]*['"]([^'"]+)['"]/g),
    ...captureRegex(sourceText, /require\(['"]([^'"]+)['"]\)/g),
  ];

  const exports = [
    ...captureRegex(sourceText, /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g),
    ...captureRegex(sourceText, /module\.exports\s*=\s*([A-Za-z_][A-Za-z0-9_]*)/g),
  ];

  const functions = captureRegex(
    sourceText,
    /(?:function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(|(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\()/g,
  );
  const classes = captureRegex(sourceText, /class\s+([A-Za-z_][A-Za-z0-9_]*)/g);
  const calls = captureRegex(sourceText, /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g).filter(
    (name) => !['if', 'for', 'while', 'switch', 'return', 'catch', 'function'].includes(name),
  );

  const interfaces = captureRegex(sourceText, /interface\s+([A-Za-z_][A-Za-z0-9_]*)/g);
  const typeAliases = captureRegex(sourceText, /type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g);
  const hasDefaultExport = /export\s+default\b/.test(sourceText);

  const lines = sourceText.split(/\r?\n/);
  const linesOfCode = lines.length;
  const blankLines = lines.filter((l) => l.trim().length === 0).length;
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#');
  }).length;

  const complexity = computeCyclomaticComplexity(sourceText);

  const sortedImports = dedupeSort(imports);
  return {
    path: relativeFilePath,
    size,
    imports: sortedImports,
    externalImports: dedupeSort(sortedImports.filter((item) => !item.startsWith('.'))),
    exports: dedupeSort(exports),
    functions: dedupeSort(functions),
    classes: dedupeSort(classes),
    calls: dedupeSort(calls),
    linesOfCode,
    blankLines,
    commentLines,
    complexity,
    interfaces: dedupeSort(interfaces),
    typeAliases: dedupeSort(typeAliases),
    hasDefaultExport,
    functionDetails: dedupeSort(functions).map((name) => ({
      name,
      params: [],
      returnType: 'unknown',
      description: '',
      lineNumber: 0,
      complexity: 1,
      isAsync: false,
      isExported: exports.includes(name),
      callsTo: [],
      calledBy: [],
    })),
    classDetails: dedupeSort(classes).map((name) => ({
      name,
      methods: [],
      properties: [],
      extends: '',
      implements: [],
      isExported: exports.includes(name),
      lineNumber: 0,
    })),
    dataFlowIn: dedupeSort(imports.filter((i) => i.startsWith('.'))),
    dataFlowOut: dedupeSort(exports),
  };
}

/**
 * Attempts optional tree-sitter parsing for non-TS languages when available.
 */
async function attemptTreeSitterParse(
  sourceText: string,
  language: string,
): Promise<
  | {
      imports: string[];
      exports: string[];
      functions: string[];
      classes: string[];
      calls: string[];
    }
  | null
> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (
    moduleName: string,
  ) => Promise<{ default?: unknown }>;

  try {
    const parserModule = await dynamicImport('tree-sitter');
    const ParserCtor = parserModule.default as
      | (new () => { setLanguage: (languageValue: unknown) => void; parse: (source: string) => { rootNode: { text: string } } })
      | undefined;

    if (!ParserCtor) {
      return null;
    }

    let languagePackage = '';
    if (language === 'py') {
      languagePackage = 'tree-sitter-python';
    }
    if (language === 'java') {
      languagePackage = 'tree-sitter-java';
    }
    if (language === 'go') {
      languagePackage = 'tree-sitter-go';
    }

    if (!languagePackage) {
      return null;
    }

    const languageModule = await dynamicImport(languagePackage);
    const grammar = languageModule.default;
    if (!grammar) {
      return null;
    }

    const parser = new ParserCtor();
    parser.setLanguage(grammar);
    const tree = parser.parse(sourceText);
    const rootText = tree.rootNode.text;

    return {
      imports: captureRegex(rootText, /import\s+[^'"\n]*\s+from\s+['"]([^'"]+)['"]/g),
      exports: captureRegex(rootText, /def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g),
      functions: captureRegex(rootText, /def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g),
      classes: captureRegex(rootText, /class\s+([A-Za-z_][A-Za-z0-9_]*)/g),
      calls: captureRegex(rootText, /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g),
    };
  } catch {
    return null;
  }
}

/**
 * Clones remote repository into a local cache directory.
 */
async function cloneRepositoryToLocal(
  repoUrl: string,
  targetPath: string,
  depth: number,
  force: boolean,
): Promise<string> {
  validateRemoteEnvVars();
  ensureSupportedUrl(repoUrl);

  if (force) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  if (await pathExists(targetPath)) {
    return targetPath;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  try {
    await simpleGit().clone(repoUrl, targetPath, ['--depth', String(depth)]);
    return targetPath;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/rate|403|429|limit/i.test(message)) {
      throw new Error(`Git clone failed due to rate limiting or authorization: ${message}`);
    }
    throw new Error(`Git clone failed: ${message}`);
  }
}

/**
 * Resolves local input path and validates that it is a directory.
 */
async function resolveLocalRepositoryPath(input: string): Promise<string> {
  const resolved = path.resolve(input);
  const stats = await fs.stat(resolved);
  if (!stats.isDirectory()) {
    throw new Error(`Input must be a directory path. Received: ${resolved}`);
  }
  return resolved;
}

/**
 * Resolves relative import specifiers into repository-relative file paths.
 */
function resolveImportToRepoPath(currentFilePath: string, importSpecifier: string, fileSet: Set<string>): string | null {
  if (!importSpecifier.startsWith('.')) {
    return null;
  }

  const baseDir = path.posix.dirname(currentFilePath);
  const normalizedImport = toPosixPath(path.posix.normalize(path.posix.join(baseDir, importSpecifier)));

  const candidates = [
    normalizedImport,
    `${normalizedImport}.ts`,
    `${normalizedImport}.tsx`,
    `${normalizedImport}.js`,
    `${normalizedImport}.jsx`,
    `${normalizedImport}.py`,
    `${normalizedImport}.java`,
    `${normalizedImport}.go`,
    `${normalizedImport}/index.ts`,
    `${normalizedImport}/index.tsx`,
    `${normalizedImport}/index.js`,
    `${normalizedImport}/index.jsx`,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.replace(/^\.\//, '');
    if (fileSet.has(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  return null;
}

/**
 * Converts path separators to POSIX style for deterministic output.
 */
function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Returns unique sorted strings.
 */
function dedupeSort(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Captures regex groups from all match occurrences.
 */
function captureRegex(source: string, regex: RegExp): string[] {
  const matches: string[] = [];
  let found: RegExpExecArray | null;

  while ((found = regex.exec(source)) !== null) {
    const candidate = found.slice(1).find((value) => Boolean(value));
    if (candidate) {
      matches.push(candidate);
    }
  }

  return matches;
}

/**
 * Reads JSON file if it exists, else returns null.
 */
async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Returns true if a path exists.
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a value looks like an HTTP(S) remote URL.
 */
function isRemoteUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates URL scheme before cloning.
 */
function ensureSupportedUrl(input: string): void {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid repository URL: ${input}`);
  }

  if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
    throw new Error(`Unsupported repository protocol: ${parsed.protocol}`);
  }
}

/**
 * Computes cyclomatic complexity by counting branching constructs.
 * Returns 1 (baseline) + number of branches.
 */
function computeCyclomaticComplexity(sourceText: string): number {
  const branchPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\?/g,
    /\?\./g,
    /&&/g,
    /\|\|/g,
    /\?\s*[^:]+\s*:/g,
  ];

  let count = 1; // baseline
  for (const pattern of branchPatterns) {
    const matches = sourceText.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}
