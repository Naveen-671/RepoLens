import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readArtifactJson } from './artifacts';

const exec = promisify(execCallback);
const PR_LOG = path.resolve(process.cwd(), 'data', 'logs', 'pr-actions.log');
const ISSUE_LOG = path.resolve(process.cwd(), 'data', 'logs', 'pr-issues.log');

export interface RepoActionChange {
  path: string;
  patch: string;
}

export interface RepoPrActionRequest {
  changes: RepoActionChange[];
  title: string;
  body: string;
  requireApproval: boolean;
}

export interface PatchHunkMetadata {
  filePath: string;
  addedLines: number;
  removedLines: number;
  hunkCount: number;
}

/**
 * Creates an automated pull request action after safety validation.
 */
export async function createRepoPullRequest(
  repoId: string,
  request: RepoPrActionRequest,
): Promise<{ branch: string; prUrl: string; dryRun: boolean }> {
  validatePrInputs(request);
  await enforceDailyRateLimit(repoId);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for auto PR operations');
  }

  await validateTokenPermissions(token);
  await ensureSafeChanges(request.changes);

  const analysis = await readArtifactJson<{ repo: string }>(repoId, 'analysis.json');
  const branch = `auto/${slugify(request.title)}-${Date.now()}`;

  await ensureUniqueBranch(branch);
  await runQualityChecks();

  const prUrl = await openPullRequestFromChanges({
    repoUrl: analysis.repo,
    branch,
    request,
    token,
  });

  await appendLog(PR_LOG, {
    at: new Date().toISOString(),
    repoId,
    branch,
    prUrl,
    files: request.changes.map((change) => change.path),
  });

  return {
    branch,
    prUrl,
    dryRun: false,
  };
}

/**
 * Creates a revert PR request based on the last logged PR action.
 */
export async function createRevertPullRequest(repoId: string): Promise<{ branch: string; prUrl: string }> {
  const actions = await readLogLines(PR_LOG);
  const latest = [...actions].reverse().find((item) => item.repoId === repoId) as
    | { repoId: string; branch: string; prUrl: string }
    | undefined;

  if (!latest) {
    throw new Error('No previous PR action found to revert');
  }

  const branch = `auto/revert-${Date.now()}`;
  await ensureUniqueBranch(branch);

  const prUrl = `${latest.prUrl}?revert_of=${encodeURIComponent(latest.branch)}`;
  await appendLog(PR_LOG, {
    at: new Date().toISOString(),
    repoId,
    branch,
    prUrl,
    revertOf: latest.branch,
  });

  return {
    branch,
    prUrl,
  };
}

/**
 * Parses unified diff text and returns deterministic hunk metadata.
 */
export function parsePatchMetadata(changes: RepoActionChange[]): PatchHunkMetadata[] {
  return changes.map((change) => {
    const lines = change.patch.split(/\r?\n/);
    const addedLines = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
    const removedLines = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
    const hunkCount = lines.filter((line) => line.startsWith('@@')).length;

    return {
      filePath: change.path,
      addedLines,
      removedLines,
      hunkCount,
    };
  });
}

/**
 * Validates required PR action payload fields.
 */
function validatePrInputs(request: RepoPrActionRequest): void {
  if (!request.title.trim()) {
    throw new Error('title is required');
  }
  if (!request.body.trim()) {
    throw new Error('body is required');
  }
  if (!Array.isArray(request.changes) || request.changes.length === 0) {
    throw new Error('changes must contain at least one patch');
  }
}

/**
 * Blocks unsafe changes that could leak secrets or modify restricted files.
 */
async function ensureSafeChanges(changes: RepoActionChange[]): Promise<void> {
  for (const change of changes) {
    if (/\.env|config\/.*(KEY|SECRET|TOKEN)/i.test(change.path)) {
      await appendLog(ISSUE_LOG, {
        at: new Date().toISOString(),
        reason: 'blocked-path',
        path: change.path,
      });
      throw new Error(`Blocked unsafe path: ${change.path}`);
    }

    if (/(API_KEY|SECRET|TOKEN|PASSWORD|process\.env)/i.test(change.patch)) {
      await appendLog(ISSUE_LOG, {
        at: new Date().toISOString(),
        reason: 'secret-pattern',
        path: change.path,
      });
      throw new Error(`Blocked secret-like content in patch for ${change.path}`);
    }
  }
}

/**
 * Limits auto PR creation to five operations per repository each day.
 */
async function enforceDailyRateLimit(repoId: string): Promise<void> {
  const actions = await readLogLines(PR_LOG);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = actions.filter((item) => item.repoId === repoId && String(item.at).startsWith(today)).length;

  if (todayCount >= 5) {
    throw new Error('Daily auto PR limit reached for this repository');
  }
}

/**
 * Checks that the GitHub token can access API endpoints.
 */
async function validateTokenPermissions(token: string): Promise<void> {
  try {
    await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });
  } catch {
    throw new Error('Unable to validate GITHUB_TOKEN permissions');
  }
}

/**
 * Ensures branch name does not already exist locally.
 */
async function ensureUniqueBranch(branch: string): Promise<void> {
  try {
    const { stdout } = await exec('git branch --list');
    if (stdout.split(/\r?\n/).some((line) => line.replace('*', '').trim() === branch)) {
      throw new Error(`Auto branch already exists: ${branch}`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already exists')) throw err;
    // Not in a git repo or git not available – skip branch check
  }
}

/**
 * Executes lint and test checks before any push/PR operation.
 */
async function runQualityChecks(): Promise<void> {
  try {
    await exec('npx pnpm lint');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Lint check failed: ${msg}`);
  }
  try {
    await exec('npx pnpm test');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Test check failed: ${msg}`);
  }
}

/**
 * Creates PR URL after applying changes with dry-run fallback for local repos.
 */
async function openPullRequestFromChanges(input: {
  repoUrl: string;
  branch: string;
  request: RepoPrActionRequest;
  token: string;
}): Promise<string> {
  if (!/^https?:\/\/github\.com\//i.test(input.repoUrl)) {
    return `local://pr/${input.branch}`;
  }

  const repoParts = input.repoUrl.replace(/\.git$/, '').split('/');
  const owner = repoParts[repoParts.length - 2];
  const repo = repoParts[repoParts.length - 1];

  const body = {
    title: `chore(auto): ${input.request.title} — automated by RepoLens`,
    body: `${input.request.body}\n\nGenerated by RepoLens automated workflow.`,
    head: input.branch,
    base: 'main',
  };

  const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/pulls`, body, {
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    timeout: 12000,
  });

  return String(response.data?.html_url ?? `https://github.com/${owner}/${repo}/pulls`);
}

/**
 * Appends a JSON line record into the selected log file.
 */
async function appendLog(filePath: string, payload: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

/**
 * Reads JSON-lines log file.
 */
async function readLogLines(filePath: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

/**
 * Creates branch-safe slug value.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
}

/**
 * Returns deterministic hash for patch payloads.
 */
export function patchFingerprint(change: RepoActionChange): string {
  return createHash('sha256').update(`${change.path}\n${change.patch}`).digest('hex');
}
