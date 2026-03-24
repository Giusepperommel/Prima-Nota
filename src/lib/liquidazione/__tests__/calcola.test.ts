import { describe, it, expect } from "vitest";
import { calcolaLiquidazionePura, getCodiceTributo, getDateRange } from "../calcola";
import { SOGLIA_VERSAMENTO_MINIMO } from "../types";

describe("getDateRange", () => {
  it("mensile: returns correct range for month 3", () => {
    const { dataInizio, dataFine } = getDateRange("MENSILE", 3, 2026);
    expect(dataInizio.getMonth()).toBe(2); // March = index 2
    expect(dataInizio.getDate()).toBe(1);
    expect(dataFine.getMonth()).toBe(2);
    expect(dataFine.getDate()).toBe(31);
  });

  it("trimestrale: Q1 covers Jan-Mar", () => {
    const { dataInizio, dataFine } = getDateRange("TRIMESTRALE", 1, 2026);
    expect(dataInizio.getMonth()).toBe(0); // January
    expect(dataFine.getMonth()).toBe(2);   // March
    expect(dataFine.getDate()).toBe(31);
  });

  it("trimestrale: Q4 covers Oct-Dec", () => {
    const { dataInizio, dataFine } = getDateRange("TRIMESTRALE", 4, 2026);
    expect(dataInizio.getMonth()).toBe(9);  // October
    expect(dataFine.getMonth()).toBe(11);   // December
    expect(dataFine.getDate()).toBe(31);
  });
});

describe("getCodiceTributo", () => {
  it("mensile: month 1 -> 6001", () => {
    expect(getCodiceTributo("MENSILE", 1)).toBe("6001");
  });

  it("mensile: month 12 -> 6012", () => {
    expect(getCodiceTributo("MENSILE", 12)).toBe("6012");
  });

  it("trimestrale: Q1 -> 6031", () => {
    expect(getCodiceTributo("TRIMESTRALE", 1)).toBe("6031");
  });

  it("trimestrale: Q4 -> 6099", () => {
    expect(getCodiceTributo("TRIMESTRALE", 4)).toBe("6099");
  });
});

describe("calcolaLiquidazionePura", () => {
  it("mensile con debito > 25.82: calculates correctly", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 3,
      ivaEsigibile: 5000,
      ivaDetraibile: 2000,
      totaleOperazioniAttive: 25000,
      totaleOperazioniPassive: 10000,
    });

    expect(result.saldo).toBe(3000); // 5000 - 2000
    expect(result.importoFinale).toBe(3000);
    expect(result.interessiDovuti).toBe(0); // no surcharge for mensile
    expect(result.codiceTributo).toBe("6003");
  });

  it("mensile con credito: importo finale negativo", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 5,
      ivaEsigibile: 1000,
      ivaDetraibile: 3000,
      totaleOperazioniAttive: 5000,
      totaleOperazioniPassive: 15000,
    });

    expect(result.saldo).toBe(-2000); // 1000 - 3000
    expect(result.importoFinale).toBe(-2000); // credit
    expect(result.codiceTributo).toBe("6005");
  });

  it("trimestrale con maggiorazione 1%: applies surcharge", () => {
    const result = calcolaLiquidazionePura({
      tipo: "TRIMESTRALE",
      periodo: 2,
      ivaEsigibile: 10000,
      ivaDetraibile: 4000,
      totaleOperazioniAttive: 50000,
      totaleOperazioniPassive: 20000,
    });

    expect(result.saldo).toBe(6000);
    expect(result.interessiDovuti).toBe(60); // 6000 * 0.01
    expect(result.importoFinale).toBe(6060); // 6000 + 60
    expect(result.codiceTributo).toBe("6032");
  });

  it("trimestrale Q4: no surcharge", () => {
    const result = calcolaLiquidazionePura({
      tipo: "TRIMESTRALE",
      periodo: 4,
      ivaEsigibile: 8000,
      ivaDetraibile: 3000,
      totaleOperazioniAttive: 40000,
      totaleOperazioniPassive: 15000,
    });

    expect(result.saldo).toBe(5000);
    expect(result.interessiDovuti).toBe(0); // Q4 has no surcharge
    expect(result.importoFinale).toBe(5000);
    expect(result.codiceTributo).toBe("6099");
  });

  it("debito < 25.82: still calculated (carry-forward is external logic)", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 7,
      ivaEsigibile: 20,
      ivaDetraibile: 0,
      totaleOperazioniAttive: 100,
      totaleOperazioniPassive: 0,
    });

    expect(result.saldo).toBe(20);
    expect(result.importoFinale).toBe(20);
    expect(result.importoFinale).toBeLessThan(SOGLIA_VERSAMENTO_MINIMO);
  });

  it("riporto credito tra periodi", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 4,
      ivaEsigibile: 3000,
      ivaDetraibile: 1000,
      totaleOperazioniAttive: 15000,
      totaleOperazioniPassive: 5000,
      creditoPeriodoPrecedente: 500,
    });

    expect(result.saldo).toBe(2000);
    // VP14 = 2000 + 0 - 500 - 0 + 0 - 0 = 1500
    expect(result.importoFinale).toBe(1500);
  });

  it("debito precedente riportato", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 8,
      ivaEsigibile: 2000,
      ivaDetraibile: 1000,
      totaleOperazioniAttive: 10000,
      totaleOperazioniPassive: 5000,
      debitoPeriodoPrecedente: 15, // < 25.82
    });

    expect(result.saldo).toBe(1000);
    // VP14 = 1000 + 15 = 1015
    expect(result.importoFinale).toBe(1015);
  });

  it("credito anno precedente: reduces debt in first period", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 1,
      ivaEsigibile: 5000,
      ivaDetraibile: 2000,
      totaleOperazioniAttive: 25000,
      totaleOperazioniPassive: 10000,
      creditoAnnoPrecedente: 1000,
    });

    expect(result.saldo).toBe(3000);
    expect(result.importoFinale).toBe(2000); // 3000 - 1000
  });

  it("acconto versato reduces final amount", () => {
    const result = calcolaLiquidazionePura({
      tipo: "MENSILE",
      periodo: 12,
      ivaEsigibile: 10000,
      ivaDetraibile: 3000,
      totaleOperazioniAttive: 50000,
      totaleOperazioniPassive: 15000,
      accontoVersato: 4000,
    });

    expect(result.saldo).toBe(7000);
    expect(result.importoFinale).toBe(3000); // 7000 - 4000
  });

  it("trimestrale Q2 con credito: no surcharge on credit", () => {
    const result = calcolaLiquidazionePura({
      tipo: "TRIMESTRALE",
      periodo: 2,
      ivaEsigibile: 1000,
      ivaDetraibile: 5000,
      totaleOperazioniAttive: 5000,
      totaleOperazioniPassive: 25000,
    });

    expect(result.saldo).toBe(-4000);
    expect(result.interessiDovuti).toBe(0); // no surcharge when credit
    expect(result.importoFinale).toBe(-4000);
  });
});
