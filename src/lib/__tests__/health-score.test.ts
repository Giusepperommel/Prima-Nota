import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateHealthScore } from "../controlli/health-score";

vi.mock("../prisma", () => ({
  prisma: {
    anomalia: { count: vi.fn() },
    healthScore: { upsert: vi.fn().mockResolvedValue({ id: 1, scoreComplessivo: 85 }) },
  },
}));

import { prisma } from "../prisma";

describe("calculateHealthScore", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 100 when no anomalies exist", async () => {
    vi.mocked(prisma.anomalia.count).mockResolvedValue(0);

    const score = await calculateHealthScore(1, 2026, 3);
    expect(score.scoreComplessivo).toBe(100);
    expect(prisma.healthScore.upsert).toHaveBeenCalled();
  });

  it("deducts points for open anomalies by priority", async () => {
    // Mock: 1 CRITICA, 2 ALTA, 0 MEDIA, 0 BASSA per area
    vi.mocked(prisma.anomalia.count)
      .mockResolvedValueOnce(1)  // contabilita CRITICA
      .mockResolvedValueOnce(0)  // contabilita ALTA
      .mockResolvedValueOnce(0)  // iva CRITICA
      .mockResolvedValueOnce(2)  // iva ALTA
      .mockResolvedValueOnce(0)  // scadenze CRITICA
      .mockResolvedValueOnce(0)  // scadenze ALTA
      .mockResolvedValueOnce(0)  // documentale CRITICA
      .mockResolvedValueOnce(0)  // documentale ALTA
      .mockResolvedValueOnce(0)  // banca CRITICA
      .mockResolvedValueOnce(0); // banca ALTA

    const score = await calculateHealthScore(1, 2026, 3);
    expect(score.areaContabilita).toBeLessThan(100);
    expect(score.areaIva).toBeLessThan(100);
  });
});
