import { XMLParser } from "fast-xml-parser";
import type { ProviderConfig } from "@prisma/client";
import type {
  FattureProvider,
  FatturaImportata,
  FatturaRiga,
  ScadenzaPagamento,
} from "../types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  numberParseOptions: {
    hex: false,
    leadingZeros: false,
  },
  isArray: (name) => {
    return ["DettaglioLinee", "DatiRiepilogo", "DettaglioPagamento", "FatturaElettronicaBody"].includes(name);
  },
});

export function parseFatturaXml(xml: string): FatturaImportata {
  const parsed = xmlParser.parse(xml);
  const fe = parsed.FatturaElettronica;
  const header = fe.FatturaElettronicaHeader;
  const body = Array.isArray(fe.FatturaElettronicaBody)
    ? fe.FatturaElettronicaBody[0]
    : fe.FatturaElettronicaBody;

  const cedente = header.CedentePrestatore;
  const datiAnag = cedente.DatiAnagrafici;
  const datiGen = body.DatiGenerali.DatiGeneraliDocumento;
  const beniServizi = body.DatiBeniServizi;
  const datiPagamento = body.DatiPagamento;

  // Extract line items
  const dettaglioLinee = Array.isArray(beniServizi.DettaglioLinee)
    ? beniServizi.DettaglioLinee
    : [beniServizi.DettaglioLinee];

  const righe: FatturaRiga[] = dettaglioLinee.map((linea: Record<string, unknown>) => ({
    descrizione: String(linea.Descrizione ?? ""),
    quantita: linea.Quantita ? Number(linea.Quantita) : undefined,
    prezzoUnitario: linea.PrezzoUnitario ? Number(linea.PrezzoUnitario) : undefined,
    importo: Number(linea.PrezzoTotale ?? 0),
    aliquotaIva: Number(linea.AliquotaIVA ?? 0),
    natura: linea.Natura ? String(linea.Natura) : undefined,
  }));

  // Extract VAT summary
  const riepilogo = Array.isArray(beniServizi.DatiRiepilogo)
    ? beniServizi.DatiRiepilogo
    : [beniServizi.DatiRiepilogo];

  const imponibile = riepilogo.reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.ImponibileImporto ?? 0),
    0
  );
  const iva = riepilogo.reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.Imposta ?? 0),
    0
  );
  const aliquotaPrincipale = Number(riepilogo[0]?.AliquotaIVA ?? 0);

  // Extract payment terms
  const scadenzePagamento: ScadenzaPagamento[] = [];
  if (datiPagamento) {
    const dettagliPagamento = Array.isArray(datiPagamento.DettaglioPagamento)
      ? datiPagamento.DettaglioPagamento
      : datiPagamento.DettaglioPagamento
        ? [datiPagamento.DettaglioPagamento]
        : [];

    for (const dp of dettagliPagamento) {
      scadenzePagamento.push({
        data: new Date(String(dp.DataScadenzaPagamento)),
        importo: Number(dp.ImportoPagamento ?? 0),
        modalita: dp.ModalitaPagamento ? String(dp.ModalitaPagamento) : undefined,
      });
    }
  }

  return {
    tipoDocumento: String(datiGen.TipoDocumento),
    cedente: {
      denominazione: String(datiAnag.Anagrafica?.Denominazione ?? ""),
      partitaIva: datiAnag.IdFiscaleIVA?.IdCodice
        ? String(datiAnag.IdFiscaleIVA.IdCodice)
        : undefined,
      codiceFiscale: datiAnag.CodiceFiscale
        ? String(datiAnag.CodiceFiscale)
        : undefined,
      nazione: datiAnag.IdFiscaleIVA?.IdPaese
        ? String(datiAnag.IdFiscaleIVA.IdPaese)
        : "IT",
    },
    dataFattura: new Date(String(datiGen.Data)),
    numeroFattura: String(datiGen.Numero),
    importoTotale: datiGen.ImportoTotaleDocumento
      ? Number(datiGen.ImportoTotaleDocumento)
      : imponibile + iva,
    imponibile,
    iva,
    aliquotaIva: aliquotaPrincipale,
    righe,
    scadenzePagamento,
    xmlOriginale: xml,
  };
}

export class FattureFileAdapter implements FattureProvider {
  constructor(private config: ProviderConfig) {}

  async importaFatturePassive(files?: File[]): Promise<FatturaImportata[]> {
    if (!files || files.length === 0) return [];

    const results: FatturaImportata[] = [];

    for (const file of files) {
      const text = await file.text();

      if (file.name.endsWith(".xml")) {
        results.push(parseFatturaXml(text));
      }
      // ZIP handling will be added in Sub-project 1
    }

    return results;
  }
}
