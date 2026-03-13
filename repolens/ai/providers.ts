import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import axios, { type AxiosRequestConfig } from 'axios';

export type LlmProvider = 'groq' | 'nim' | 'nvidia' | 'openai';

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface AiProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
}

interface ProviderConfig {
  provider: LlmProvider;
  apiKey: string;
  cacheDir: string;
}

const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;
const waitingResolvers: Array<() => void> = [];

/**
 * Creates a provider-agnostic AI adapter from environment variables.
 */
export function createAiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  const provider = normalizeProvider((env.LLM_PROVIDER ?? 'openai') as LlmProvider);
  const apiKey = resolveApiKey(provider, env);
  const cacheDir = path.resolve(process.cwd(), env.CACHE_DIR ?? './data/cache');

  return {
    async generate(prompt: string, options: GenerateOptions = {}) {
      const config = { provider, apiKey, cacheDir };
      const cacheKey = hashPrompt(`generate:${provider}:${JSON.stringify(options)}:${prompt}`);
      const cachePath = path.join(cacheDir, `${cacheKey}.json`);
      const cached = await readCachedValue(cachePath);
      if (cached) {
        return cached;
      }

      const response = await withRetry(async () => {
        return withRateLimit(() => requestChatCompletion(config, prompt, options));
      });

      await writeCachedValue(cachePath, response);
      return response;
    },

    async embed(text: string) {
      const config = { provider, apiKey, cacheDir };
      const cacheKey = hashPrompt(`embed:${provider}:${text}`);
      const cachePath = path.join(cacheDir, `${cacheKey}.json`);
      const cached = await readCachedEmbedding(cachePath);
      if (cached) {
        return cached;
      }

      const embedding = await withRetry(async () => {
        return withRateLimit(() => requestEmbedding(config, text));
      });

      await writeCachedEmbedding(cachePath, embedding);
      return embedding;
    },
  };
}

/**
 * Resolves the API key for the given provider, checking provider-specific env vars first.
 */
function resolveApiKey(provider: LlmProvider, env: NodeJS.ProcessEnv): string {
  if (provider === 'groq' && env.GROQ_API_KEY) {
    return env.GROQ_API_KEY;
  }
  if ((provider === 'nim' || provider === 'nvidia') && env.NVIDIA_API_KEY) {
    return env.NVIDIA_API_KEY;
  }
  return env.LLM_API_KEY ?? '';
}

/**
 * Hashes prompt text into deterministic cache keys.
 */
function hashPrompt(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Runs work under a global request concurrency limit.
 */
async function withRateLimit<T>(work: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => waitingResolvers.push(resolve));
  }

  activeRequests += 1;
  try {
    return await work();
  } finally {
    activeRequests -= 1;
    const next = waitingResolvers.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Retries transient provider failures with exponential backoff.
 */
async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error: unknown) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }
      const waitMs = Math.pow(2, attempt) * 250;
      await sleep(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Executes chat completion request via OpenAI-compatible endpoints.
 */
async function requestChatCompletion(
  config: ProviderConfig,
  prompt: string,
  options: GenerateOptions,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('LLM_API_KEY is required for AI generation');
  }

  const endpoint = getChatEndpoint(config.provider);
  const model = getDefaultModel(config.provider);

  const data: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 800,
  };

  // Enable thinking mode for Qwen models on NVIDIA
  if ((config.provider === 'nim' || config.provider === 'nvidia') && model.startsWith('qwen/')) {
    data.chat_template_kwargs = { enable_thinking: true };
    data.max_tokens = Math.max(options.maxTokens ?? 800, 4096);
  }

  const request: AxiosRequestConfig = {
    method: 'POST',
    url: endpoint,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    data,
    timeout: 60000,
  };

  const response = await axios(request);
  let message = response.data?.choices?.[0]?.message?.content;
  if (!message || typeof message !== 'string') {
    throw new Error('Provider returned empty completion content');
  }

  // Strip <think>...</think> blocks from thinking-mode models
  message = message.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  return message;
}

