import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";
import type { ContoStrutturale } from "../causali";

/**
 * Sottotipi imposta riconosciuti per F24.
 */
type SottotipoImposta =
  | "ACCONTO_IRES"
  | "ACCONTO_IRAP"
  | "SALDO_IRES"
  | "SALDO_IRAP"
  | "VERSAMENTO_RITENUTE"
  | "VERSAMENTO_IVA";

const SOTTOTIPO_CONTO: Record<SottotipoImposta, ContoStrutturale> = {
  ACCONTO_IRES: "ERARIO_ACCONTI_IRES",
  ACCONTO_IRAP: "ERARIO_ACCONTI_IRAP",
  SALDO_IRES: "DEBITI_IRES",
  SALDO_IRAP: "DEBITI_IRAP",
  VERSAMENTO_RITENUTE: "ERARIO_RITENUTE",
  VERSAMENTO_IVA: "ERARIO_IVA",
};

/**
 * Genera la scrittura contabile per il pagamento di imposte tramite F24.
 *
 * Dare: [conto imposta in base al sottotipo] = importoTotale
 * Avere: BANCA_CC = importoTotale
 */
export function generaPagamentoImposte(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "F24";

  // Determine sottotipo from extra field
  const op = operazione as unknown as Record<string, unknown>;
  const sottotipoImposta = op.sottotipoImposta as SottotipoImposta | undefined;

  // Resolve the debit account based on sottotipo
  let contoIdDare: number | null = null;
  let descrizioneMovDare = "Pagamento tributi";

  if (sottotipoImposta && SOTTOTIPO_CONTO[sottotipoImposta]) {
    const key = SOTTOTIPO_CONTO[sottotipoImposta];
    contoIdDare = resolver.getStrutturale(key);
    if (contoIdDare === null) {
      warnings.push(`Conto ${key} non trovato nel Piano dei Conti`);
    }
    descrizioneMovDare = `Pagamento ${sottotipoImposta.replace(/_/g, " ").toLowerCase()}`;
  } else {
    // Default: use ERARIO_IVA as generic tax payment account
    contoIdDare = resolver.getStrutturale("ERARIO_IVA");
    if (contoIdDare === null) {
      warnings.push("Conto ERARIO_IVA non trovato nel Piano dei Conti");
    }
    warnings.push("Sottotipo imposta non specificato — utilizzato ERARIO_IVA come default");
  }

  const contoBanca = resolver.getStrutturale("BANCA_CC");

  const importo = operazione.importoTotale;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  // Dare: conto imposta
  movimenti.push({
    contoId: contoIdDare as number,
    importoDare: importo,
    importoAvere: 0,
    descrizione: descrizioneMovDare,
    ordine: ordine++,
  });

  // Avere: banca
  movimenti.push({
    contoId: contoBanca!,
    importoDare: 0,
    importoAvere: importo,
    descrizione: "Uscita banca c/c",
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
