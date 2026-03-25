import { describe, it, expect, vi, beforeEach } from "vitest";
import { verificaChecklist, aggiornaProgressoScadenza } from "../adempimenti/verifier";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: { count: vi.fn() },
    liquidazioneIva: { findFirst: vi.fn() },
    f24Versamento: { findFirst: vi.fn() },
    ritenuta: { count: vi.fn() },
    certificazioneUnica: { findFirst: vi.fn() },
    lipeInvio: { findFirst: vi.fn() },
    bilancioGenerato: { findFirst: vi.fn() },
    checklistAdempimento: { update: vi.fn() },
    scadenzaFiscale: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

describe("verificaChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks checklist item as complete when fattureMeseRegistrate returns > 0", async () => {
    vi.mocked(prisma.operazione.count).mockResolvedValue(10);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "fattureMeseRegistrate",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Fatture del mese registrate",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
    expect(result.dettaglio).toContain("10");
  });

  it("returns false when fattureMeseRegistrate returns 0", async () => {
    vi.mocked(prisma.operazione.count).mockResolvedValue(0);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "fattureMeseRegistrate",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Fatture del mese registrate",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(false);
  });

  it("returns true when registriIvaQuadrano finds IVA operations", async () => {
    vi.mocked(prisma.operazione.count).mockResolvedValue(5);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "registriIvaQuadrano",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Registri IVA quadrano",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns true when liquidazioneCalcolata finds a record", async () => {
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "liquidazioneCalcolata",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Liquidazione IVA calcolata",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns false when liquidazioneCalcolata finds nothing", async () => {
    vi.mocked(prisma.liquidazioneIva.findFirst).mockResolvedValue(null);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "liquidazioneCalcolata",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Liquidazione IVA calcolata",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(false);
  });

  it("returns true when f24Generato finds an F24", async () => {
    vi.mocked(prisma.f24Versamento.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "f24Generato",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "F24 generato",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns true when f24Pagato finds a PAGATO F24", async () => {
    vi.mocked(prisma.f24Versamento.findFirst).mockResolvedValue({ id: 1, stato: "PAGATO" } as any);

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "f24Pagato",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "F24 pagato/inviato",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns true when ritenuteVersate finds no unversed ritenute", async () => {
    vi.mocked(prisma.ritenuta.count).mockResolvedValue(0); // none unversed

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "ritenuteVersate",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Ritenute versate",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns false when ritenuteVersate finds unversed ritenute", async () => {
    vi.mocked(prisma.ritenuta.count).mockResolvedValue(3); // 3 unversed

    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "ritenuteVersate",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Ritenute versate",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(false);
  });

  it("returns current state for non-automatic checklist items", async () => {
    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: null,
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Manual step",
      verificaAutomatica: false,
      completata: true,
      completataAt: new Date(),
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns false for unknown query name", async () => {
    const result = await verificaChecklist(1, {
      id: 1,
      queryVerifica: "unknownQuery",
      scadenzaFiscaleId: 1,
      ordine: 1,
      descrizione: "Unknown",
      verificaAutomatica: true,
      completata: false,
      completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(false);
    expect(result.dettaglio).toContain("sconosciuta");
  });
});

describe("aggiornaProgressoScadenza", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates percentage from completed checklist items — 40%", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue({
      id: 1,
      checklist: [
        { completata: true },
        { completata: true },
        { completata: false },
        { completata: false },
        { completata: false },
      ],
    } as any);

    await aggiornaProgressoScadenza(1);
    expect(prisma.scadenzaFiscale.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        percentualeCompletamento: 40,
        stato: "IN_PREPARAZIONE",
      }),
    });
  });

  it("sets stato to NON_INIZIATA when 0% complete", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue({
      id: 1,
      checklist: [
        { completata: false },
        { completata: false },
      ],
    } as any);

    await aggiornaProgressoScadenza(1);
    expect(prisma.scadenzaFiscale.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        percentualeCompletamento: 0,
        stato: "NON_INIZIATA",
      }),
    });
  });

  it("sets stato to PRONTA when 100% complete", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue({
      id: 1,
      checklist: [
        { completata: true },
        { completata: true },
        { completata: true },
      ],
    } as any);

    await aggiornaProgressoScadenza(1);
    expect(prisma.scadenzaFiscale.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        percentualeCompletamento: 100,
        stato: "PRONTA",
      }),
    });
  });

  it("does nothing if scadenza not found", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue(null);

    await aggiornaProgressoScadenza(999);
    expect(prisma.scadenzaFiscale.update).not.toHaveBeenCalled();
  });

  it("does nothing if checklist is empty", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue({
      id: 1,
      checklist: [],
    } as any);

    await aggiornaProgressoScadenza(1);
    expect(prisma.scadenzaFiscale.update).not.toHaveBeenCalled();
  });
});
