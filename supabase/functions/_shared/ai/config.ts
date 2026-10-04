export const GEMINI_MODEL = 'gemini-2.5-flash';
export const MAX_AGENT_MESSAGE_LENGTH = 4000;
export const MAX_CONTEXT_ITEMS = 50;
export const MAX_RECOMMENDATIONS = 3;

export class AiConfigurationError extends Error {
  constructor() {
    super('AI service is not configured.');
    this.name = 'AiConfigurationError';
  }
}

export class AiProviderError extends Error {
  constructor() {
    super('AI provider request failed.');
    this.name = 'AiProviderError';
  }
}

export function getGeminiApiKey(): string {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey || apiKey === 'PASTE_YOUR_GEMINI_KEY_HERE') throw new AiConfigurationError();
  return apiKey;
}
