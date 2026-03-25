import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiPipeline } from "../ai/pipeline";
import type { DeterministicRule } from "../ai/types";

// Mock prisma
vi.mock("../prisma", () => ({
  prisma: {
    aiSuggestion: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

type TestInput = { fornitore: string; importo: number };

describe("AiPipeline", () => {
  const rules: DeterministicRule<TestInput>[] = [
    {
      name: "fornitore-noto-telecom",
      matches: (input) => input.fornitore.toLowerCase().includes("telecom"),
      apply: () => ({ categoriaId: 5, conto: "Telefonia" }),
    },
  ];

  const mockClassifier = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DETERMINISTIC when a rule matches", async () => {
    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Telecom Italia", importo: 200 },
      { societaId: 1, entityType: "Operazione", entityId: 1, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("DETERMINISTIC");
    expect(result.result).toEqual({ categoriaId: 5, conto: "Telefonia" });
    expect(mockClassifier).not.toHaveBeenCalled();
  });

  it("calls AI classifier when no rule matches", async () => {
    mockClassifier.mockResolvedValue({
      suggestion: { categoriaId: 10 },
      confidence: 0.95,
      motivazione: "Sembra un costo consulenza",
      tokensUsati: 150,
    });

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Bianchi Consulting", importo: 3000 },
      { societaId: 1, entityType: "Operazione", entityId: 2, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("AUTO_APPLIED");
    expect(mockClassifier).toHaveBeenCalled();
  });

  it("returns PENDING_REVIEW when AI confidence is below threshold", async () => {
    mockClassifier.mockResolvedValue({
      suggestion: { categoriaId: 10 },
      confidence: 0.6,
      motivazione: "Non sono sicuro",
      tokensUsati: 200,
    });

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Unknown Corp", importo: 5000 },
      { societaId: 1, entityType: "Operazione", entityId: 3, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("PENDING_REVIEW");
  });

  it("degrades to PENDING_REVIEW when AI classifier throws", async () => {
    mockClassifier.mockRejectedValue(new Error("API unavailable"));

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Unknown Corp", importo: 5000 },
      { societaId: 1, entityType: "Operazione", entityId: 4, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("PENDING_REVIEW");
  });
});
