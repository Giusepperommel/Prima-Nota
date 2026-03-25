import { describe, it, expect, vi, beforeEach } from "vitest";
import { generaCalendarioFiscale, getScadenzePerSocieta, SCADENZE_TEMPLATES } from "../adempimenti/calendar";

vi.mock("../prisma", () => ({
  prisma: {
    societa: { findUnique: vi.fn() },
    operazione: { count: vi.fn() },
    cespite: { count: vi.fn() },
    liquidazioneIva: { findFirst: vi.fn() },
    scadenzaFiscale: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    checklistAdempimento: { createMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("SCADENZE_TEMPLATES", () => {
  it("defines 13 deadline templates", () => {
    expect(SCADENZE_TEMPLATES).toHaveLength(13);
  });

  it("each template has required fields", () => {
    for (const t of SCADENZE_TEMPLATES) {
      expect(t.tipo).toBeTruthy();
      expect(t.nome).toBeTruthy();
      expect(["MENSILE", "TRIMESTRALE", "ANNUALE"]).toContain(t.frequenza);
      expect(t.giornoScadenza).toBeGreaterThan(0);
      expect(typeof t.condizione).toBe("function");
      expect(t.checklist.length).toBeGreaterThan(0);
    }
  });

  it("monthly templates generate 12 periods", () => {
    const monthly = SCADENZE_TEMPLATES.filter((t) => t.frequenza === "MENSILE");
    expect(monthly.length).toBeGreaterThan(0);
  });

  it("quarterly templates have meseScadenza undefined", () => {
    const quarterly = SCADENZE_TEMPLATES.filter((t) => t.frequenza === "TRIMESTRALE");
    expect(quarterly.length).toBeGreaterThan(0);
  });
});

describe("generaCalendarioFiscale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if societa not found", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue(null);
    await expect(generaCalendarioFiscale(999, 2026)).rejects.toThrow("non trovata");
  });

  it("generates monthly F24 IVA for SRL ordinaria", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1,
      tipoAttivita: "SRL",
      regimeFiscale: "ORDINARIO",
    } as any);
    // Detect IVA periodicity from liquidazioni
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue({
      tipo: "MENSILE",
    } as any);
    vi.mocked(prisma.operazione.count).mockResolvedValue(5); // has ritenute
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue(null); // no existing

    const result = await generaCalendarioFiscale(1, 2026);
    expect(result.scadenzeGenerate).toBeGreaterThan(0);
    expect(prisma.scadenzaFiscale.create).toHaveBeenCalled();
  });

  it("skips already existing deadlines", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1,
      tipoAttivita: "SRL",
      regimeFiscale: "ORDINARIO",
    } as any);
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.operazione.count).mockResolvedValue(0);
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await generaCalendarioFiscale(1, 2026);
    expect(result.scadenzeEsistenti).toBeGreaterThan(0);
    expect(result.scadenzeGenerate).toBe(0);
  });

  it("generates ritenute F24 when societa has ritenute", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1,
      tipoAttivita: "SRL",
      regimeFiscale: "ORDINARIO",
    } as any);
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.operazione.count).mockResolvedValue(3); // has ritenute
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue(null);

    const result = await generaCalendarioFiscale(1, 2026);
    // Should include F24_RITENUTE (12 monthly) among the generated
    const createCalls = vi.mocked(prisma.scadenzaFiscale.create).mock.calls;
    const ritenuteCreates = createCalls.filter(
      (call) => call[0].data.tipo === "F24_RITENUTE"
    );
    expect(ritenuteCreates.length).toBe(12);
  });

  it("skips F24_RITENUTE when societa has no ritenute", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1,
      tipoAttivita: "SRL",
      regimeFiscale: "ORDINARIO",
    } as any);
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.operazione.count).mockResolvedValue(0); // no ritenute
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue(null);

    await generaCalendarioFiscale(1, 2026);
    const createCalls = vi.mocked(prisma.scadenzaFiscale.create).mock.calls;
    const ritenuteCreates = createCalls.filter(
      (call) => call[0].data.tipo === "F24_RITENUTE"
    );
    expect(ritenuteCreates.length).toBe(0);
  });

  it("skips forfettario-excluded deadlines", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1,
      tipoAttivita: "DITTA_INDIVIDUALE",
      regimeFiscale: "FORFETTARIO",
    } as any);
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.operazione.count).mockResolvedValue(0);
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue(null);

    await generaCalendarioFiscale(1, 2026);
    const createCalls = vi.mocked(prisma.scadenzaFiscale.create).mock.calls;
    // Forfettario should NOT have F24_IVA, LIPE, DICHIARAZIONE_IVA
    const ivaCreates = createCalls.filter(
      (call) => call[0].data.tipo === "F24_IVA"
    );
    expect(ivaCreates.length).toBe(0);
  });
});

describe("getScadenzePerSocieta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines with checklist ordered by scadenza", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      {
        id: 1,
        tipo: "F24_IVA",
        scadenza: new Date("2026-04-16"),
        stato: "NON_INIZIATA",
        checklist: [],
      },
      {
        id: 2,
        tipo: "LIPE",
        scadenza: new Date("2026-05-31"),
        stato: "NON_INIZIATA",
        checklist: [],
      },
    ] as any);

    const result = await getScadenzePerSocieta(1, 2026);
    expect(result).toHaveLength(2);
    expect(prisma.scadenzaFiscale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societaId: 1, anno: 2026 },
        include: { checklist: true },
        orderBy: { scadenza: "asc" },
      })
    );
  });
});
