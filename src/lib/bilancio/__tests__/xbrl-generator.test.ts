import { describe, it, expect } from "vitest";
import { generateXbrl } from "../xbrl-generator";
import { generaBilancio } from "../engine";
import type { SaldoConto } from "../types";

describe("generateXbrl", () => {
  const societa = {
    partitaIva: "01234567890",
    ragioneSociale: "Test SRL",
  };

  it("generates valid XML structure for empty bilancio", () => {
    const bilancio = generaBilancio(2025, []);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xbrl).toContain("<xbrl");
    expect(xbrl).toContain("</xbrl>");
    expect(xbrl).toContain("xmlns:itcc-ci");
    expect(xbrl).toContain("link:schemaRef");
  });

  it("includes context with entity and period", () => {
    const bilancio = generaBilancio(2025, []);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain("xbrli:context");
    expect(xbrl).toContain("01234567890");
    expect(xbrl).toContain("2025-01-01");
    expect(xbrl).toContain("2025-12-31");
  });

  it("includes unit EUR", () => {
    const bilancio = generaBilancio(2025, []);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain('id="EUR"');
    expect(xbrl).toContain("iso4217:EUR");
  });

  it("includes denominazione sociale", () => {
    const bilancio = generaBilancio(2025, []);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain("Test SRL");
    expect(xbrl).toContain("DenominazioneSociale");
  });

  it("includes SP facts when bilancio has data", () => {
    const saldi: SaldoConto[] = [
      {
        contoId: 1, codice: "100.010", descrizione: "Banca",
        tipo: "PATRIMONIALE_ATTIVO", naturaSaldo: "DARE",
        voceSp: "C.IV.1", voceCe: null,
        totaleDare: 50000, totaleAvere: 10000, saldo: 40000,
      },
      {
        contoId: 2, codice: "270.001", descrizione: "Capitale",
        tipo: "PATRIMONIALE_PASSIVO", naturaSaldo: "AVERE",
        voceSp: "A.I", voceCe: null,
        totaleDare: 0, totaleAvere: 40000, saldo: -40000,
      },
    ];

    const bilancio = generaBilancio(2025, saldi);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain("TotaleDisponibilitaLiquide");
    expect(xbrl).toContain("TotaleAttivoCircolante");
    expect(xbrl).toContain("TotaleAttivo");
    expect(xbrl).toContain("TotalePassivo");
    expect(xbrl).toContain("TotalePatrimonioNetto");
    expect(xbrl).toContain("40000.00");
  });

  it("includes CE facts when bilancio has data", () => {
    const saldi: SaldoConto[] = [
      {
        contoId: 1, codice: "400.001", descrizione: "Ricavi",
        tipo: "ECONOMICO_RICAVO", naturaSaldo: "AVERE",
        voceSp: null, voceCe: "A.1",
        totaleDare: 0, totaleAvere: 100000, saldo: -100000,
      },
      {
        contoId: 2, codice: "310.001", descrizione: "Servizi",
        tipo: "ECONOMICO_COSTO", naturaSaldo: "DARE",
        voceSp: null, voceCe: "B.7",
        totaleDare: 40000, totaleAvere: 0, saldo: 40000,
      },
    ];

    const bilancio = generaBilancio(2025, saldi);
    const xbrl = generateXbrl(bilancio, societa);

    expect(xbrl).toContain("TotaleValoreDellaProduzione");
    expect(xbrl).toContain("RicaviVenditeEPrestazioni");
    expect(xbrl).toContain("PerServizi");
    expect(xbrl).toContain("DiffTraValoreECostiProduzione");
    expect(xbrl).toContain("UtilePerdita");
  });

  it("escapes special XML characters in ragione sociale", () => {
    const societaSpecial = {
      partitaIva: "01234567890",
      ragioneSociale: "Test & Co <SRL>",
    };

    const bilancio = generaBilancio(2025, []);
    const xbrl = generateXbrl(bilancio, societaSpecial);

    expect(xbrl).toContain("Test &amp; Co &lt;SRL&gt;");
    expect(xbrl).not.toContain("Test & Co <SRL>");
  });

  it("generates consistent XBRL for different years", () => {
    const bilancio2024 = generaBilancio(2024, []);
    const bilancio2025 = generaBilancio(2025, []);

    const xbrl2024 = generateXbrl(bilancio2024, societa);
    const xbrl2025 = generateXbrl(bilancio2025, societa);

    expect(xbrl2024).toContain("2024-01-01");
    expect(xbrl2024).toContain("2024-12-31");
    expect(xbrl2025).toContain("2025-01-01");
    expect(xbrl2025).toContain("2025-12-31");
  });
});
