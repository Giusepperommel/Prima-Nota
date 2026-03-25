import { describe, it, expect } from "vitest";
import { parseFatturaXml } from "../providers/adapters/fatture-file";

const SAMPLE_FATTURA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>01234567890</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Rossi SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Data>2026-03-15</Data>
        <Numero>FT-001/2026</Numero>
        <ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Consulenza informatica</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>1000.00</PrezzoUnitario>
        <PrezzoTotale>1000.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1000.00</ImponibileImporto>
        <Imposta>220.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <DettaglioPagamento>
        <DataScadenzaPagamento>2026-04-15</DataScadenzaPagamento>
        <ImportoPagamento>1220.00</ImportoPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

describe("parseFatturaXml", () => {
  it("extracts cedente data from XML", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.cedente.denominazione).toBe("Rossi SRL");
    expect(result.cedente.partitaIva).toBe("01234567890");
    expect(result.cedente.nazione).toBe("IT");
  });

  it("extracts document data", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.tipoDocumento).toBe("TD01");
    expect(result.numeroFattura).toBe("FT-001/2026");
    expect(result.importoTotale).toBe(1220);
    expect(result.imponibile).toBe(1000);
    expect(result.iva).toBe(220);
    expect(result.aliquotaIva).toBe(22);
  });

  it("extracts line items", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.righe).toHaveLength(1);
    expect(result.righe[0].descrizione).toBe("Consulenza informatica");
    expect(result.righe[0].importo).toBe(1000);
    expect(result.righe[0].aliquotaIva).toBe(22);
  });

  it("extracts payment terms", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.scadenzePagamento).toHaveLength(1);
    expect(result.scadenzePagamento[0].importo).toBe(1220);
  });

  it("returns date as Date object", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.dataFattura).toBeInstanceOf(Date);
    expect(result.dataFattura.getFullYear()).toBe(2026);
    expect(result.dataFattura.getMonth()).toBe(2);
    expect(result.dataFattura.getDate()).toBe(15);
  });
});
