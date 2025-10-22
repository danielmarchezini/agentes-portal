export type ModelPricing = {
  promptPerMTokens: number; // USD per 1M prompt tokens
  completionPerMTokens: number; // USD per 1M completion tokens
};

// Ajuste conforme sua tabela de preços atual
export const PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { promptPerMTokens: 5.0, completionPerMTokens: 15.0 },
  'gpt-4o-mini': { promptPerMTokens: 0.5, completionPerMTokens: 1.5 },
  'gpt-3.5-turbo': { promptPerMTokens: 0.5, completionPerMTokens: 1.5 },
  // Aliases/comuns
  'gpt-4-turbo': { promptPerMTokens: 10.0, completionPerMTokens: 30.0 },
  'gpt-4.1': { promptPerMTokens: 5.0, completionPerMTokens: 15.0 },
  'gpt-4.1-mini': { promptPerMTokens: 3.0, completionPerMTokens: 15.0 },
  'gpt-4o-2024-08-06': { promptPerMTokens: 5.0, completionPerMTokens: 15.0 },
  'gpt-4o-mini-2024-07-18': { promptPerMTokens: 0.5, completionPerMTokens: 1.5 },
  'gpt-3.5-turbo-0125': { promptPerMTokens: 0.5, completionPerMTokens: 1.5 },
  // Gemini (valores aproximados - ajuste conforme seu contrato)
  'gemini-1.5-pro': { promptPerMTokens: 3.5, completionPerMTokens: 10.5 },
  'gemini-1.5-flash': { promptPerMTokens: 0.35, completionPerMTokens: 1.05 },
  'gemini-2.5-pro': { promptPerMTokens: 3.5, completionPerMTokens: 10.5 },
  'gemini-2.5-flash': { promptPerMTokens: 0.35, completionPerMTokens: 1.05 },
  'gemini-1.5-pro-latest': { promptPerMTokens: 3.5, completionPerMTokens: 10.5 },
  'gemini-1.5-flash-latest': { promptPerMTokens: 0.35, completionPerMTokens: 1.05 },
  // Anthropic (aprox.)
  'claude-3-5-sonnet-20241022': { promptPerMTokens: 3.0, completionPerMTokens: 15.0 },
  'claude-3-opus-20240229': { promptPerMTokens: 15.0, completionPerMTokens: 75.0 },
  // Perplexity (aprox.)
  'sonar': { promptPerMTokens: 1.0, completionPerMTokens: 1.0 },
  'sonar-small': { promptPerMTokens: 0.6, completionPerMTokens: 0.6 },
};

export function computeCostUSD(modelId: string | undefined | null, promptTokens: number, completionTokens: number): number {
  if (!modelId) return 0;
  const key = modelId.toLowerCase();
  const p = PRICING[key] || PRICING['gpt-4o'];
  return ((promptTokens * p.promptPerMTokens) + (completionTokens * p.completionPerMTokens)) / 1_000_000;
}
