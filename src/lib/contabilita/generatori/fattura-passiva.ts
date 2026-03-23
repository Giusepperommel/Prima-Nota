import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

export function generaFatturaPassiva(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, categoriaContoId, contoEsplicito, causaleOverride, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  // Determine causale
  const isNotaCredito = causaleOverride === "NCA";
  const causale = isNotaCredito ? "NCA" : "FA";

  // Resolve costo account
  const costoResult = contoEsplicito
    ? resolver.resolveEsplicito(contoEsplicito)
    : resolver.resolveCategoria(categoriaContoId);

  if (costoResult.contoId === null) {
    warnings.push(costoResult.warning ?? "Conto costo non risolvibile — scrittura provvisoria");
  }

  const contoIdCosto = costoResult.contoId;

  // Resolve structural accounts
  const contoIvaCredito = resolver.getStrutturale("IVA_CREDITO");
  const contoDebitiFornitori = resolver.getStrutturale("DEBITI_FORNITORI");
  const contoRitenute = resolver.getStrutturale("ERARIO_RITENUTE");

  // Extract amounts
  const importoImponibile = operazione.importoImponibile ?? operazione.importoTotale;
  const ivaDetraibile = operazione.ivaDetraibile ?? 0;
  const ivaIndetraibile = operazione.ivaIndetraibile ?? 0;
  const importoRitenuta = operazione.importoRitenuta ?? 0;

  // Cost = imponibile + IVA indetraibile
  const importoCosto = importoImponibile + ivaIndetraibile;

  // Fornitore amount = totale - ritenuta
  const importoFornitori = operazione.importoTotale - importoRitenuta;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  if (isNotaCredito) {
    // NCA: dare/avere invertiti
    // Dare: debiti fornitori (storno debito)
    movimenti.push({
      contoId: contoDebitiFornitori!,
      importoDare: importoFornitori,
      importoAvere: 0,
      descrizione: "Storno debito fornitore",
      ordine: ordine++,
    });

    // Avere: costo (storno)
    movimenti.push({
      contoId: contoIdCosto as number,
      importoDare: 0,
      importoAvere: importoCosto,
      descrizione: "Storno costo",
      ordine: ordine++,
    });

    // Avere: IVA credito (storno) — only if > 0
    if (ivaDetraibile > 0) {
      movimenti.push({
        contoId: contoIvaCredito!,
        importoDare: 0,
        importoAvere: ivaDetraibile,
        descrizione: "Storno IVA a credito",
        ordine: ordine++,
      });
    }
  } else {
    // FA: fattura acquisto standard
    // Dare: costo
    movimenti.push({
      contoId: contoIdCosto as number,
      importoDare: importoCosto,
      importoAvere: 0,
      descrizione: "Costo acquisto",
      ordine: ordine++,
    });

    // Dare: IVA credito — only if > 0
    if (ivaDetraibile > 0) {
      movimenti.push({
        contoId: contoIvaCredito!,
        importoDare: ivaDetraibile,
        importoAvere: 0,
        descrizione: "IVA a credito",
        ordine: ordine++,
      });
    }

    // Avere: debiti fornitori
    movimenti.push({
      contoId: contoDebitiFornitori!,
      importoDare: 0,
      importoAvere: importoFornitori,
      descrizione: "Debito verso fornitore",
      ordine: ordine++,
    });

    // Avere: ritenute — only if > 0
    if (importoRitenuta > 0) {
      movimenti.push({
        contoId: contoRitenute!,
        importoDare: 0,
        importoAvere: importoRitenuta,
        descrizione: "Ritenuta d'acconto",
        ordine: ordine++,
      });
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
