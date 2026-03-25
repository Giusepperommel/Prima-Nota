type ModelTier = "haiku" | "sonnet" | "opus";

// Pricing per 1M tokens (USD) — update as pricing changes
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3, output: 15 },
  opus: { input: 15, output: 75 },
};

export function calculateAiCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelTier = "haiku",
): number {
  const pricing = PRICING[model];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function formatTokenUsage(
  totalTokens: number,
  totalRequests: number,
): { totalTokens: number; totalRequests: number; avgTokensPerRequest: number } {
  return {
    totalTokens,
    totalRequests,
    avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
  };
}
