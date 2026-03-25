/**
 * Automatic matching engine for bank reconciliation.
 * Matches bank movements with operations by amount and date proximity.
 */

export type MovimentoPerMatch = {
  id: number;
  data: Date;
  importo: number;
  segno: "DARE" | "AVERE";
  descrizione: string;
};

export type OperazionePerMatch = {
  id: number;
  dataOperazione: Date;
  importoTotale: number;
  tipoOperazione: string;
  descrizione: string;
  numeroDocumento: string | null;
};

export type Suggerimento = {
  movimentoId: number;
  operazioneId: number;
  score: number; // 0-100, higher is better match
  motivazione: string;
};

export type MatchConfig = {
  /** Max days difference for date matching (default: 5) */
  maxGiorniDifferenza: number;
  /** Tolerance for amount matching as percentage (default: 0.01 = 1%) */
  tolleranzaImporto: number;
  /** Minimum score to include as suggestion (default: 50) */
  scoreMinimo: number;
};

const DEFAULT_CONFIG: MatchConfig = {
  maxGiorniDifferenza: 5,
  tolleranzaImporto: 0.01,
  scoreMinimo: 50,
};

/**
 * Generate match suggestions between bank movements and operations.
 * Pure function, no DB dependency.
 */
export function generaSuggerimenti(
  movimenti: MovimentoPerMatch[],
  operazioni: OperazionePerMatch[],
  config: Partial<MatchConfig> = {},
): Suggerimento[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const suggerimenti: Suggerimento[] = [];

  for (const mov of movimenti) {
    let bestMatch: Suggerimento | null = null;

    for (const op of operazioni) {
      const score = calcolaScore(mov, op, cfg);
      if (score >= cfg.scoreMinimo) {
        const motivazione = generaMotivazione(mov, op, score);
        const suggestion = {
          movimentoId: mov.id,
          operazioneId: op.id,
          score,
          motivazione,
        };

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = suggestion;
        }
      }
    }

    if (bestMatch) {
      suggerimenti.push(bestMatch);
    }
  }

  return suggerimenti.sort((a, b) => b.score - a.score);
}

/**
 * Calculate match score between a movement and an operation.
 */
export function calcolaScore(
  movimento: MovimentoPerMatch,
  operazione: OperazionePerMatch,
  config: MatchConfig = DEFAULT_CONFIG,
): number {
  let score = 0;

  // 1. Amount match (max 50 points)
  const importoOp = Number(operazione.importoTotale);
  const diff = Math.abs(movimento.importo - importoOp);
  const tolleranza = importoOp * config.tolleranzaImporto;

  if (diff === 0) {
    score += 50;
  } else if (diff <= tolleranza) {
    score += 40;
  } else if (diff <= importoOp * 0.05) {
    score += 20;
  } else {
    return 0; // Amount too different, skip
  }

  // 2. Date proximity (max 30 points)
  const giorniDiff = Math.abs(
    differenzaGiorni(movimento.data, operazione.dataOperazione),
  );

  if (giorniDiff === 0) {
    score += 30;
  } else if (giorniDiff <= 1) {
    score += 25;
  } else if (giorniDiff <= 3) {
    score += 15;
  } else if (giorniDiff <= config.maxGiorniDifferenza) {
    score += 5;
  } else {
    return 0; // Date too far, skip
  }

  // 3. Direction consistency (max 10 points)
  const isEntrata =
    operazione.tipoOperazione === "FATTURA_ATTIVA" ||
    operazione.tipoOperazione === "DISTRIBUZIONE_DIVIDENDI";
  const isAvere = movimento.segno === "AVERE";

  if ((isEntrata && isAvere) || (!isEntrata && !isAvere)) {
    score += 10;
  }

  // 4. Description similarity (max 10 points)
  if (operazione.numeroDocumento && movimento.descrizione.includes(operazione.numeroDocumento)) {
    score += 10;
  } else if (hasSimilarWords(movimento.descrizione, operazione.descrizione)) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Calculate day difference between two dates.
 */
export function differenzaGiorni(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / msPerDay);
}

/**
 * Check if two descriptions share significant words.
 */
function hasSimilarWords(a: string, b: string): boolean {
  const stopWords = new Set(["di", "il", "la", "lo", "le", "un", "una", "del", "della", "per", "con", "da", "in", "a", "e"]);
  const wordsA = new Set(
    a.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)),
  );
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

  return wordsB.some((w) => wordsA.has(w));
}

function generaMotivazione(
  mov: MovimentoPerMatch,
  op: OperazionePerMatch,
  score: number,
): string {
  const parts: string[] = [];
  const diff = Math.abs(mov.importo - Number(op.importoTotale));

  if (diff === 0) {
    parts.push("importo identico");
  } else {
    parts.push(`differenza importo: ${diff.toFixed(2)}`);
  }

  const giorni = Math.abs(differenzaGiorni(mov.data, op.dataOperazione));
  if (giorni === 0) {
    parts.push("stessa data");
  } else {
    parts.push(`${giorni} giorni di differenza`);
  }

  if (score >= 80) {
    parts.unshift("Match molto probabile");
  } else if (score >= 60) {
    parts.unshift("Match probabile");
  } else {
    parts.unshift("Match possibile");
  }

  return parts.join(" - ");
}
