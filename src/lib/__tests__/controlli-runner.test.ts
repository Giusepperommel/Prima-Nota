import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAllChecks } from "../controlli/runner";

vi.mock("../prisma", () => ({
  prisma: {
    anomalia: {
      findFirst: vi.fn().mockResolvedValue(null),  // no existing anomalies
      create: vi.fn().mockResolvedValue({ id: 1 }),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../controlli/catalog", () => ({
  getAllChecks: vi.fn().mockReturnValue([
    {
      id: "test-check",
      nome: "Test Check",
      sorgente: "REGOLA",
      run: vi.fn().mockResolvedValue({
        found: true,
        anomalie: [{
          tipo: "QUADRATURA", sorgente: "REGOLA", priorita: "CRITICA",
          titolo: "Test", descrizione: "Test desc",
        }],
      }),
    },
  ]),
}));

import { prisma } from "../prisma";

describe("runAllChecks", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runs all registered checks and creates anomalie", async () => {
    const result = await runAllChecks(1, 2026);
    expect(result.checksEseguiti).toBe(1);
    expect(result.anomalieTrovate).toBe(1);
    expect(prisma.anomalia.create).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate anomalies (same entity+tipo)", async () => {
    vi.mocked(prisma.anomalia.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await runAllChecks(1, 2026);
    expect(result.anomalieTrovate).toBe(1);
    expect(prisma.anomalia.create).not.toHaveBeenCalled();
  });
});
