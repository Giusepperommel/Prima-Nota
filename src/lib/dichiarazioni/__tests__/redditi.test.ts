import { describe, it, expect } from "vitest";
import { calcolaRedditi, calcolaRiepilogo770 } from "../redditi/calcola-redditi";
import type { DatiBilancio, DatiSocieta, AccontiVersati } from "../redditi/calcola-redditi";

const defaultBilancio: DatiBilancio = {
  anno: 2025,
  ricavi: 500000,
  costi: 400000,
  proventiFinanziari: 1000,
  oneriFinanziari: 500,
  proventiStraordinari: 0,
  oneriStraordinari: 0,
  ammortamenti: 10000,
};

const defaultSocieta: DatiSocieta = {
  tipoAttivita: "SRL",
  regimeFiscale: "ORDINARIO",
  aliquotaIrap: 3.9,
  capitaleSociale: 10000,
};

const defaultAcconti: AccontiVersati = {
  iresAcconto1: 0,
  iresAcconto2: 0,
  irapAcconto1: 0,
  irapAcconto2: 0,
};

describe("calcolaRedditi", () => {
  it("calculates basic IRES and IRAP", () => {
    const result = calcolaRedditi(defaultBilancio, defaultSocieta, defaultAcconti);

    expect(result.anno).toBe(2025);
    expect(result.valoreProduzioneNetta).toBe(100000); // 500000 - 400000
    expect(result.risultatoFinanziario).toBe(500); // 1000 - 500
    expect(result.risultatoPrimaImposte).toBe(100500); // 100000 + 500

    // IRAP: 100000 * 3.9% = 3900
    expect(result.baseImponibileIrap).toBe(100000);
    expect(result.irapLorda).toBe(3900);
    expect(result.aliquotaIrap).toBe(3.9);

    // Deduzione IRAP: 10% * 3900 = 390
    expect(result.deduzioneIrapDaIres).toBe(390);

    // IRES: (100500 - 390) * 24% = 100110 * 24% = 24026.40
    expect(result.redditoImponibileIres).toBe(100110);
    expect(result.iresLorda).toBe(24026.4);
    expect(result.aliquotaIres).toBe(24);
  });

  it("calculates saldi considering acconti", () => {
    const acconti: AccontiVersati = {
      iresAcconto1: 8000,
      iresAcconto2: 12000,
      irapAcconto1: 1500,
      irapAcconto2: 2000,
    };

    const result = calcolaRedditi(defaultBilancio, defaultSocieta, acconti);

    expect(result.accontiIresVersati).toBe(20000);
    expect(result.accontiIrapVersati).toBe(3500);
    // IRES saldo = 24026.40 - 20000 = 4026.40
    expect(result.saldoIres).toBe(4026.4);
    // IRAP saldo = 3900 - 3500 = 400
    expect(result.saldoIrap).toBe(400);
  });

  it("calculates acconti for next year (100% storico)", () => {
    const result = calcolaRedditi(defaultBilancio, defaultSocieta, defaultAcconti);

    // Acconti prossimo anno = 100% dell'imposta corrente
    expect(result.accontoIresProssimoAnno).toBe(result.iresNetta);
    expect(result.accontoIres1).toBeCloseTo(result.iresNetta * 0.4, 2); // 40%
    expect(result.accontoIres2).toBeCloseTo(result.iresNetta * 0.6, 2); // 60%

    expect(result.accontoIrapProssimoAnno).toBe(result.irapNetta);
    expect(result.accontoIrap1).toBeCloseTo(result.irapNetta * 0.4, 2);
    expect(result.accontoIrap2).toBeCloseTo(result.irapNetta * 0.6, 2);
  });

  it("handles zero profit", () => {
    const bilancio: DatiBilancio = {
      ...defaultBilancio,
      ricavi: 100000,
      costi: 100000,
      proventiFinanziari: 0,
      oneriFinanziari: 0,
    };

    const result = calcolaRedditi(bilancio, defaultSocieta, defaultAcconti);
    expect(result.valoreProduzioneNetta).toBe(0);
    expect(result.iresLorda).toBe(0);
    expect(result.irapLorda).toBe(0);
    expect(result.totaleImposte).toBe(0);
  });

  it("handles loss (negative result)", () => {
    const bilancio: DatiBilancio = {
      ...defaultBilancio,
      ricavi: 300000,
      costi: 400000,
      proventiFinanziari: 0,
      oneriFinanziari: 0,
    };

    const result = calcolaRedditi(bilancio, defaultSocieta, defaultAcconti);
    expect(result.valoreProduzioneNetta).toBe(-100000);
    // IRES and IRAP should be 0 on negative base
    expect(result.iresLorda).toBe(0);
    expect(result.irapLorda).toBe(0);
    expect(result.redditoImponibileIres).toBe(0);
  });

  it("produces negative saldo (credit) when acconti > imposta", () => {
    const bilancio: DatiBilancio = {
      ...defaultBilancio,
      ricavi: 150000,
      costi: 100000,
    };
    const acconti: AccontiVersati = {
      iresAcconto1: 10000,
      iresAcconto2: 15000,
      irapAcconto1: 2000,
      irapAcconto2: 3000,
    };

    const result = calcolaRedditi(bilancio, defaultSocieta, acconti);
    // With smaller profit, IRES should be less than 25000 acconti
    expect(result.saldoIres).toBeLessThan(0); // credit
  });

  it("includes financial and extraordinary results", () => {
    const bilancio: DatiBilancio = {
      ...defaultBilancio,
      proventiFinanziari: 5000,
      oneriFinanziari: 2000,
      proventiStraordinari: 10000,
      oneriStraordinari: 3000,
    };

    const result = calcolaRedditi(bilancio, defaultSocieta, defaultAcconti);
    expect(result.risultatoFinanziario).toBe(3000);
    expect(result.risultatoStraordinario).toBe(7000);
    expect(result.risultatoPrimaImposte).toBe(110000); // 100000 + 3000 + 7000
  });
});

