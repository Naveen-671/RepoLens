/**
 * Validates required environment variables before any remote operation.
 * GITHUB_TOKEN is only required for cloning private repos.
 */
export function validateRemoteEnvVars(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.GITHUB_TOKEN) {
    process.stderr.write('Warning: GITHUB_TOKEN not set. Private repo cloning will fail.\n');
  }
}