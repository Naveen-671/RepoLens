import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createAiProvider, type AiProvider } from '../../ai/providers';
import { readArtifactJson } from './artifacts';

interface EmbeddingDoc {
  path: string;
  summary: string;
  embedding: number[];
  excerpt: string;
  comments: string[];
  createdAt: string;
}

interface ChatSource {
  path: string;
  excerpt: string;
}

interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  confidence: number;
  used_files: string[];
}

const QUERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_PER_REPO = 4;
const repoConcurrency = new Map<string, number>();
const repoQueue = new Map<string, Array<() => void>>();

/**
 * Runs retrieval-augmented chat for repository onboarding Q&A.
 */
export async function chatWithRepository(
  repoId: string,
  query: string,
  topK = 10,
  provider: AiProvider = createAiProvider(),
): Promise<ChatResponse> {
  if (!query.trim()) {
    throw new Error('query is required');
  }

  return runWithRepoConcurrency(repoId, async () => {
    const embeddings = await ensureEmbeddings(repoId, provider);
    const queryEmbedding = await getCachedQueryEmbedding(repoId, query, provider);
    const retrieved = rankBySimilarity(queryEmbedding, embeddings).slice(0, Math.max(1, Math.min(topK, 10)));

    const contextFiles = retrieved.map((item) => ({
      path: item.path,
      summary: item.summary,
      excerpt: redactSensitiveContent(item.excerpt),
    }));

    const prompt = buildRagPrompt(query, contextFiles);
    const completion = await provider.generate(prompt, { maxTokens: 800, temperature: 0.2 });
    const parsed = parseJsonFromText<{ answer: string; sources: ChatSource[]; confidence: number }>(completion);

    const fallbackSources = contextFiles.slice(0, 3).map((file) => ({
      path: file.path,
      excerpt: clampWords(file.excerpt, 25),
    }));

    const response: ChatResponse = {
      answer: parsed?.answer?.trim() || `Repository context indicates relevant files around ${contextFiles[0]?.path ?? 'core modules'}.`,
      sources:
        parsed?.sources?.map((source) => ({
          path: source.path,
          excerpt: clampWords(redactSensitiveContent(source.excerpt), 25),
        })) ?? fallbackSources,
      confidence: normalizeConfidence(parsed?.confidence),
      used_files: contextFiles.map((file) => file.path),
    };

    await logQuery(repoId, query, response);
    return response;
  });
}

/**
 * Ensures per-file embeddings are present and cached on disk.
 */
async function ensureEmbeddings(repoId: string, provider: AiProvider): Promise<EmbeddingDoc[]> {
  const [analysis, ai] = await Promise.all([
    readArtifactJson<{
      repo: string;
      files: Array<{ path: string }>;
    }>(repoId, 'analysis.json'),
    readArtifactJson<{
      fileSummaries: Array<{ path: string; summary: string }>;
    }>(repoId, 'ai.json'),
  ]);

  const summaryMap = new Map(ai.fileSummaries.map((item) => [item.path, item.summary]));
  const embeddingDir = path.join(getResultDir(repoId), 'embeddings');
  await fs.mkdir(embeddingDir, { recursive: true });

  const docs: EmbeddingDoc[] = [];
  for (const file of analysis.files) {
    const encoded = encodeFilePath(file.path);
    const embeddingPath = path.join(embeddingDir, `${encoded}.json`);

    const existing = await readJsonIfExists<EmbeddingDoc>(embeddingPath);
    if (existing?.embedding?.length) {
      docs.push(existing);
      continue;
    }

    const summary = summaryMap.get(file.path) ?? `File ${file.path}`;
    const comments = await extractTopComments(resolveSourceFilePath(analysis.repo, file.path));
    const excerpt = await extractRelevantCodeExcerpt(resolveSourceFilePath(analysis.repo, file.path), summary);
    const embedding = await provider.embed(`${file.path}\n${summary}`);

    const doc: EmbeddingDoc = {
      path: file.path,
      summary,
      embedding,
      excerpt,
      comments,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(embeddingPath, JSON.stringify(doc, null, 2), 'utf8');
    docs.push(doc);
  }

  return docs;
}

/**
 * Reads or computes cached query embedding and retrieval info.
 */
async function getCachedQueryEmbedding(repoId: string, query: string, provider: AiProvider): Promise<number[]> {
  const cacheDir = path.join(getResultDir(repoId), 'query-cache');
  await fs.mkdir(cacheDir, { recursive: true });
  const cacheKey = createHash('sha256').update(query).digest('hex');
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);

  const existing = await readJsonIfExists<{ embedding: number[]; createdAt: string }>(cachePath);
  if (existing) {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs < QUERY_CACHE_TTL_MS && Array.isArray(existing.embedding)) {
      return existing.embedding;
    }
  }

  const embedding = await provider.embed(query);
  await fs.writeFile(
    cachePath,
    JSON.stringify({
      embedding,
      createdAt: new Date().toISOString(),
    }),
    'utf8',
  );

  return embedding;
}

