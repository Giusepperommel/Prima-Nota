import { describe, it, expect } from "vitest";
import { generaF24, raggruppaRitenute } from "../f24/calcola-f24";
import { scadenzaF24Mensile, getScadenziarioAnnuale, CODICI_TRIBUTO, LIMITE_COMPENSAZIONE_ANNUO, SOGLIA_VISTO_IVA } from "../f24/f24-types";
import { applicaCompensazione, validaCompensazione, capacitaCompensazioneResidua } from "../f24/compensazione";
import type { GeneraF24Input, RigaF24, CreditoDisponibile } from "../f24/f24-types";

describe("scadenzaF24Mensile", () => {
  it("returns 16th of following month", () => {
    expect(scadenzaF24Mensile(2026, 3)).toEqual(new Date(2026, 3, 16)); // March -> April 16
  });

  it("December -> January 16 next year", () => {
    expect(scadenzaF24Mensile(2026, 12)).toEqual(new Date(2027, 0, 16));
  });

  it("January -> February 16", () => {
    expect(scadenzaF24Mensile(2026, 1)).toEqual(new Date(2026, 1, 16));
  });
});

describe("getScadenziarioAnnuale", () => {
  it("returns sorted list of deadlines", () => {
    const scadenze = getScadenziarioAnnuale(2026);
    expect(scadenze.length).toBeGreaterThan(10);
    // Verify sorted by date
    for (let i = 1; i < scadenze.length; i++) {
      expect(scadenze[i].data.getTime()).toBeGreaterThanOrEqual(scadenze[i - 1].data.getTime());
    }
  });

  it("includes CU deadline on March 16", () => {
    const scadenze = getScadenziarioAnnuale(2026);
    const cu = scadenze.find((s) => s.tipo === "CU");
    expect(cu).toBeDefined();
    expect(cu!.data.getMonth()).toBe(2); // March
    expect(cu!.data.getDate()).toBe(16);
  });

  it("includes 770 deadline on October 31", () => {
    const scadenze = getScadenziarioAnnuale(2026);
    const m770 = scadenze.find((s) => s.descrizione.includes("770"));
    expect(m770).toBeDefined();
    expect(m770!.data.getMonth()).toBe(9); // October
    expect(m770!.data.getDate()).toBe(31);
  });
});

describe("generaF24", () => {
  it("generates F24 with ritenute only", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 3,
      ritenute: [
        { codiceTributo: "1040", importoRitenuta: 200, meseCompetenza: 3, annoCompetenza: 2026 },
        { codiceTributo: "1040", importoRitenuta: 150, meseCompetenza: 3, annoCompetenza: 2026 },
        { codiceTributo: "1038", importoRitenuta: 115, meseCompetenza: 3, annoCompetenza: 2026 },
      ],
      imposte: [],
      bolli: [],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);

    expect(f24.anno).toBe(2026);
    expect(f24.mese).toBe(3);
    expect(f24.righe.length).toBe(2); // 1040 grouped, 1038 separate
    expect(f24.totaleDebito).toBe(465); // 200+150+115
    expect(f24.totaleCredito).toBe(0);
    expect(f24.totaleVersamento).toBe(465);

    // Check grouping: 1040 = 350, 1038 = 115
    const riga1040 = f24.righe.find((r) => r.codiceTributo === "1040");
    expect(riga1040!.importoDebito).toBe(350);

    const riga1038 = f24.righe.find((r) => r.codiceTributo === "1038");
    expect(riga1038!.importoDebito).toBe(115);
  });

  it("generates F24 with IVA mensile", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 3,
      ritenute: [],
      iva: { importo: 5000, periodo: 3, anno: 2026, tipo: "MENSILE" },
      imposte: [],
      bolli: [],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe.length).toBe(1);
    expect(f24.righe[0].codiceTributo).toBe("6003");
    expect(f24.totaleDebito).toBe(5000);
  });

  it("generates F24 with IRES saldo", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 6,
      ritenute: [],
      imposte: [{ tipo: "IRES_SALDO", importo: 24000, anno: 2025 }],
      bolli: [],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe.length).toBe(1);
    expect(f24.righe[0].codiceTributo).toBe("2003");
    expect(f24.righe[0].sezione).toBe("ERARIO");
    expect(f24.righe[0].importoDebito).toBe(24000);
  });

  it("generates F24 with IRAP in REGIONI_ENTI_LOCALI section", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 6,
      ritenute: [],
      imposte: [{ tipo: "IRAP_SALDO", importo: 3900, anno: 2025 }],
      bolli: [],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe[0].sezione).toBe("REGIONI_ENTI_LOCALI");
    expect(f24.righe[0].codiceTributo).toBe("3800");
  });

  it("generates F24 with bollo", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 3,
      ritenute: [],
      imposte: [],
      bolli: [{ tipo: "TASSA_CCGG", importo: 309.87, anno: 2026 }],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe[0].codiceTributo).toBe("7085");
    expect(f24.totaleDebito).toBe(309.87);
  });

  it("applies credit compensation", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 3,
      ritenute: [
        { codiceTributo: "1040", importoRitenuta: 1000, meseCompetenza: 3, annoCompetenza: 2026 },
      ],
      imposte: [],
      bolli: [],
      creditiCompensazione: [
        { tipo: "IVA", importo: 300, annoOrigine: 2025, richiedeVisto: false },
      ],
    };

    const f24 = generaF24(input);
    expect(f24.totaleDebito).toBe(1000);
    expect(f24.totaleCredito).toBe(300);
    expect(f24.totaleVersamento).toBe(700);
  });

  it("skips zero-amount imposte and bolli", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 3,
      ritenute: [],
      imposte: [{ tipo: "IRES_SALDO", importo: 0, anno: 2025 }],
      bolli: [{ tipo: "TASSA_CCGG", importo: 0, anno: 2026 }],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe.length).toBe(0);
    expect(f24.totaleVersamento).toBe(0);
  });

  it("handles mixed ritenute, IVA, imposte, and bolli", () => {
    const input: GeneraF24Input = {
      anno: 2026,
      mese: 6,
      ritenute: [
        { codiceTributo: "1040", importoRitenuta: 500, meseCompetenza: 6, annoCompetenza: 2026 },
      ],
      iva: { importo: 3000, periodo: 6, anno: 2026, tipo: "MENSILE" },
      imposte: [
        { tipo: "IRES_SALDO", importo: 24000, anno: 2025 },
        { tipo: "IRAP_SALDO", importo: 3900, anno: 2025 },
      ],
      bolli: [{ tipo: "BOLLO_FE_Q1", importo: 48, anno: 2026 }],
      creditiCompensazione: [],
    };

    const f24 = generaF24(input);
    expect(f24.righe.length).toBe(5); // 1040, IVA, IRES, IRAP, bollo
    expect(f24.totaleDebito).toBe(500 + 3000 + 24000 + 3900 + 48);
  });
});

