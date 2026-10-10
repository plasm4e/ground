import Anthropic from '@anthropic-ai/sdk';
import type { Extraction } from '@ground/core';
import { ClaudeExtractor, ExtractionError, type ExtractInput } from '@ground/core/claude';

/**
 * Reads a document with Claude straight from the app, using the user's own API key.
 * The key never leaves the device except to go to Anthropic.
 */
export async function extractWithOwnKey(apiKey: string, model: string, input: ExtractInput): Promise<Extraction> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 180_000 });
  try {
    return await new ClaudeExtractor(client, model).extract(input);
  } catch (e) {
    throw new Error(describe(e));
  }
}

function describe(e: unknown): string {
  if (e instanceof ExtractionError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'the Anthropic API key is not valid';
  if (e instanceof Anthropic.PermissionDeniedError) return 'this API key is not allowed to use that model';
  if (e instanceof Anthropic.RateLimitError) return 'too many requests, try again in a minute';
  if (e instanceof Anthropic.APIConnectionError) return 'could not reach Anthropic, check your connection';
  if (e instanceof Anthropic.APIError) {
    if (/credit balance/i.test(e.message)) return 'your Anthropic account has no credits left';
    return `Anthropic error ${e.status ?? ''}`.trim();
  }
  return 'unexpected error';
}
