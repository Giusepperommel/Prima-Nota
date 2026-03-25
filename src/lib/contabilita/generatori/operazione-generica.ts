import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

/**
 * Genera la scrittura contabile per un'operazione generica (modalita commercialista).
 *
 * Passa attraverso i movimenti forniti esplicitamente nell'input.
 * Se non ci sono movimenti espliciti, restituisce una scrittura vuota con warning.
 */
export function generaOperazioneGenerica(
  input: GeneratoreInput,
  _resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, anagraficaDenominazione } = input;
  const warnings: string[] = [];

  const causale = "OG";

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  // Movimenti espliciti from extra field
  const op = operazione as unknown as Record<string, unknown>;
  const movimentiEspliciti = Array.isArray(op.movimenti)
    ? (op.movimenti as MovimentoGenerato[])
    : [];

  if (movimentiEspliciti.length === 0) {
    warnings.push("Nessun movimento esplicito fornito — scrittura vuota");
  }

  const totaleDare = Math.round(movimentiEspliciti.reduce((s, m) => s + (m.importoDare ?? 0), 0) * 100) / 100;
  const totaleAvere = Math.round(movimentiEspliciti.reduce((s, m) => s + (m.importoAvere ?? 0), 0) * 100) / 100;

  return {
    descrizione,
    causale,
    movimenti: movimentiEspliciti,
    totaleDare,
    totaleAvere,
    warnings,
  };
}
