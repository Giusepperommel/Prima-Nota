import { describe, it, expect } from "vitest";
import { buildLipeDataPura } from "../builder";

const SOCIETA_BASE = {
  codiceFiscale: "01234567890",
  partitaIva: "01234567890",
  ragioneSociale: "Test S.r.l.",
};

describe("buildLipeDataPura", () => {
  it("mensile: builds 3 moduli per trimestre", () => {
    const result = buildLipeDataPura({
      ...SOCIETA_BASE,
      anno: 2026,
      trimestre: 1,
      liquidazioni: [
        {
          tipo: "MENSILE",
          periodo: 1,
          ivaEsigibile: 2200,
          ivaDetraibile: 1000,
          saldo: 1200,
          totaleOperazioniAttive: 10000,
          totaleOperazioniPassive: 5000,
          debitoPeriodoPrecedente: 0,
          creditoPeriodoPrecedente: 0,
          creditoAnnoPrecedente: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 0,
          accontoVersato: 0,
        },
        {
          tipo: "MENSILE",
          periodo: 2,
          ivaEsigibile: 3300,
          ivaDetraibile: 1500,
          saldo: 1800,
          totaleOperazioniAttive: 15000,
          totaleOperazioniPassive: 7000,
          debitoPeriodoPrecedente: 0,
          creditoPeriodoPrecedente: 0,
          creditoAnnoPrecedente: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 0,
          accontoVersato: 0,
        },
        {
          tipo: "MENSILE",
          periodo: 3,
          ivaEsigibile: 1100,
          ivaDetraibile: 2000,
          saldo: -900,
          totaleOperazioniAttive: 5000,
          totaleOperazioniPassive: 10000,
          debitoPeriodoPrecedente: 0,
          creditoPeriodoPrecedente: 0,
          creditoAnnoPrecedente: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 0,
          accontoVersato: 0,
        },
      ],
    });

    expect(result.intestazione.codiceFornitura).toBe("IVP18");
    expect(result.comunicazione.datiContabili).toHaveLength(3);
    expect(result.comunicazione.frontespizio.anno).toBe(2026);
    expect(result.comunicazione.frontespizio.trimestre).toBe(1);

    // Check first modulo
    const m1 = result.comunicazione.datiContabili[0];
    expect(m1.mese).toBe(1);
    expect(m1.trimestre).toBeUndefined();
    expect(m1.ivaEsigibile).toBe(2200);
    expect(m1.ivaDovuta).toBe(1200);
    expect(m1.ivaCredito).toBeUndefined();
    expect(m1.importoDaVersare).toBe(1200);

    // Check third modulo (credit)
    const m3 = result.comunicazione.datiContabili[2];
    expect(m3.mese).toBe(3);
    expect(m3.ivaDovuta).toBeUndefined();
    expect(m3.ivaCredito).toBe(900);
    expect(m3.importoDaVersare).toBeUndefined();
    expect(m3.importoACredito).toBe(900);
  });

  it("trimestrale: builds 1 modulo per trimestre", () => {
    const result = buildLipeDataPura({
      ...SOCIETA_BASE,
      anno: 2026,
      trimestre: 2,
      liquidazioni: [
        {
          tipo: "TRIMESTRALE",
          periodo: 2,
          ivaEsigibile: 8000,
          ivaDetraibile: 3000,
          saldo: 5000,
          totaleOperazioniAttive: 40000,
          totaleOperazioniPassive: 15000,
          debitoPeriodoPrecedente: 0,
          creditoPeriodoPrecedente: 0,
          creditoAnnoPrecedente: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 50,
          accontoVersato: 0,
        },
      ],
    });

    expect(result.comunicazione.datiContabili).toHaveLength(1);
    const mod = result.comunicazione.datiContabili[0];
    expect(mod.mese).toBeUndefined();
    expect(mod.trimestre).toBe(2);
    expect(mod.ivaDovuta).toBe(5000);
    expect(mod.interessiDovuti).toBe(50);
    expect(mod.importoDaVersare).toBe(5050); // 5000 + 50
  });

  it("frontespizio contains correct societa data", () => {
    const result = buildLipeDataPura({
      ...SOCIETA_BASE,
      anno: 2026,
      trimestre: 3,
      liquidazioni: [],
    });

    expect(result.comunicazione.frontespizio.codiceFiscale).toBe("01234567890");
    expect(result.comunicazione.frontespizio.partitaIva).toBe("01234567890");
    expect(result.comunicazione.frontespizio.cognomeODenominazione).toBe("Test S.r.l.");
    expect(result.comunicazione.frontespizio.firmaDelDichiarante).toBe(true);
  });

  it("VP6 and VP14 are mutually exclusive (credit vs debit)", () => {
    const result = buildLipeDataPura({
      ...SOCIETA_BASE,
      anno: 2026,
      trimestre: 1,
      liquidazioni: [
        {
          tipo: "MENSILE",
          periodo: 1,
          ivaEsigibile: 500,
          ivaDetraibile: 2000,
          saldo: -1500,
          totaleOperazioniAttive: 2500,
          totaleOperazioniPassive: 10000,
          debitoPeriodoPrecedente: 0,
          creditoPeriodoPrecedente: 0,
          creditoAnnoPrecedente: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 0,
          accontoVersato: 0,
        },
      ],
    });

    const mod = result.comunicazione.datiContabili[0];
    // VP6: credit
    expect(mod.ivaDovuta).toBeUndefined();
    expect(mod.ivaCredito).toBe(1500);
    // VP14: credit
    expect(mod.importoDaVersare).toBeUndefined();
    expect(mod.importoACredito).toBe(1500);
  });
});