describe("raggruppaRitenute", () => {
  it("groups ritenute by codice tributo for a given month", () => {
    const ritenute = [
      { codiceTributo: "1040", importoRitenuta: 200, meseCompetenza: 3, annoCompetenza: 2026 },
      { codiceTributo: "1040", importoRitenuta: 300, meseCompetenza: 3, annoCompetenza: 2026 },
      { codiceTributo: "1038", importoRitenuta: 115, meseCompetenza: 3, annoCompetenza: 2026 },
      { codiceTributo: "1040", importoRitenuta: 100, meseCompetenza: 4, annoCompetenza: 2026 }, // different month
    ];

    const result = raggruppaRitenute(ritenute, 3, 2026);
    expect(result["1040"]).toBe(500);
    expect(result["1038"]).toBe(115);
    expect(Object.keys(result).length).toBe(2);
  });

  it("returns empty for no matching ritenute", () => {
    const result = raggruppaRitenute([], 3, 2026);
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("applicaCompensazione", () => {
  it("applies IVA credit to debit rows", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "1040", annoRiferimento: 2026,
        periodoRiferimento: "03", importoDebito: 1000, importoCredito: 0,
        descrizione: "Ritenute",
      },
    ];
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 400, annoOrigine: 2025, richiedeVisto: false },
    ];

    const result = applicaCompensazione(righe, crediti);
    expect(result.length).toBe(2); // original + credit row
    const creditRow = result.find((r) => r.importoCredito > 0);
    expect(creditRow!.importoCredito).toBe(400);
    expect(creditRow!.codiceTributo).toBe("6099"); // IVA credit code
  });

  it("caps compensation at total debit", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "1040", annoRiferimento: 2026,
        importoDebito: 500, importoCredito: 0, descrizione: "Ritenute",
      },
    ];
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 1000, annoOrigine: 2025, richiedeVisto: false },
    ];

    const result = applicaCompensazione(righe, crediti);
    const creditRow = result.find((r) => r.importoCredito > 0);
    expect(creditRow!.importoCredito).toBe(500); // capped at debit
  });

  it("skips IVA > 5000 without visto", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "1040", annoRiferimento: 2026,
        importoDebito: 10000, importoCredito: 0, descrizione: "Ritenute",
      },
    ];
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 8000, annoOrigine: 2025, richiedeVisto: false },
    ];

    const result = applicaCompensazione(righe, crediti);
    // Should not add credit row since IVA > 5000 and no visto
    expect(result.length).toBe(1);
  });

  it("allows IVA > 5000 with visto", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "1040", annoRiferimento: 2026,
        importoDebito: 10000, importoCredito: 0, descrizione: "Ritenute",
      },
    ];
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 8000, annoOrigine: 2025, richiedeVisto: true },
    ];

    const result = applicaCompensazione(righe, crediti);
    const creditRow = result.find((r) => r.importoCredito > 0);
    expect(creditRow!.importoCredito).toBe(8000);
  });

  it("handles multiple credit types", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "2003", annoRiferimento: 2026,
        importoDebito: 10000, importoCredito: 0, descrizione: "IRES saldo",
      },
    ];
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 3000, annoOrigine: 2025, richiedeVisto: false },
      { tipo: "IRES", importo: 2000, annoOrigine: 2025, richiedeVisto: false },
    ];

    const result = applicaCompensazione(righe, crediti);
    const creditRows = result.filter((r) => r.importoCredito > 0);
    expect(creditRows.length).toBe(2);

    const totalCredito = creditRows.reduce((sum, r) => sum + r.importoCredito, 0);
    expect(totalCredito).toBe(5000);
  });

  it("returns original rows when no credits", () => {
    const righe: RigaF24[] = [
      {
        sezione: "ERARIO", codiceTributo: "1040", annoRiferimento: 2026,
        importoDebito: 1000, importoCredito: 0, descrizione: "Ritenute",
      },
    ];

    const result = applicaCompensazione(righe, []);
    expect(result).toEqual(righe);
  });
});

