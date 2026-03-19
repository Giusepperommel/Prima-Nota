import { XMLParser } from "fast-xml-parser";
import type { ParsedDocument } from "./types";

/**
 * Parses an Italian FatturaPA XML (fattura elettronica) and extracts
 * accounting-relevant fields into a ParsedDocument.
 */
export function parseFatturaXml(xmlContent: string): ParsedDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Preserve text content even when there are attributes
    textNodeName: "#text",
  });

  const parsed = parser.parse(xmlContent);

  // Navigate into the body — FatturaPA XML can have different root wrappers
  // (e.g. <p:FatturaElettronica>, <ns:FatturaElettronica>, <FatturaElettronica>)
  const root = findFatturaRoot(parsed);
  if (!root) {
    throw new Error("XML non riconosciuto come FatturaPA");
  }

  const header = root.FatturaElettronicaHeader || {};
  const body = root.FatturaElettronicaBody || {};

  // Handle array of bodies (multi-lotto) — use first one
  const bodyObj = Array.isArray(body) ? body[0] : body;

  const cedente = header?.CedentePrestatore?.DatiAnagrafici || {};
  const datiGenerali = bodyObj?.DatiGenerali || {};
  const datiGeneraliDoc = datiGenerali?.DatiGeneraliDocumento || {};
  const datiBeniServizi = bodyObj?.DatiBeniServizi || {};
  const datiPagamento = bodyObj?.DatiPagamento || {};

  // --- Riepilogo IVA ---
  const riepilogo = datiBeniServizi?.DatiRiepilogo;
  const riepilogoArr = riepilogo
    ? (Array.isArray(riepilogo) ? riepilogo : [riepilogo])
    : [];

  // --- Importi ---
  const importoTotale = parseNum(datiGeneraliDoc?.ImportoTotaleDocumento);

  // Sum imponibile and IVA from all riepilogo lines
  let imponibile: number | null = null;
  let importoIva: number | null = null;
  let aliquotaIva: string | null = null;
  let naturaIva: string | undefined;
  let splitPayment = false;

  for (const r of riepilogoArr) {
    const imp = parseNum(r?.ImponibileImporto);
    const iva = parseNum(r?.Imposta);
    if (imp != null) imponibile = (imponibile ?? 0) + imp;
    if (iva != null) importoIva = (importoIva ?? 0) + iva;

    // Take aliquota from the first riepilogo with a non-zero rate
    if (!aliquotaIva && r?.AliquotaIVA) {
      const rate = parseNum(r.AliquotaIVA);
      if (rate != null && rate > 0) {
        aliquotaIva = String(Math.round(rate));
      }
    }

    // Natura IVA (e.g. N1, N2, N4 etc.)
    if (!naturaIva && r?.Natura) {
      naturaIva = String(r.Natura);
    }

    // Split payment: EsigibilitaIVA = "S"
    if (String(r?.EsigibilitaIVA).toUpperCase() === "S") {
      splitPayment = true;
    }
  }

  // --- Cedente/Prestatore ---
  const denominazione = cedente?.Anagrafica?.Denominazione
    ? String(cedente.Anagrafica.Denominazione)
    : (cedente?.Anagrafica?.Nome && cedente?.Anagrafica?.Cognome
      ? `${cedente.Anagrafica.Nome} ${cedente.Anagrafica.Cognome}`
      : undefined);

  const partitaIva = cedente?.IdFiscaleIVA?.IdCodice
    ? String(cedente.IdFiscaleIVA.IdCodice)
    : undefined;

  const codiceFiscale = cedente?.CodiceFiscale
    ? String(cedente.CodiceFiscale)
    : undefined;

  const regimeFiscale = cedente?.RegimeFiscale
    ? String(cedente.RegimeFiscale)
    : undefined;

  // --- Tipo documento SDI ---
  const tipoDocumentoSdi = datiGeneraliDoc?.TipoDocumento
    ? String(datiGeneraliDoc.TipoDocumento)
    : undefined;

  // --- Ritenuta ---
  const datiRitenutaXml = datiGeneraliDoc?.DatiRitenuta;
  let datiRitenuta: ParsedDocument["datiRitenuta"] | undefined;
  if (datiRitenutaXml) {
    const ritenuta = Array.isArray(datiRitenutaXml) ? datiRitenutaXml[0] : datiRitenutaXml;
    const tipoRitenutaRaw = ritenuta?.TipoRitenuta ? String(ritenuta.TipoRitenuta) : undefined;
    const tipoRitenutaMapped = tipoRitenutaRaw === "RT01"
      ? "LAVORO_AUTONOMO"
      : tipoRitenutaRaw === "RT02"
        ? "PROVVIGIONI"
        : tipoRitenutaRaw;

    datiRitenuta = {
      tipoRitenuta: tipoRitenutaMapped,
      aliquota: parseNum(ritenuta?.AliquotaRitenuta) ?? undefined,
      importoRitenuta: parseNum(ritenuta?.ImportoRitenuta) ?? undefined,
    };
  }

  // --- Cassa previdenziale ---
  const datiCassa = datiGeneraliDoc?.DatiCassaPrevidenziale;
  let cassaPrevidenziale: number | undefined;
  if (datiCassa) {
    const cassa = Array.isArray(datiCassa) ? datiCassa[0] : datiCassa;
    cassaPrevidenziale = parseNum(cassa?.ImportoContributoCassa) ?? undefined;
  }

  // --- Data pagamento ---
  const dettaglioPagamento = datiPagamento?.DettaglioPagamento;
  let dataPagamento: string | undefined;
  if (dettaglioPagamento) {
    const dettaglio = Array.isArray(dettaglioPagamento)
      ? dettaglioPagamento[0]
      : dettaglioPagamento;
    if (dettaglio?.DataScadenzaPagamento) {
      dataPagamento = String(dettaglio.DataScadenzaPagamento);
    }
  }

  // --- Numero documento e data ---
  const numeroDocumento = datiGeneraliDoc?.Numero
    ? String(datiGeneraliDoc.Numero)
    : null;

  const dataOperazione = datiGeneraliDoc?.Data
    ? String(datiGeneraliDoc.Data)
    : null;

  // --- Descrizione ---
  const causaleFull = datiGeneraliDoc?.Causale;
  let causale: string | null = null;
  if (causaleFull) {
    if (Array.isArray(causaleFull)) {
      causale = causaleFull.map(String).join(" ");
    } else {
      causale = String(causaleFull);
    }
  }

  const descParts: string[] = [];
  if (numeroDocumento) descParts.push(`Fatt. ${numeroDocumento}`);
  if (denominazione) descParts.push(denominazione);
  const descrizione = descParts.length > 0 ? descParts.join(" - ") : causale;

  // --- Tipo operazione ---
  // TD01 = fattura, TD04 = nota di credito, TD02 = acconto, etc.
  let tipoOperazione: "COSTO" | "FATTURA_ATTIVA" | null = "COSTO";
  if (tipoDocumentoSdi === "TD01" || tipoDocumentoSdi === "TD02") {
    tipoOperazione = "COSTO";
  }

  const result: ParsedDocument = {
    dataOperazione,
    numeroDocumento,
    descrizione,
    importoTotale: importoTotale ?? imponibile,
    imponibile,
    aliquotaIva,
    importoIva,
    tipoOperazione,
    fornitore: denominazione ?? null,

    // Advanced fields
    tipoDocumentoSdi,
    naturaIva,
    splitPayment,
    cedentePrestatore: (denominazione || partitaIva || codiceFiscale || regimeFiscale)
      ? { denominazione, partitaIva, codiceFiscale, regimeFiscale }
      : undefined,
    datiRitenuta,
    cassaPrevidenziale,
    dataPagamento,
  };

  return result;
}

/**
 * Recursively find the FatturaElettronica root node regardless of namespace prefix.
 */
function findFatturaRoot(obj: any): any {
  if (!obj || typeof obj !== "object") return null;

  for (const key of Object.keys(obj)) {
    if (key === "FatturaElettronica" || key.endsWith(":FatturaElettronica")) {
      return obj[key];
    }
    // Recurse one level (for XML declaration wrappers)
    if (key === "?xml") continue;
    const child = obj[key];
    if (child && typeof child === "object") {
      if (child.FatturaElettronicaHeader || child.FatturaElettronicaBody) {
        return child;
      }
      for (const subKey of Object.keys(child)) {
        if (subKey === "FatturaElettronica" || subKey.endsWith(":FatturaElettronica")) {
          return child[subKey];
        }
      }
    }
  }
  return null;
}

function parseNum(val: any): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