/**
 * Ranks embedding docs by cosine similarity.
 */
function rankBySimilarity(queryEmbedding: number[], docs: EmbeddingDoc[]): EmbeddingDoc[] {
  return [...docs].sort(
    (left, right) =>
      cosineSimilarity(queryEmbedding, right.embedding) - cosineSimilarity(queryEmbedding, left.embedding),
  );
}

/**
 * Builds the retrieval-augmented prompt template.
 */
function buildRagPrompt(
  query: string,
  files: Array<{ path: string; summary: string; excerpt: string }>,
): string {
  const fileText = files
    .slice(0, 10)
    .map((file) => `- PATH: ${file.path}\n  SUMMARY: ${file.summary}\n  EXCERPT: ${file.excerpt}`)
    .join('\n');

  return [
    "You are a senior software engineer. Answer the user's question about this repository concisely (1-6 sentences).",
    'You MUST only use information from the provided context files. For each claim add a source array with {path, short_excerpt}.',
    '',
    'User question:',
    query,
    '',
    'Context files (max 10):',
    fileText,
    '',
    'Output JSON:',
    '{',
    '  "answer":"...",',
    '  "sources":[ { "path":"", "excerpt":"" }, ... ],',
    '  "confidence":0.0',
    '}',
  ].join('\n');
}

/**
 * Limits concurrent chat requests per repository.
 */
async function runWithRepoConcurrency<T>(repoId: string, work: () => Promise<T>): Promise<T> {
  const current = repoConcurrency.get(repoId) ?? 0;
  if (current >= MAX_CONCURRENT_PER_REPO) {
    await new Promise<void>((resolve) => {
      const queue = repoQueue.get(repoId) ?? [];
      queue.push(resolve);
      repoQueue.set(repoId, queue);
    });
  }

  repoConcurrency.set(repoId, (repoConcurrency.get(repoId) ?? 0) + 1);
  try {
    return await work();
  } finally {
    repoConcurrency.set(repoId, Math.max(0, (repoConcurrency.get(repoId) ?? 1) - 1));
    const queue = repoQueue.get(repoId) ?? [];
    const next = queue.shift();
    repoQueue.set(repoId, queue);
    if (next) {
      next();
    }
  }
}

/**
 * Logs chat queries and responses for diagnostics.
 */
async function logQuery(repoId: string, query: string, response: ChatResponse): Promise<void> {
  const logDir = path.resolve(process.cwd(), 'data', 'logs', 'chat');
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `${repoId}.log`);

  const line = JSON.stringify({
    at: new Date().toISOString(),
    query,
    answer: response.answer,
    sources: response.sources,
  });

  await fs.appendFile(logPath, `${line}\n`, 'utf8');
}

/**
 * Builds result directory path for repository id.
 */
function getResultDir(repoId: string): string {
  return path.resolve(process.cwd(), 'data', 'results', repoId);
}

/**
 * Resolves repository file path when analysis repo is local.
 */
function resolveSourceFilePath(repoField: string, relativePath: string): string {
  if (path.isAbsolute(repoField)) {
    return path.join(repoField, relativePath);
  }
  return path.resolve(process.cwd(), relativePath);
}

/**
 * Extracts top three comment lines from source.
 */
async function extractTopComments(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const comments: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        comments.push(trimmed.replace(/^\/\/?\s?/, '').replace(/^#\s?/, '').replace(/^\*\s?/, ''));
      }
      if (comments.length >= 3) {
        break;
      }
    }
    return comments;
  } catch {
    return [];
  }
}

/**
 * Extracts up to five relevant source lines from a file.
 */
async function extractRelevantCodeExcerpt(filePath: string, hint: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const hintTokens = hint
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 3)
      .slice(0, 5);

    const selected = lines.filter((line) => hintTokens.some((token) => line.toLowerCase().includes(token))).slice(0, 5);
    const fallback = lines.slice(0, 5);
    return redactSensitiveContent((selected.length > 0 ? selected : fallback).join(' '));
  } catch {
    return 'No source excerpt available.';
  }
}

/**
 * Redacts likely secrets and env references before model usage.
 */
function redactSensitiveContent(text: string): string {
  return text
    .replace(/process\.env\.[A-Z0-9_]+/g, '[REDACTED_ENV]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[REDACTED_TOKEN]');
}

/**
 * Limits source excerpts to a maximum word count.
 */
function clampWords(text: string, maxWords: number): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');
}

/**
 * Parses JSON object from model output text.
 */
function parseJsonFromText<T>(text: string): T | null {
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart < 0 || objectEnd <= objectStart) {
    return null;
  }

  try {
    return JSON.parse(text.slice(objectStart, objectEnd + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Calculates cosine similarity for two vectors.
 */
function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/**
 * Encodes a file path for filesystem-safe embedding storage.
 */
function encodeFilePath(filePath: string): string {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

/**
 * Reads JSON file when available.
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
 * Clamps confidence into [0,1].
 */
function normalizeConfidence(input: number | undefined): number {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return 0.6;
  }
  return Math.max(0, Math.min(1, input));
}
