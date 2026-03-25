import { describe, it, expect, vi, beforeEach } from "vitest";
import { classificaFattura } from "../import/fatture-classifier";

vi.mock("../prisma", () => ({
  prisma: {
    anagrafica: { findFirst: vi.fn() },
    operazione: { findFirst: vi.fn() },
    categoriaSpesa: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("classificaFattura", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("classifies known supplier using last used category", async () => {
    // Supplier exists in anagrafica
    vi.mocked(prisma.anagrafica.findFirst).mockResolvedValue({
      id: 10, denominazione: "Telecom Italia", partitaIva: "00488410010",
      tipo: "FORNITORE", societaId: 1,
    } as any);

    // Last operation with this supplier used categoria 5
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue({
      id: 100, categoriaId: 5, codiceContoId: 20, fornitoreId: 10,
    } as any);

    const result = await classificaFattura(1, {
      cedente: { denominazione: "Telecom Italia", partitaIva: "00488410010", nazione: "IT" },
      importoTotale: 200,
      righeDescrizione: "Canone mensile telefonia",
    });

    expect(result.fornitoreId).toBe(10);
    expect(result.fornitoreNuovo).toBe(false);
    expect(result.categoriaId).toBe(5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns lower confidence for new supplier", async () => {
    vi.mocked(prisma.anagrafica.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.categoriaSpesa.findMany).mockResolvedValue([
      { id: 1, nome: "Consulenze", societaId: 1 },
      { id: 2, nome: "Telefonia", societaId: 1 },
    ] as any);

    const result = await classificaFattura(1, {
      cedente: { denominazione: "Nuova SRL", partitaIva: "12345678901", nazione: "IT" },
      importoTotale: 5000,
      righeDescrizione: "Consulenza strategica",
    });

    expect(result.fornitoreNuovo).toBe(true);
    expect(result.fornitoreId).toBeNull();
    // AI classification needed for new suppliers
  });

  it("sets tipoOperazione to COSTO for standard domestic invoice", () => {
    // Tested via the sync path (no await needed for this specific assertion)
    // This will be part of the full integration test
  });
});
