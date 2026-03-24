import { describe, it, expect } from "vitest";
import { generaBilancio } from "../engine";
import type { SaldoConto } from "../types";

describe("generaBilancio", () => {
  it("generates complete bilancio from empty saldi", () => {
    const result = generaBilancio(2025, []);
    expect(result.anno).toBe(2025);
    expect(result.tipo).toBe("ORDINARIO");
    expect(result.totaleAttivo).toBe(0);
    expect(result.totalePassivo).toBe(0);
    expect(result.utileEsercizio).toBe(0);
    expect(result.statoPatrimoniale.attivo.classi).toHaveLength(4);
    expect(result.statoPatrimoniale.passivo.classi).toHaveLength(5);
    expect(result.contoEconomico.sezioni).toHaveLength(4);
  });

  it("generates bilancio with mixed conti", () => {
    const saldi: SaldoConto[] = [
      // Attivo
      {
        contoId: 1, codice: "100.010", descrizione: "Banca c/c",
        tipo: "PATRIMONIALE_ATTIVO", naturaSaldo: "DARE",
        voceSp: "C.IV.1", voceCe: null,
        totaleDare: 50000, totaleAvere: 10000, saldo: 40000,
      },
      {
        contoId: 2, codice: "110.001", descrizione: "Clienti",
        tipo: "PATRIMONIALE_ATTIVO", naturaSaldo: "DARE",
        voceSp: "C.II.1", voceCe: null,
        totaleDare: 24400, totaleAvere: 0, saldo: 24400,
      },
      // Passivo
      {
        contoId: 3, codice: "200.001", descrizione: "Fornitori",
        tipo: "PATRIMONIALE_PASSIVO", naturaSaldo: "AVERE",
        voceSp: "D.7", voceCe: null,
        totaleDare: 5000, totaleAvere: 25000, saldo: -20000,
      },
      {
        contoId: 4, codice: "270.001", descrizione: "Capitale sociale",
        tipo: "PATRIMONIALE_PASSIVO", naturaSaldo: "AVERE",
        voceSp: "A.I", voceCe: null,
        totaleDare: 0, totaleAvere: 10000, saldo: -10000,
      },
      // Economico
      {
        contoId: 5, codice: "400.001", descrizione: "Ricavi",
        tipo: "ECONOMICO_RICAVO", naturaSaldo: "AVERE",
        voceSp: null, voceCe: "A.1",
        totaleDare: 0, totaleAvere: 100000, saldo: -100000,
      },
      {
        contoId: 6, codice: "310.001", descrizione: "Consulenze",
        tipo: "ECONOMICO_COSTO", naturaSaldo: "DARE",
        voceSp: null, voceCe: "B.7",
        totaleDare: 30000, totaleAvere: 0, saldo: 30000,
      },
      {
        contoId: 7, codice: "390.001", descrizione: "IRES",
        tipo: "ECONOMICO_COSTO", naturaSaldo: "DARE",
        voceSp: null, voceCe: "20",
        totaleDare: 16800, totaleAvere: 0, saldo: 16800,
      },
    ];

    const result = generaBilancio(2025, saldi);

    expect(result.totaleAttivo).toBe(64400); // 40000 + 24400
    expect(result.totalePassivo).toBe(30000); // 20000 + 10000

    // CE
    expect(result.contoEconomico.differenzaAB).toBe(70000); // 100000 - 30000
    expect(result.contoEconomico.imposte).toBe(16800);
    expect(result.contoEconomico.utilePerditaEsercizio).toBe(53200); // 70000 - 16800
    expect(result.utileEsercizio).toBe(53200);
  });

  it("accepts tipo abbreviato", () => {
    const result = generaBilancio(2025, [], "ABBREVIATO");
    expect(result.tipo).toBe("ABBREVIATO");
  });

  it("separates SP and CE conti correctly — no cross-contamination", () => {
    const saldi: SaldoConto[] = [
      {
        contoId: 1, codice: "100.010", descrizione: "Banca",
        tipo: "PATRIMONIALE_ATTIVO", naturaSaldo: "DARE",
        voceSp: "C.IV.1", voceCe: null,
        totaleDare: 10000, totaleAvere: 0, saldo: 10000,
      },
      {
        contoId: 2, codice: "400.001", descrizione: "Ricavi",
        tipo: "ECONOMICO_RICAVO", naturaSaldo: "AVERE",
        voceSp: null, voceCe: "A.1",
        totaleDare: 0, totaleAvere: 5000, saldo: -5000,
      },
    ];

    const result = generaBilancio(2025, saldi);
    expect(result.totaleAttivo).toBe(10000);
    expect(result.totalePassivo).toBe(0);
    expect(result.contoEconomico.differenzaAB).toBe(5000);
  });
});