/**
 * Executes embedding request using provider-compatible endpoint.
 * Falls back to local trigram hash embeddings for providers without embedding support (e.g. Groq).
 */
async function requestEmbedding(config: ProviderConfig, text: string): Promise<number[]> {
  // Groq does not support embeddings — use local trigram hash embedding
  if (config.provider === 'groq') {
    return localTrigramEmbedding(text);
  }

  if (!config.apiKey) {
    throw new Error('LLM_API_KEY is required for embeddings');
  }

  const endpoint = getEmbeddingEndpoint(config.provider);
  const model = getDefaultEmbeddingModel(config.provider);

  const response = await axios({
    method: 'POST',
    url: endpoint,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      model,
      input: text,
    },
    timeout: 20000,
  });

  const vector = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error('Provider returned invalid embedding output');
  }

  return vector as number[];
}

/**
 * Generates a deterministic 256-dimension embedding from text using character trigram hashing.
 * Suitable for cosine similarity ranking when no remote embedding API is available.
 */
function localTrigramEmbedding(text: string): number[] {
  const dims = 256;
  const vec = new Float64Array(dims);
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hash = createHash('md5').update(trigram).digest();
    const idx = hash.readUInt16BE(0) % dims;
    vec[idx] += 1;
  }
  // L2-normalize the vector
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const result: number[] = [];
  for (let i = 0; i < dims; i++) result.push(vec[i] / norm);
  return result;
}

/**
 * Returns chat completion endpoint for the configured provider.
 */
function getChatEndpoint(provider: LlmProvider): string {
  if (provider === 'groq') {
    return 'https://api.groq.com/openai/v1/chat/completions';
  }
  if (provider === 'nim' || provider === 'nvidia') {
    return 'https://integrate.api.nvidia.com/v1/chat/completions';
  }
  return 'https://api.openai.com/v1/chat/completions';
}

/**
 * Returns embeddings endpoint for the configured provider.
 */
function getEmbeddingEndpoint(provider: LlmProvider): string {
  if (provider === 'groq') {
    return 'https://api.groq.com/openai/v1/embeddings';
  }
  if (provider === 'nim' || provider === 'nvidia') {
    return 'https://integrate.api.nvidia.com/v1/embeddings';
  }
  return 'https://api.openai.com/v1/embeddings';
}

/**
 * Returns default chat model by provider.
 */
function getDefaultModel(provider: LlmProvider): string {
  if (provider === 'groq') {
    return 'llama-3.3-70b-versatile';
  }
  if (provider === 'nim' || provider === 'nvidia') {
    return 'qwen/qwen3.5-397b-a17b';
  }
  return 'gpt-4o-mini';
}

/**
 * Returns default embedding model by provider.
 */
function getDefaultEmbeddingModel(provider: LlmProvider): string {
  if (provider === 'groq') {
    return 'nomic-embed-text-v1.5';
  }
  if (provider === 'nim' || provider === 'nvidia') {
    return 'nvidia/nv-embedqa-e5-v5';
  }
  return 'text-embedding-3-small';
}

/**
 * Normalizes accepted provider aliases to supported runtime values.
 */
function normalizeProvider(provider: LlmProvider): LlmProvider {
  if (provider === 'nvidia') {
    return 'nim';
  }
  return provider;
}

/**
 * Reads a cached string value from disk if available.
 */
async function readCachedValue(cachePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as { value?: string };
    return typeof parsed.value === 'string' ? parsed.value : null;
  } catch {
    return null;
  }
}

/**
 * Writes a cached string value to disk.
 */
async function writeCachedValue(cachePath: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify({ value }), 'utf8');
}

/**
 * Reads a cached embedding vector from disk if available.
 */
async function readCachedEmbedding(cachePath: string): Promise<number[] | null> {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as { vector?: number[] };
    return Array.isArray(parsed.vector) ? parsed.vector : null;
  } catch {
    return null;
  }
}

/**
 * Writes an embedding vector to the cache directory.
 */
async function writeCachedEmbedding(cachePath: string, vector: number[]): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify({ vector }), 'utf8');
}

/**
 * Sleeps for the given number of milliseconds.
 */
async function sleep(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
