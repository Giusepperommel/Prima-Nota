import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

/**
 * Genera la scrittura contabile per pagamento fornitore (PG) o incasso cliente (IN).
 *
 * PG (pagamento fornitore):
 *   Dare: DEBITI_FORNITORI = importoTotale
 *   Avere: BANCA_CC = importoTotale
 *
 * IN (incasso cliente):
 *   Dare: BANCA_CC = importoTotale
 *   Avere: CREDITI_CLIENTI = importoTotale
 */
export function generaPagamento(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, causaleOverride, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const isIncasso = causaleOverride === "IN";
  const causale = isIncasso ? "IN" : "PG";

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  const importo = operazione.importoTotale;

  const contoBanca = resolver.getStrutturale("BANCA_CC");

  let ordine = 1;

  if (isIncasso) {
    // IN: incasso da cliente
    const contoCreditiClienti = resolver.getStrutturale("CREDITI_CLIENTI");

    // Dare: BANCA_CC
    movimenti.push({
      contoId: contoBanca!,
      importoDare: importo,
      importoAvere: 0,
      descrizione: "Entrata banca c/c",
      ordine: ordine++,
    });

    // Avere: CREDITI_CLIENTI
    movimenti.push({
      contoId: contoCreditiClienti!,
      importoDare: 0,
      importoAvere: importo,
      descrizione: "Chiusura credito cliente",
      ordine: ordine++,
    });
  } else {
    // PG: pagamento fornitore
    const contoDebitiFornitori = resolver.getStrutturale("DEBITI_FORNITORI");

    // Dare: DEBITI_FORNITORI
    movimenti.push({
      contoId: contoDebitiFornitori!,
      importoDare: importo,
      importoAvere: 0,
      descrizione: "Chiusura debito fornitore",
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
