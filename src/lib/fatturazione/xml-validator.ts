/**
 * FatturaPA XML Validator — validates the FatturaPA data object BEFORE XML generation.
 *
 * Checks required fields, arithmetic consistency, and SDI business rules.
 */

import type { FatturaPA } from "./types";

export interface ValidationResult {
  valido: boolean;
  errori: string[];
  warnings: string[];
}

/**
 * Validates a FatturaPA data object for completeness and consistency.
 *
 * Returns errors (blocking) and warnings (non-blocking).
 */
export function validateFattura(fattura: FatturaPA): ValidationResult {
  const errori: string[] = [];
  const warnings: string[] = [];

  const header = fattura.FatturaElettronicaHeader;
  const body = fattura.FatturaElettronicaBody;

  // ─── Required fields: CedentePrestatore ──────────────────────────────────

  const cedente = header.CedentePrestatore;
  if (!cedente.DatiAnagrafici.IdFiscaleIVA?.IdCodice) {
    errori.push("IdFiscaleIVA del cedente/prestatore e obbligatorio");
  }
  if (!cedente.DatiAnagrafici.IdFiscaleIVA?.IdPaese) {
    errori.push("IdPaese del cedente/prestatore e obbligatorio");
  }
  if (!cedente.DatiAnagrafici.RegimeFiscale) {
    errori.push("RegimeFiscale del cedente/prestatore e obbligatorio");
  }
  const cedenteAna = cedente.DatiAnagrafici.Anagrafica;
  if (!cedenteAna.Denominazione && !(cedenteAna.Nome && cedenteAna.Cognome)) {
    errori.push("Denominazione o Nome/Cognome del cedente e obbligatorio");
  }

  // Sede cedente
  if (!cedente.Sede?.Indirizzo) {
    errori.push("Indirizzo sede del cedente e obbligatorio");
  }
  if (!cedente.Sede?.CAP) {
    errori.push("CAP sede del cedente e obbligatorio");
  }
  if (!cedente.Sede?.Comune) {
    errori.push("Comune sede del cedente e obbligatorio");
  }
  if (!cedente.Sede?.Nazione) {
    errori.push("Nazione sede del cedente e obbligatoria");
  }

  // ─── Required fields: CessionarioCommittente ─────────────────────────────

  const cessionario = header.CessionarioCommittente;
  if (!cessionario.DatiAnagrafici.IdFiscaleIVA?.IdCodice && !cessionario.DatiAnagrafici.CodiceFiscale) {
    errori.push("IdFiscaleIVA o CodiceFiscale del cessionario/committente e obbligatorio (errore SDI 00417)");
  }
  const cessAna = cessionario.DatiAnagrafici.Anagrafica;
  if (!cessAna.Denominazione && !(cessAna.Nome && cessAna.Cognome)) {
    errori.push("Denominazione o Nome/Cognome del cessionario e obbligatorio");
  }

  // ─── DatiTrasmissione ────────────────────────────────────────────────────

  const dt = header.DatiTrasmissione;
  if (!dt.FormatoTrasmissione) {
    errori.push("FormatoTrasmissione e obbligatorio");
  }

  // CodiceDestinatario length
  const cod = dt.CodiceDestinatario;
  if (!cod) {
    errori.push("CodiceDestinatario e obbligatorio");
  } else if (cod.length !== 7 && cod.length !== 6) {
    errori.push(`CodiceDestinatario deve essere 6 caratteri (PA) o 7 caratteri (B2B), ricevuto: ${cod.length}`);
  }

  // ─── DatiGeneraliDocumento ───────────────────────────────────────────────

  const dgd = body.DatiGenerali.DatiGeneraliDocumento;
  if (!dgd.TipoDocumento) {
    errori.push("TipoDocumento e obbligatorio");
  }
  if (!dgd.Data) {
    errori.push("Data documento e obbligatoria");
  }

  // Numero must contain at least one digit
  if (!dgd.Numero) {
    errori.push("Numero documento e obbligatorio");
  } else if (!/\d/.test(dgd.Numero)) {
    errori.push("Numero documento deve contenere almeno una cifra (errore SDI 00425)");
  }

  // ─── AliquotaIVA / Natura consistency ────────────────────────────────────

  const linee = body.DatiBeniServizi.DettaglioLinee;
  for (const linea of linee) {
    const aliquota = parseFloat(linea.AliquotaIVA);
    if (aliquota === 0 && !linea.Natura) {
      errori.push(
        `Linea ${linea.NumeroLinea}: Natura obbligatoria quando AliquotaIVA = 0 (errore SDI 00400)`
      );
    }
    if (aliquota > 0 && linea.Natura) {
      errori.push(
        `Linea ${linea.NumeroLinea}: Natura non ammessa quando AliquotaIVA > 0 (errore SDI 00401)`
      );
    }
  }

  // ─── Arithmetic: PrezzoTotale = PrezzoUnitario * Quantita (±0.01) ───────

  for (const linea of linee) {
    if (linea.Quantita) {
      const pu = parseFloat(linea.PrezzoUnitario);
      const qty = parseFloat(linea.Quantita);
      const pt = parseFloat(linea.PrezzoTotale);
      const expected = pu * qty;
      if (Math.abs(pt - expected) > 0.01) {
        errori.push(
          `Linea ${linea.NumeroLinea}: PrezzoTotale (${linea.PrezzoTotale}) non corrisponde a PrezzoUnitario * Quantita (${expected.toFixed(2)}), tolleranza ±0.01`
        );
      }
    }
  }

  // ─── Riepilogo consistency: ImponibileImporto matches line totals per aliquota ───

  const riepilogMap = new Map<string, number>();
  for (const linea of linee) {
    const key = `${linea.AliquotaIVA}|${linea.Natura || ""}`;
    riepilogMap.set(key, (riepilogMap.get(key) || 0) + parseFloat(linea.PrezzoTotale));
  }

  for (const riepilogo of body.DatiBeniServizi.DatiRiepilogo) {
    const key = `${riepilogo.AliquotaIVA}|${riepilogo.Natura || ""}`;
    const expectedImponibile = riepilogMap.get(key) || 0;
    const actualImponibile = parseFloat(riepilogo.ImponibileImporto);
    if (Math.abs(actualImponibile - expectedImponibile) > 0.01) {
      errori.push(
        `Riepilogo AliquotaIVA ${riepilogo.AliquotaIVA}: ImponibileImporto (${riepilogo.ImponibileImporto}) non corrisponde alla somma delle linee (${expectedImponibile.toFixed(2)})`
      );
    }

    // Check Imposta = ImponibileImporto * AliquotaIVA / 100
    const aliquota = parseFloat(riepilogo.AliquotaIVA);
    const expectedImposta = actualImponibile * aliquota / 100;
    const actualImposta = parseFloat(riepilogo.Imposta);
    if (Math.abs(actualImposta - expectedImposta) > 0.01) {
      errori.push(
        `Riepilogo AliquotaIVA ${riepilogo.AliquotaIVA}: Imposta (${riepilogo.Imposta}) non corrisponde a ImponibileImporto * AliquotaIVA / 100 (${expectedImposta.toFixed(2)})`
      );
    }

    // Natura required when AliquotaIVA = 0
    if (aliquota === 0 && !riepilogo.Natura) {
      errori.push(
        `Riepilogo AliquotaIVA 0: Natura obbligatoria (errore SDI 00400)`
      );
    }
  }

  // ─── DatiRitenuta coerenza ───────────────────────────────────────────────

  if (dgd.DatiRitenuta && dgd.DatiRitenuta.length > 0) {
    const hasLineaConRitenuta = linee.some((l) => l.Ritenuta === "SI");
    if (!hasLineaConRitenuta) {
      errori.push(
        "DatiRitenuta presente ma nessuna linea ha Ritenuta = 'SI' (errore SDI 00411)"
      );
    }
  }

  // ─── DatiBollo coerenza ──────────────────────────────────────────────────

  if (dgd.DatiBollo) {
    if (dgd.DatiBollo.BolloVirtuale === "SI" && !dgd.DatiBollo.ImportoBollo) {
      errori.push("BolloVirtuale = 'SI' ma ImportoBollo mancante (errore SDI 00471)");
    }
  }

  // ─── ImportoTotaleDocumento consistency (warning) ────────────────────────

  if (dgd.ImportoTotaleDocumento) {
    const totDoc = parseFloat(dgd.ImportoTotaleDocumento);
    let totRiepilogo = 0;
    for (const r of body.DatiBeniServizi.DatiRiepilogo) {
      totRiepilogo += parseFloat(r.ImponibileImporto) + parseFloat(r.Imposta);
    }
    if (Math.abs(totDoc - totRiepilogo) > 0.01) {
      warnings.push(
        `ImportoTotaleDocumento (${dgd.ImportoTotaleDocumento}) non corrisponde alla somma di ImponibileImporto + Imposta dei riepiloghi (${totRiepilogo.toFixed(2)})`
      );
    }
  }

  return {
    valido: errori.length === 0,
    errori,
    warnings,
  };
}
