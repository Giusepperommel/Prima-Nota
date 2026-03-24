import { describe, it, expect } from "vitest";
import { buildStatoPatrimoniale, parseVoceSp } from "../sp-builder";
import type { SaldoConto } from "../types";

describe("parseVoceSp", () => {
  it("parses simple class: D", () => {
    expect(parseVoceSp("D")).toEqual({ classe: "D" });
  });

  it("parses class + sottoclasse: C.IV", () => {
    expect(parseVoceSp("C.IV")).toEqual({ classe: "C", sottoclasse: "IV" });
  });

  it("parses class + sottoclasse + voce: C.IV.1", () => {
    expect(parseVoceSp("C.IV.1")).toEqual({
      classe: "C",
      sottoclasse: "IV",
      voce: "1",
    });
  });

  it("parses complex voce: C.II.5-bis", () => {
    expect(parseVoceSp("C.II.5-bis")).toEqual({
      classe: "C",
      sottoclasse: "II",
      voce: "5-bis",
    });
  });

  it("parses patrimonio netto: A.IX", () => {
    expect(parseVoceSp("A.IX")).toEqual({ classe: "A", sottoclasse: "IX" });
  });

  it("parses fondi B.2", () => {
    expect(parseVoceSp("B.2")).toEqual({ classe: "B", sottoclasse: "2" });
  });
});

describe("buildStatoPatrimoniale", () => {
  it("builds empty SP when no conti provided", () => {
    const result = buildStatoPatrimoniale([]);
    expect(result.attivo.totale).toBe(0);
    expect(result.passivo.totale).toBe(0);
    expect(result.attivo.classi).toHaveLength(4); // A, B, C, D
    expect(result.passivo.classi).toHaveLength(5); // A, B, C, D, E
  });

  it("places banca c/c in attivo C.IV.1", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "100.010",
        descrizione: "Banca c/c principale",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "DARE",
        voceSp: "C.IV.1",
        voceCe: null,
        totaleDare: 50000,
        totaleAvere: 10000,
        saldo: 40000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    // C is the third class (index 2) in attivo
    const classeC = result.attivo.classi.find((c) => c.codice === "C");
    expect(classeC).toBeDefined();
    expect(classeC!.importo).toBe(40000);

    // IV sottoclasse
    const scIV = classeC!.sottoclassi.find((sc) => sc.codice === "IV");
    expect(scIV).toBeDefined();
    expect(scIV!.importo).toBe(40000);

    // Voce 1
    const voce1 = scIV!.voci.find((v) => v.codice === "1");
    expect(voce1).toBeDefined();
    expect(voce1!.importo).toBe(40000);

    expect(result.attivo.totale).toBe(40000);
  });

  it("handles fondi ammortamento (natura AVERE in attivo)", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "170.006",
        descrizione: "Mobili e arredi",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "DARE",
        voceSp: "B.II.4",
        voceCe: null,
        totaleDare: 10000,
        totaleAvere: 0,
        saldo: 10000,
      },
      {
        contoId: 2,
        codice: "170.106",
        descrizione: "F.do amm.to mobili",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "AVERE",
        voceSp: "B.II.4",
        voceCe: null,
        totaleDare: 0,
        totaleAvere: 3000,
        saldo: -3000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    const classeB = result.attivo.classi.find((c) => c.codice === "B");
    expect(classeB).toBeDefined();

    // Net value: 10000 - 3000 = 7000
    expect(classeB!.importo).toBe(7000);
    expect(result.attivo.totale).toBe(7000);
  });

  it("places debiti fornitori in passivo D.7", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "200.001",
        descrizione: "Fornitori Italia",
        tipo: "PATRIMONIALE_PASSIVO",
        naturaSaldo: "AVERE",
        voceSp: "D.7",
        voceCe: null,
        totaleDare: 5000,
        totaleAvere: 20000,
        saldo: -15000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    const classeD = result.passivo.classi.find((c) => c.codice === "D");
    expect(classeD).toBeDefined();
    expect(classeD!.importo).toBe(15000); // avere - dare for natura AVERE
    expect(result.passivo.totale).toBe(15000);
  });

  it("places patrimonio netto in passivo A", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "270.001",
        descrizione: "Capitale sociale",
        tipo: "PATRIMONIALE_PASSIVO",
        naturaSaldo: "AVERE",
        voceSp: "A.I",
        voceCe: null,
        totaleDare: 0,
        totaleAvere: 50000,
        saldo: -50000,
      },
      {
        contoId: 2,
        codice: "270.004",
        descrizione: "Riserva legale",
        tipo: "PATRIMONIALE_PASSIVO",
        naturaSaldo: "AVERE",
        voceSp: "A.IV",
        voceCe: null,
        totaleDare: 0,
        totaleAvere: 5000,
        saldo: -5000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    const classeA = result.passivo.classi.find((c) => c.codice === "A");
    expect(classeA).toBeDefined();
    expect(classeA!.importo).toBe(55000);

    const scI = classeA!.sottoclassi.find((sc) => sc.codice === "I");
    expect(scI!.importo).toBe(50000);

    const scIV = classeA!.sottoclassi.find((sc) => sc.codice === "IV");
    expect(scIV!.importo).toBe(5000);
  });

  it("places ratei/risconti attivi in D (senza sottoclasse)", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "150.001",
        descrizione: "Risconti attivi",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "DARE",
        voceSp: "D",
        voceCe: null,
        totaleDare: 2000,
        totaleAvere: 0,
        saldo: 2000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    const classeD = result.attivo.classi.find((c) => c.codice === "D");
    expect(classeD).toBeDefined();
    expect(classeD!.importo).toBe(2000);
    expect(classeD!.vociDirette).toHaveLength(1);
    expect(result.attivo.totale).toBe(2000);
  });

  it("ignores conti without voceSp", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "310.001",
        descrizione: "Consulenze",
        tipo: "ECONOMICO_COSTO",
        naturaSaldo: "DARE",
        voceSp: null,
        voceCe: "B.7",
        totaleDare: 5000,
        totaleAvere: 0,
        saldo: 5000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);
    expect(result.attivo.totale).toBe(0);
    expect(result.passivo.totale).toBe(0);
  });

  it("handles multiple conti per voce (aggregation)", () => {
    const conti: SaldoConto[] = [
      {
        contoId: 1,
        codice: "100.010",
        descrizione: "Banca c/c principale",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "DARE",
        voceSp: "C.IV.1",
        voceCe: null,
        totaleDare: 30000,
        totaleAvere: 5000,
        saldo: 25000,
      },
      {
        contoId: 2,
        codice: "100.011",
        descrizione: "Banca c/c secondario",
        tipo: "PATRIMONIALE_ATTIVO",
        naturaSaldo: "DARE",
        voceSp: "C.IV.1",
        voceCe: null,
        totaleDare: 15000,
        totaleAvere: 3000,
        saldo: 12000,
      },
    ];

    const result = buildStatoPatrimoniale(conti);

    const classeC = result.attivo.classi.find((c) => c.codice === "C");
    const scIV = classeC!.sottoclassi.find((sc) => sc.codice === "IV");
    const voce1 = scIV!.voci.find((v) => v.codice === "1");
    expect(voce1!.importo).toBe(37000); // 25000 + 12000
    expect(voce1!.conti).toHaveLength(2);
  });
});
