import { describe, it, expect } from "vitest";
import { calcolaRegistro, CespiteConQuote } from "../registro-ammortizzabili";

function makeCespite(overrides: Partial<CespiteConQuote> = {}): CespiteConQuote {
  return {
    id: 1,
    descrizione: "Computer portatile",
    dataAcquisto: new Date("2024-01-15"),
    annoInizio: 2024,
    valoreIniziale: 1000,
    aliquotaAmmortamento: 20,
    stato: "IN_AMMORTAMENTO",
    quoteAmmortamento: [
      { anno: 2024, importoQuota: 100, fondoProgressivo: 100, importoQuotaFiscale: null, fondoProgressivoFiscale: null },
      { anno: 2025, importoQuota: 200, fondoProgressivo: 300, importoQuotaFiscale: null, fondoProgressivoFiscale: null },
    ],
    veicolo: null,
    ...overrides,
  };
}

describe("calcolaRegistro", () => {
  it("returns empty register when no cespiti", () => {
    const reg = calcolaRegistro([], 2025, 1);
    expect(reg.anno).toBe(2025);
    expect(reg.righe).toHaveLength(0);
    expect(reg.totali.costoStorico).toBe(0);
  });

  it("correctly computes civil depreciation for a single asset", () => {
    const cespite = makeCespite();
    const reg = calcolaRegistro([cespite], 2025, 1);

    expect(reg.righe).toHaveLength(1);
    const riga = reg.righe[0];
    expect(riga.costoStorico).toBe(1000);
    expect(riga.quotaCivilistico).toBe(200);
    expect(riga.fondoCivilistico).toBe(300);
    expect(riga.valoreResiduoCivilistico).toBe(700);
  });

  it("uses fiscal values when provided", () => {
    const cespite = makeCespite({
      quoteAmmortamento: [
        { anno: 2024, importoQuota: 100, fondoProgressivo: 100, importoQuotaFiscale: 80, fondoProgressivoFiscale: 80 },
        { anno: 2025, importoQuota: 200, fondoProgressivo: 300, importoQuotaFiscale: 160, fondoProgressivoFiscale: 240 },
      ],
    });
    const reg = calcolaRegistro([cespite], 2025, 1);

    const riga = reg.righe[0];
    expect(riga.quotaCivilistico).toBe(200);
    expect(riga.quotaFiscale).toBe(160);
    expect(riga.fondoFiscale).toBe(240);
    expect(riga.valoreResiduoFiscale).toBe(760);
  });

  it("falls back to civil values when fiscal is null", () => {
    const cespite = makeCespite();
    const reg = calcolaRegistro([cespite], 2025, 1);

    const riga = reg.righe[0];
    expect(riga.quotaFiscale).toBe(riga.quotaCivilistico);
    expect(riga.fondoFiscale).toBe(riga.fondoCivilistico);
  });

  it("shows zero quota for a year without depreciation", () => {
    const cespite = makeCespite();
    const reg = calcolaRegistro([cespite], 2026, 1);

    const riga = reg.righe[0];
    expect(riga.quotaCivilistico).toBe(0);
    // Fund should still show cumulative value from 2025
    expect(riga.fondoCivilistico).toBe(300);
  });

  it("correctly sums totals for multiple assets", () => {
    const cespiti = [
      makeCespite({ id: 1, valoreIniziale: 1000 }),
      makeCespite({
        id: 2,
        descrizione: "Scrivania",
        valoreIniziale: 500,
        quoteAmmortamento: [
          { anno: 2024, importoQuota: 50, fondoProgressivo: 50, importoQuotaFiscale: null, fondoProgressivoFiscale: null },
          { anno: 2025, importoQuota: 100, fondoProgressivo: 150, importoQuotaFiscale: null, fondoProgressivoFiscale: null },
        ],
      }),
    ];
    const reg = calcolaRegistro(cespiti, 2025, 1);

    expect(reg.righe).toHaveLength(2);
    expect(reg.totali.costoStorico).toBe(1500);
    expect(reg.totali.quotaCivilistico).toBe(300);
    expect(reg.totali.fondoCivilistico).toBe(450);
    expect(reg.totali.valoreResiduoCivilistico).toBe(1050);
  });

  it("includes veicolo info in output", () => {
    const cespite = makeCespite({
      veicolo: {
        marca: "Fiat",
        modello: "Panda",
        targa: "AB123CD",
        tipoVeicolo: "AUTOVETTURA",
        usoVeicolo: "PROMISCUO",
      },
    });
    const reg = calcolaRegistro([cespite], 2025, 1);
    expect(reg.righe[0].veicolo?.marca).toBe("Fiat");
    expect(reg.righe[0].veicolo?.targa).toBe("AB123CD");
  });

  it("formats date correctly from Date object", () => {
    const cespite = makeCespite({ dataAcquisto: new Date("2024-03-15") });
    const reg = calcolaRegistro([cespite], 2025, 1);
    expect(reg.righe[0].dataAcquisto).toBe("2024-03-15");
  });
});
