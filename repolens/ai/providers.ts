export type LlmProvider = 'groq' | 'nim' | 'openai';

export interface AiProvider {
  name: LlmProvider;
  summarize(prompt: string): Promise<string>;
}

/**
 * Returns a provider-compatible summary response stub for now.
 */
export async function summarizeWithProvider(
  provider: AiProvider,
  prompt: string,
): Promise<string> {
  return provider.summarize(prompt);
}