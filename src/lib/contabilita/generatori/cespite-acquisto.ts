import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";
import { MAPPING_CESPITI, type TipoCespiteMapping } from "../causali";

/**
 * Genera la scrittura contabile per l'acquisto di un cespite (immobilizzazione).
 *
 * Dare: [conto immobilizzazione da MAPPING_CESPITI] = importoImponibile + ivaIndetraibile
 * Dare: IVA_CREDITO = ivaDetraibile (if > 0)
 * Avere: DEBITI_FORNITORI = importoTotale
 */
export function generaCespiteAcquisto(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "FA_CESPITE";

  // Determine cespite type from extra field
  const op = operazione as Record<string, unknown>;
  const sottotipoCespite = op.sottotipoCespite as TipoCespiteMapping | undefined;

  let contoIdAsset: number | null = null;

  if (sottotipoCespite && MAPPING_CESPITI[sottotipoCespite]) {
    const codiceAsset = MAPPING_CESPITI[sottotipoCespite].asset;
    // Access pdcMap to resolve the cespite code to an account id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdcMap = (resolver as any).pdcMap as Map<string, number>;
    contoIdAsset = pdcMap.get(codiceAsset) ?? null;
    if (contoIdAsset === null) {
      warnings.push(`Conto cespite ${sottotipoCespite} (${codiceAsset}) non trovato nel Piano dei Conti`);
    }
  } else {
    // Fallback: use categoriaContoId or contoEsplicito
    const fallbackResult = input.contoEsplicito
      ? resolver.resolveEsplicito(input.contoEsplicito)
      : resolver.resolveCategoria(input.categoriaContoId);
    if (fallbackResult.warning) {
      warnings.push(fallbackResult.warning);
    }
    contoIdAsset = fallbackResult.contoId;
    if (contoIdAsset === null) {
      warnings.push("Tipo cespite non specificato e nessun conto fallback — scrittura provvisoria");
    }
  }

  // Resolve structural accounts
  const contoIvaCredito = resolver.getStrutturale("IVA_CREDITO");
  const contoDebitiFornitori = resolver.getStrutturale("DEBITI_FORNITORI");

  // Extract amounts
  const importoImponibile = operazione.importoImponibile ?? operazione.importoTotale;
  const ivaDetraibile = operazione.ivaDetraibile ?? 0;
  const ivaIndetraibile = operazione.ivaIndetraibile ?? 0;

  // Asset value = imponibile + IVA indetraibile
  const importoAsset = importoImponibile + ivaIndetraibile;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  // Dare: conto immobilizzazione
  movimenti.push({
    contoId: contoIdAsset as number,
    importoDare: importoAsset,
    importoAvere: 0,
    descrizione: "Acquisto cespite",
    ordine: ordine++,
  });

  // Dare: IVA credito (if > 0)
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
    importoAvere: operazione.importoTotale,
    descrizione: "Debito verso fornitore",
    ordine: ordine++,
  });

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
