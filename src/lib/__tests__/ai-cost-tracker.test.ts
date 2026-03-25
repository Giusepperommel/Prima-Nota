import { describe, it, expect } from "vitest";
import { calculateAiCost, formatTokenUsage } from "../ai/cost-tracker";

describe("calculateAiCost", () => {
  it("calculates cost for haiku model", () => {
    const cost = calculateAiCost(1000, 500, "haiku");
    // Haiku: $0.25/1M input, $1.25/1M output
    expect(cost).toBeCloseTo(0.000875, 5);
  });

  it("calculates cost for sonnet model", () => {
    const cost = calculateAiCost(1000, 500, "sonnet");
    // Sonnet: $3/1M input, $15/1M output
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateAiCost(0, 0, "haiku")).toBe(0);
  });
});

describe("formatTokenUsage", () => {
  it("formats usage summary", () => {
    const result = formatTokenUsage(15000, 25);
    expect(result.totalTokens).toBe(15000);
    expect(result.totalRequests).toBe(25);
    expect(result.avgTokensPerRequest).toBe(600);
  });
});
