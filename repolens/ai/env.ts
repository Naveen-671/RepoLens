const REQUIRED_ENV_KEYS = ['GITHUB_TOKEN', 'LLM_PROVIDER', 'LLM_API_KEY'] as const;

/**
 * Validates required environment variables before any remote operation.
 */
export function validateRemoteEnvVars(env: NodeJS.ProcessEnv = process.env): void {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}