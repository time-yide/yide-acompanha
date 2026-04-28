// SERVER ONLY: do not import from client components
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Retorna cliente Anthropic singleton, ou null se ANTHROPIC_API_KEY não estiver configurado.
 * Callers devem checar null e fallback gracioso.
 */
export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const SATISFACTION_MODEL = "claude-haiku-4-5";

export const MAX_TOKENS = 1024;
