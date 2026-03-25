import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";
import { MAPPING_CESPITI, type TipoCespiteMapping } from "../causali";

/**
 * Genera la scrittura contabile per l'ammortamento annuale di un cespite.
 *
 * Dare: [conto ammortamento da MAPPING_CESPITI] = quotaAnnuale (= importoTotale)
 * Avere: [conto fondo da MAPPING_CESPITI]       = quotaAnnuale
 */
export function generaAmmortamento(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "AM";

  // Determine cespite type from extra field
  const op = operazione as unknown as Record<string, unknown>;
  const sottotipoCespite = op.sottotipoCespite as TipoCespiteMapping | undefined;

  let contoIdAmm: number | null = null;
  let contoIdFondo: number | null = null;

  if (sottotipoCespite && MAPPING_CESPITI[sottotipoCespite]) {
    const mapping = MAPPING_CESPITI[sottotipoCespite];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdcMap = (resolver as any).pdcMap as Map<string, number>;
    contoIdAmm = pdcMap.get(mapping.amm) ?? null;
    contoIdFondo = pdcMap.get(mapping.fondo) ?? null;

    if (contoIdAmm === null) {
      warnings.push(`Conto ammortamento ${sottotipoCespite} (${mapping.amm}) non trovato nel Piano dei Conti`);
    }
    if (contoIdFondo === null) {
      warnings.push(`Conto fondo ${sottotipoCespite} (${mapping.fondo}) non trovato nel Piano dei Conti`);
    }
  } else {
    warnings.push("Tipo cespite non specificato — impossibile determinare conti ammortamento/fondo");
  }

  const quotaAnnuale = operazione.importoTotale;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  // Dare: ammortamento
  movimenti.push({
    contoId: contoIdAmm as number,
    importoDare: quotaAnnuale,
    importoAvere: 0,
    descrizione: "Quota ammortamento",
    ordine: ordine++,
  });

  // Avere: fondo ammortamento
  movimenti.push({
    contoId: contoIdFondo as number,
    importoDare: 0,
    importoAvere: quotaAnnuale,
    descrizione: "Fondo ammortamento",
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
