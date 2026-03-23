import { GENERATORI } from "./generatori";
import { ContoResolver } from "./conto-resolver";
import { validaScrittura } from "./validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata, OperazioneContabile } from "./types";

export interface MotoreInput {
  operazione: OperazioneContabile;
  societaId: number;
  categoriaContoId: number | null;
  anagraficaDenominazione?: string;
  contoEsplicito?: number | null;
  // Context for causale determination
  tipoDocumentoSdi?: string;
  isReverseCharge?: boolean;
  isCespite?: boolean;
  isNotaCredito?: boolean;
  isSplitPayment?: boolean;
}

export interface MotoreResult {
  scritture: ScritturaGenerataConStato[];
  success: boolean;
  errors: string[];
}

export interface ScritturaGenerataConStato extends ScritturaGenerata {
  stato: 'DEFINITIVA' | 'PROVVISORIA';
}

/**
 * Determines the causale contabile from operation type and context.
 */
export function determinaCausale(input: MotoreInput): string {
  const { operazione, isReverseCharge, isCespite, isNotaCredito, isSplitPayment, tipoDocumentoSdi } = input;
  const tipo = operazione.tipoOperazione;

  // Reverse charge takes priority
  if (isReverseCharge) {
    if (tipoDocumentoSdi === 'TD17' || tipoDocumentoSdi === 'TD18') return 'FAUE';
    return 'FARE'; // TD16, TD19, or generic
  }

  switch (tipo) {
    case 'FATTURA_ATTIVA':
      if (isNotaCredito) return 'NCV';
      if (isSplitPayment) return 'FVS';
      return 'FV';
    case 'COSTO':
      if (isCespite) return 'FA_CESPITE';
      if (isNotaCredito) return 'NCA';
      return 'FA';
    case 'CESPITE':
      return 'FA_CESPITE';
    case 'COMPENSO_AMMINISTRATORE':
      return 'CA';
    case 'PAGAMENTO_IMPOSTE':
      return 'F24';
    case 'DISTRIBUZIONE_DIVIDENDI':
      return 'DIV';
    default:
      return 'OG'; // fallback to generic
  }
}

/**
 * Main orchestrator: generates journal entries from an operation.
 */
export function generaScritture(
  input: MotoreInput,
  pdcMap: Map<string, number>
): MotoreResult {
  const resolver = new ContoResolver(pdcMap);
  const causale = determinaCausale(input);

  const generatore = GENERATORI[causale];
  if (!generatore) {
    return {
      scritture: [],
      success: false,
      errors: [`Nessun generatore trovato per causale: ${causale}`],
    };
  }

  const generatoreInput: GeneratoreInput = {
    operazione: input.operazione,
    societaId: input.societaId,
    categoriaContoId: input.categoriaContoId,
    anagraficaDenominazione: input.anagraficaDenominazione,
    contoEsplicito: input.contoEsplicito,
    causaleOverride: causale,
  };

  try {
    const result = generatore(generatoreInput, resolver);
    const scrittureRaw = Array.isArray(result) ? result : [result];

    const scritture: ScritturaGenerataConStato[] = [];
    const errors: string[] = [];

    for (const s of scrittureRaw) {
      const validazione = validaScrittura(s.movimenti);

      if (!validazione.valida) {
        errors.push(...validazione.errori);
      }

      const hasWarnings = s.warnings.length > 0;
      const hasErrors = !validazione.valida;

      scritture.push({
        ...s,
        totaleDare: validazione.totaleDare,
        totaleAvere: validazione.totaleAvere,
        stato: (hasWarnings || hasErrors) ? 'PROVVISORIA' : 'DEFINITIVA',
      });
    }

    return {
      scritture,
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      scritture: [],
      success: false,
      errors: [`Errore generazione scritture: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