describe("validaCompensazione", () => {
  it("returns no errors for valid compensation", () => {
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 3000, annoOrigine: 2025, richiedeVisto: false },
    ];
    const errori = validaCompensazione(crediti, 0);
    expect(errori.length).toBe(0);
  });

  it("warns when exceeding annual limit", () => {
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 100000, annoOrigine: 2025, richiedeVisto: true },
    ];
    const errori = validaCompensazione(crediti, 1_950_000);
    expect(errori.length).toBe(1);
    expect(errori[0]).toContain("limite annuo");
  });

  it("warns about IVA > 5000 without visto", () => {
    const crediti: CreditoDisponibile[] = [
      { tipo: "IVA", importo: 8000, annoOrigine: 2025, richiedeVisto: false },
    ];
    const errori = validaCompensazione(crediti, 0);
    expect(errori.length).toBe(1);
    expect(errori[0]).toContain("visto di conformita");
  });

  it("warns about non-positive credits", () => {
    const crediti: CreditoDisponibile[] = [
      { tipo: "IRES", importo: -100, annoOrigine: 2025, richiedeVisto: false },
    ];
    const errori = validaCompensazione(crediti, 0);
    expect(errori.length).toBe(1);
    expect(errori[0]).toContain("non positivo");
  });
});

describe("capacitaCompensazioneResidua", () => {
  it("returns full capacity when nothing used", () => {
    expect(capacitaCompensazioneResidua(0)).toBe(LIMITE_COMPENSAZIONE_ANNUO);
  });

  it("returns reduced capacity", () => {
    expect(capacitaCompensazioneResidua(500000)).toBe(1500000);
  });

  it("returns 0 when fully used", () => {
    expect(capacitaCompensazioneResidua(LIMITE_COMPENSAZIONE_ANNUO)).toBe(0);
  });

  it("returns 0 when over limit", () => {
    expect(capacitaCompensazioneResidua(3000000)).toBe(0);
  });
});

describe("CODICI_TRIBUTO", () => {
  it("has correct IVA monthly codes", () => {
    expect(CODICI_TRIBUTO.IVA_MENSILE_MAP[1]).toBe("6001");
    expect(CODICI_TRIBUTO.IVA_MENSILE_MAP[12]).toBe("6012");
  });

  it("has correct IVA trimestrale codes", () => {
    expect(CODICI_TRIBUTO.IVA_TRIMESTRALE_MAP[1]).toBe("6031");
    expect(CODICI_TRIBUTO.IVA_TRIMESTRALE_MAP[3]).toBe("6033");
  });

  it("has correct ritenute codes", () => {
    expect(CODICI_TRIBUTO.RITENUTA_LAVORO_AUTONOMO).toBe("1040");
    expect(CODICI_TRIBUTO.RITENUTA_PROVVIGIONI).toBe("1038");
    expect(CODICI_TRIBUTO.RITENUTA_DIRITTI_AUTORE).toBe("1041");
  });
});
