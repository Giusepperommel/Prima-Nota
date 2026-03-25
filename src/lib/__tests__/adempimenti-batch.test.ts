import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generaTuttiF24Pronti,
  calcolaTutteLiquidazioni,
  getScadenzeMultiSocieta,
} from "../adempimenti/batch";

vi.mock("../prisma", () => ({
  prisma: {
    scadenzaFiscale: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("generaTuttiF24Pronti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of societa with ready F24s", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      { id: 1, societaId: 1, tipo: "F24_IVA", stato: "PRONTA", societa: { ragioneSociale: "A SRL" } },
      { id: 2, societaId: 2, tipo: "F24_IVA", stato: "PRONTA", societa: { ragioneSociale: "B SRL" } },
    ] as any);

    const result = await generaTuttiF24Pronti([1, 2], 2026, 3);
    expect(result).toHaveLength(2);
  });

  it("queries for F24_IVA and F24_RITENUTE with stato PRONTA", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    await generaTuttiF24Pronti([1, 2], 2026, 3);
    expect(prisma.scadenzaFiscale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societaId: { in: [1, 2] },
          tipo: { in: ["F24_IVA", "F24_RITENUTE"] },
          anno: 2026,
          periodo: 3,
          stato: "PRONTA",
        },
      })
    );
  });

  it("returns empty array when no ready F24s exist", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    const result = await generaTuttiF24Pronti([1], 2026, 3);
    expect(result).toHaveLength(0);
  });
});

describe("calcolaTutteLiquidazioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns societa with in-preparation F24 IVA deadlines", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      {
        id: 1,
        societaId: 1,
        tipo: "F24_IVA",
        stato: "IN_PREPARAZIONE",
        societa: { ragioneSociale: "A SRL" },
        checklist: [{ completata: true }, { completata: false }],
      },
    ] as any);

    const result = await calcolaTutteLiquidazioni([1, 2], 2026, 3);
    expect(result).toHaveLength(1);
  });

  it("queries for F24_IVA with stato IN_PREPARAZIONE", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    await calcolaTutteLiquidazioni([1, 2], 2026, 3);
    expect(prisma.scadenzaFiscale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societaId: { in: [1, 2] },
          tipo: "F24_IVA",
          anno: 2026,
          periodo: 3,
          stato: "IN_PREPARAZIONE",
        },
      })
    );
  });
});

describe("getScadenzeMultiSocieta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines for the given month across multiple societa", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      {
        id: 1,
        societaId: 1,
        tipo: "F24_IVA",
        scadenza: new Date("2026-03-16"),
        societa: { ragioneSociale: "A SRL" },
        checklist: [],
      },
      {
        id: 2,
        societaId: 2,
        tipo: "F24_IVA",
        scadenza: new Date("2026-03-16"),
        societa: { ragioneSociale: "B SRL" },
        checklist: [],
      },
    ] as any);

    const result = await getScadenzeMultiSocieta([1, 2], 2026, 3);
    expect(result).toHaveLength(2);
  });

  it("queries with correct date range for the month", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    await getScadenzeMultiSocieta([1], 2026, 3);
    expect(prisma.scadenzaFiscale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societaId: { in: [1] },
          scadenza: {
            gte: new Date(2026, 2, 1),  // March 1
            lte: new Date(2026, 3, 0),  // March 31
          },
        },
        orderBy: { scadenza: "asc" },
      })
    );
  });

  it("includes societa and checklist in the query", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    await getScadenzeMultiSocieta([1], 2026, 3);
    expect(prisma.scadenzaFiscale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          societa: { select: { ragioneSociale: true } },
          checklist: true,
        },
      })
    );
  });

  it("returns empty array when no deadlines exist", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([]);

    const result = await getScadenzeMultiSocieta([1], 2026, 1);
    expect(result).toHaveLength(0);
  });
});
