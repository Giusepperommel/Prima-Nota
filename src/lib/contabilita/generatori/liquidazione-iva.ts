import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

/**
 * Genera la scrittura contabile per la liquidazione IVA periodica.
 *
 * Approccio semplificato — registra il versamento o il credito:
 *
 * Se importoTotale > 0 (IVA a debito, da versare):
 *   Dare: ERARIO_IVA = importoTotale
 *   Avere: BANCA_CC = importoTotale
 *
 * Se importoTotale <= 0 (IVA a credito, da riportare):
 *   Solo warning, nessun movimento bancario (il credito si riporta)
 *
 * Se vengono forniti campi extra (totaleIvaVendite, totaleIvaAcquisti),
 * genera la scrittura completa di giroconto:
 *   Dare: IVA_DEBITO = totaleIvaVendite
 *   Avere: IVA_CREDITO = totaleIvaAcquisti
 *   Avere: ERARIO_IVA = differenza
 */
export function generaLiquidazioneIva(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "LQ";

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  const op = operazione as unknown as Record<string, unknown>;
  const totaleIvaVendite = typeof op.totaleIvaVendite === "number" ? op.totaleIvaVendite : null;
  const totaleIvaAcquisti = typeof op.totaleIvaAcquisti === "number" ? op.totaleIvaAcquisti : null;

  let ordine = 1;

  if (totaleIvaVendite !== null && totaleIvaAcquisti !== null) {
    // Scrittura completa di giroconto liquidazione
    const contoIvaDebito = resolver.getStrutturale("IVA_DEBITO");
    const contoIvaCredito = resolver.getStrutturale("IVA_CREDITO");
    const contoErarioIva = resolver.getStrutturale("ERARIO_IVA");

    const differenza = Math.round((totaleIvaVendite - totaleIvaAcquisti) * 100) / 100;

    // Dare: IVA_DEBITO (chiusura IVA vendite)
    movimenti.push({
      contoId: contoIvaDebito!,
      importoDare: totaleIvaVendite,
      importoAvere: 0,
      descrizione: "Chiusura IVA a debito",
      ordine: ordine++,
    });

    // Avere: IVA_CREDITO (chiusura IVA acquisti)
    movimenti.push({
      contoId: contoIvaCredito!,
      importoDare: 0,
      importoAvere: totaleIvaAcquisti,
      descrizione: "Chiusura IVA a credito",
      ordine: ordine++,
    });

    // Avere: ERARIO_IVA (differenza = debito verso erario)
    if (differenza > 0) {
      movimenti.push({
        contoId: contoErarioIva!,
        importoDare: 0,
        importoAvere: differenza,
        descrizione: "IVA da versare all'erario",
        ordine: ordine++,
      });
    } else if (differenza < 0) {
      // IVA a credito: dare erario
      movimenti.push({
        contoId: contoErarioIva!,
        importoDare: Math.abs(differenza),
        importoAvere: 0,
        descrizione: "IVA a credito verso erario",
        ordine: ordine++,
      });
    }
  } else {
    // Approccio semplificato: solo versamento
    const importo = operazione.importoTotale;

    if (importo > 0) {
      const contoErarioIva = resolver.getStrutturale("ERARIO_IVA");
      const contoBanca = resolver.getStrutturale("BANCA_CC");

      // Dare: ERARIO_IVA
      movimenti.push({
        contoId: contoErarioIva!,
        importoDare: importo,
        importoAvere: 0,
        descrizione: "Versamento IVA periodica",
        ordine: ordine++,
      });

      // Avere: BANCA_CC
      movimenti.push({
        contoId: contoBanca!,
        importoDare: 0,
        importoAvere: importo,
        descrizione: "Uscita banca c/c",
        ordine: ordine++,
      });
    } else {
      warnings.push("IVA a credito — nessun versamento da registrare, credito riportato al periodo successivo");
    }
  }

  const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
  const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

  return {
    descrizione,
    causale,
    movimenti,
    totaleDare,
    totaleAvere,
    warnings,
  };
}
