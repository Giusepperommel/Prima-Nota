import { describe, it, expect, vi, beforeEach } from "vitest";
import { importaFattureXml } from "../import/fatture-import";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: {
      findFirst: vi.fn().mockResolvedValue(null),  // no duplicates
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    anagrafica: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 10 }),
    },
    categoriaSpesa: {
      findMany: vi.fn().mockResolvedValue([{ id: 1, nome: "Generico" }]),
      findFirst: vi.fn().mockResolvedValue({ id: 1, nome: "Generico", percentualeDeducibilita: 100 }),
    },
    socio: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, quotaPercentuale: 50 },
        { id: 2, quotaPercentuale: 50 },
      ]),
    },
    ripartizioneOperazione: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      operazione: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      ripartizioneOperazione: { createMany: vi.fn() },
      anagrafica: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 10 }) },
    })),
  },
}));

vi.mock("../import/fatture-classifier", () => ({
  classificaFattura: vi.fn().mockResolvedValue({
    categoriaId: 1, codiceContoId: null, tipoOperazione: "COSTO",
    fornitoreId: null, fornitoreNuovo: true, confidence: 0.85,
    motivazione: "AI classification",
  }),
}));

vi.mock("../import/idempotency", () => ({
  buildFatturaKey: vi.fn().mockReturnValue("SDI123"),
  checkDuplicateFattura: vi.fn().mockResolvedValue(false),
}));

import { checkDuplicateFattura } from "../import/idempotency";

describe("importaFattureXml", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("imports a single fattura and creates bozza", async () => {
    const fatture = [{
      identificativoSdi: "SDI123",
      tipoDocumento: "TD01",
      cedente: { denominazione: "Rossi SRL", partitaIva: "01234567890", nazione: "IT" },
      dataFattura: new Date("2026-03-15"),
      numeroFattura: "FT-001",
      importoTotale: 1220,
      imponibile: 1000,
      iva: 220,
      aliquotaIva: 22,
      righe: [{ descrizione: "Consulenza", importo: 1000, aliquotaIva: 22 }],
      scadenzePagamento: [],
    }];

    const result = await importaFattureXml(1, 1, fatture as any);
    expect(result.importate).toBe(1);
    expect(result.duplicate).toBe(0);
    expect(result.bozzeCreate).toBe(1);
  });

  it("skips duplicate fatture", async () => {
    vi.mocked(checkDuplicateFattura).mockResolvedValue(true);

    const fatture = [{
      identificativoSdi: "SDI123",
      tipoDocumento: "TD01",
      cedente: { denominazione: "Rossi SRL", partitaIva: "01234567890", nazione: "IT" },
      dataFattura: new Date("2026-03-15"),
      numeroFattura: "FT-001",
      importoTotale: 1220,
      imponibile: 1000, iva: 220, aliquotaIva: 22,
      righe: [], scadenzePagamento: [],
    }];

    const result = await importaFattureXml(1, 1, fatture as any);
    expect(result.importate).toBe(0);
    expect(result.duplicate).toBe(1);
  });
});
