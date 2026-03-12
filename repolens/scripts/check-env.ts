const REQUIRED_REMOTE_KEYS = ['GITHUB_TOKEN', 'LLM_PROVIDER', 'LLM_API_KEY'] as const;

/**
 * Returns missing required environment variables for remote operations.
 */
export function getMissingRemoteEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_REMOTE_KEYS.filter((key) => !env[key]);
}