describe("calcolaRiepilogo770", () => {
  it("aggregates ritenute operate and versate", () => {
    const ritenute = [
      { codiceTributo: "1040", importoRitenuta: 200, importoVersato: 200, statoVersamento: "VERSATO" },
      { codiceTributo: "1040", importoRitenuta: 300, importoVersato: 300, statoVersamento: "VERSATO" },
      { codiceTributo: "1038", importoRitenuta: 115, importoVersato: null, statoVersamento: "DA_VERSARE" },
    ];

    const result = calcolaRiepilogo770(ritenute);
    expect(result.totaleRitenuteOperate).toBe(615);
    expect(result.totaleRitenuteVersate).toBe(500);
    expect(result.ritenuteNonVersate).toBe(115);
  });

  it("groups by codice tributo", () => {
    const ritenute = [
      { codiceTributo: "1040", importoRitenuta: 200, importoVersato: 200, statoVersamento: "VERSATO" },
      { codiceTributo: "1040", importoRitenuta: 300, importoVersato: 300, statoVersamento: "VERSATO" },
      { codiceTributo: "1038", importoRitenuta: 115, importoVersato: 115, statoVersamento: "VERSATO" },
    ];

    const result = calcolaRiepilogo770(ritenute);
    expect(result.dettaglioPerCodice.length).toBe(2);

    const cod1040 = result.dettaglioPerCodice.find((d) => d.codiceTributo === "1040");
    expect(cod1040!.totaleOperato).toBe(500);
    expect(cod1040!.totaleVersato).toBe(500);
  });

  it("handles empty input", () => {
    const result = calcolaRiepilogo770([]);
    expect(result.totaleRitenuteOperate).toBe(0);
    expect(result.totaleRitenuteVersate).toBe(0);
    expect(result.dettaglioPerCodice.length).toBe(0);
  });

  it("uses importoRitenuta as fallback when importoVersato is null for VERSATO", () => {
    const ritenute = [
      { codiceTributo: "1040", importoRitenuta: 200, importoVersato: null, statoVersamento: "VERSATO" },
    ];

    const result = calcolaRiepilogo770(ritenute);
    expect(result.totaleRitenuteVersate).toBe(200); // fallback
  });
});
