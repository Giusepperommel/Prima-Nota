import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    scritturaContabile: { findMany: vi.fn() },
    operazione: { findMany: vi.fn(), count: vi.fn() },
    liquidazioneIva: { findMany: vi.fn() },
    cespite: { findMany: vi.fn() },
    quotaAmmortamento: { findMany: vi.fn() },
    anagrafica: { findMany: vi.fn() },
    ritenuta: { findMany: vi.fn() },
    movimentoContabile: { groupBy: vi.fn() },
  },
}));

import { prisma } from "../prisma";

// Import rules after mock
import { checkDareAvere } from "../controlli/rules/dare-avere";
import { checkAnagraficheIncomplete } from "../controlli/rules/anagrafiche-incomplete";
import { checkDoppiaFattura } from "../controlli/patterns/doppia-fattura";

describe("checkDareAvere", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("finds unbalanced scritture", async () => {
    vi.mocked(prisma.scritturaContabile.findMany).mockResolvedValue([
      { id: 1, descrizione: "FT-001", movimenti: [
        { importoDare: 1000, importoAvere: 0 },
        { importoDare: 0, importoAvere: 900 },
      ] },
    ] as any);

    const result = await checkDareAvere(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie).toHaveLength(1);
    expect(result.anomalie[0].priorita).toBe("CRITICA");
  });

  it("returns no anomalies when all balanced", async () => {
    vi.mocked(prisma.scritturaContabile.findMany).mockResolvedValue([
      { id: 1, descrizione: "FT-001", movimenti: [
        { importoDare: 1000, importoAvere: 0 },
        { importoDare: 0, importoAvere: 1000 },
      ] },
    ] as any);

    const result = await checkDareAvere(1, 2026);
    expect(result.found).toBe(false);
  });
});

describe("checkAnagraficheIncomplete", () => {
  it("finds anagrafiche without partitaIva", async () => {
    vi.mocked(prisma.anagrafica.findMany).mockResolvedValue([
      { id: 1, denominazione: "Rossi SRL", partitaIva: "", codiceFiscale: "" },
    ] as any);

    const result = await checkAnagraficheIncomplete(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie[0].tipo).toBe("DOCUMENTALE");
  });
});

describe("checkDoppiaFattura", () => {
  it("detects potential duplicate invoices", async () => {
    const date = new Date("2026-03-15");
    vi.mocked(prisma.operazione.findMany).mockResolvedValue([
      { id: 1, fornitoreId: 10, importoTotale: 1220, dataOperazione: date, numeroDocumento: "FT-142", descrizione: "Fattura A" },
      { id: 2, fornitoreId: 10, importoTotale: 1220, dataOperazione: date, numeroDocumento: "FT-143", descrizione: "Fattura B" },
    ] as any);

    const result = await checkDoppiaFattura(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie[0].tipo).toBe("DUPLICATO");
  });
});
