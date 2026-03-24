import { describe, it, expect } from "vitest";
import { generateLipeXml, generateLipeFileName, getScadenzaInvioLipe } from "../generator";
import type { LipeFornitura } from "../types";

function makeFornitura(overrides?: Partial<LipeFornitura>): LipeFornitura {
  return {
    intestazione: {
      codiceFornitura: "IVP18",
    },
    comunicazione: {
      frontespizio: {
        codiceFiscale: "ABCDEF12G34H567I",
        anno: 2026,
        trimestre: 1,
        partitaIva: "01234567890",
        cognomeODenominazione: "Test S.r.l.",
        firmaDelDichiarante: true,
      },
      datiContabili: [
        {
          mese: 1,
          totaleOperazioniAttive: 10000,
          totaleOperazioniPassive: 5000,
          ivaEsigibile: 2200,
          ivaDetratta: 1100,
          ivaDovuta: 1100,
          debitoPrec: 0,
          creditoPrec: 0,
          creditoAnnoPrec: 0,
          versamentiAutoUE: 0,
          creditiImposta: 0,
          interessiDovuti: 0,
          acconto: 0,
          importoDaVersare: 1100,
        },
      ],
    },
    ...overrides,
  };
}

describe("generateLipeXml", () => {
  it("generates well-formed XML with correct root element", () => {
    const xml = generateLipeXml(makeFornitura());

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("iv:Fornitura");
    expect(xml).toContain("urn:www.agenziaentrate.gov.it");
  });

  it("contains Intestazione with IVP18 code", () => {
    const xml = generateLipeXml(makeFornitura());

    expect(xml).toContain("<iv:CodiceFornitura>IVP18</iv:CodiceFornitura>");
  });

  it("contains Frontespizio with societa data", () => {
    const xml = generateLipeXml(makeFornitura());

    expect(xml).toContain("<iv:CodiceFiscale>ABCDEF12G34H567I</iv:CodiceFiscale>");
    expect(xml).toContain("<iv:AnnoImposta>2026</iv:AnnoImposta>");
    expect(xml).toContain("<iv:PartitaIVA>01234567890</iv:PartitaIVA>");
    expect(xml).toContain("<iv:CognomeODenominazione>Test S.r.l.</iv:CognomeODenominazione>");
    expect(xml).toContain("<iv:FirmaDichiarazione>1</iv:FirmaDichiarazione>");
  });

  it("contains Modulo with VP elements", () => {
    const xml = generateLipeXml(makeFornitura());

    expect(xml).toContain("<iv:Mese>1</iv:Mese>");
    expect(xml).toContain("<iv:TotaleOperazioniAttive>10000.00</iv:TotaleOperazioniAttive>");
    expect(xml).toContain("<iv:IvaEsigibile>2200.00</iv:IvaEsigibile>");
    expect(xml).toContain("<iv:IvaDovuta>1100.00</iv:IvaDovuta>");
    expect(xml).toContain("<iv:ImportoDaVersare>1100.00</iv:ImportoDaVersare>");
  });

  it("uses IvaCredito instead of IvaDovuta when credit", () => {
    const fornitura = makeFornitura();
    fornitura.comunicazione.datiContabili = [
      {
        mese: 2,
        totaleOperazioniAttive: 3000,
        totaleOperazioniPassive: 8000,
        ivaEsigibile: 660,
        ivaDetratta: 1760,
        ivaCredito: 1100,
        debitoPrec: 0,
        creditoPrec: 0,
        creditoAnnoPrec: 0,
        versamentiAutoUE: 0,
        creditiImposta: 0,
        interessiDovuti: 0,
        acconto: 0,
        importoACredito: 1100,
      },
    ];

    const xml = generateLipeXml(fornitura);

    expect(xml).toContain("<iv:IvaCredito>1100.00</iv:IvaCredito>");
    expect(xml).not.toContain("<iv:IvaDovuta>");
    expect(xml).toContain("<iv:ImportoACredito>1100.00</iv:ImportoACredito>");
    expect(xml).not.toContain("<iv:ImportoDaVersare>");
  });

  it("omits zero-value VP elements", () => {
    const xml = generateLipeXml(makeFornitura());

    expect(xml).not.toContain("<iv:DebitoPrecedente>");
    expect(xml).not.toContain("<iv:CreditoPeriodoPrecedente>");
    expect(xml).not.toContain("<iv:CreditoAnnoPrecedente>");
    expect(xml).not.toContain("<iv:Acconto>");
  });

  it("formats decimals with 2 places and dot separator", () => {
    const fornitura = makeFornitura();
    fornitura.comunicazione.datiContabili[0].ivaEsigibile = 1234.5;
    const xml = generateLipeXml(fornitura);

    expect(xml).toContain("<iv:IvaEsigibile>1234.50</iv:IvaEsigibile>");
  });

  it("handles trimestrale modulo", () => {
    const fornitura = makeFornitura();
    fornitura.comunicazione.datiContabili = [
      {
        trimestre: 2,
        totaleOperazioniAttive: 20000,
        totaleOperazioniPassive: 10000,
        ivaEsigibile: 4400,
        ivaDetratta: 2200,
        ivaDovuta: 2200,
        debitoPrec: 0,
        creditoPrec: 0,
        creditoAnnoPrec: 0,
        versamentiAutoUE: 0,
        creditiImposta: 0,
        interessiDovuti: 22,
        acconto: 0,
        importoDaVersare: 2222,
      },
    ];

    const xml = generateLipeXml(fornitura);

    expect(xml).toContain("<iv:Trimestre>2</iv:Trimestre>");
    expect(xml).not.toContain("<iv:Mese>");
    expect(xml).toContain("<iv:InteressiDovuti>22.00</iv:InteressiDovuti>");
  });
});

describe("generateLipeFileName", () => {
  it("generates correct file name format", () => {
    expect(generateLipeFileName("01234567890", 1)).toBe(
      "IT01234567890_LI_00001.xml"
    );
  });

  it("pads progressivo to 5 digits", () => {
    expect(generateLipeFileName("01234567890", 42)).toBe(
      "IT01234567890_LI_00042.xml"
    );
  });
});

describe("getScadenzaInvioLipe", () => {
  it("Q1 -> May 31", () => {
    const d = getScadenzaInvioLipe(2026, 1);
    expect(d.getMonth()).toBe(4); // May
    expect(d.getDate()).toBe(31);
  });

  it("Q2 -> Sep 30", () => {
    const d = getScadenzaInvioLipe(2026, 2);
    expect(d.getMonth()).toBe(8); // Sep
    expect(d.getDate()).toBe(30);
  });

  it("Q3 -> Nov 30", () => {
    const d = getScadenzaInvioLipe(2026, 3);
    expect(d.getMonth()).toBe(10); // Nov
    expect(d.getDate()).toBe(30);
  });

  it("Q4 -> Feb 28/29 of next year", () => {
    const d = getScadenzaInvioLipe(2026, 4);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(1); // Feb
    expect(d.getDate()).toBe(28);
  });

  it("Q4 handles leap year", () => {
    const d = getScadenzaInvioLipe(2027, 4); // 2028 is leap year
    expect(d.getFullYear()).toBe(2028);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });
});
