export interface MovimentoGenerato {
  contoId: number;
  importoDare: number;
  importoAvere: number;
  descrizione?: string;
  ordine: number;
}

export interface RisultatoValidazione {
  valida: boolean;
  errori: string[];
  totaleDare: number;
  totaleAvere: number;
}

const TOLERANCE = 0.02;

export function validaScrittura(movimenti: MovimentoGenerato[]): RisultatoValidazione {
  const errori: string[] = [];

  if (movimenti.length === 0) {
    return { valida: false, errori: ["La scrittura deve avere almeno un movimento"], totaleDare: 0, totaleAvere: 0 };
  }

  for (let i = 0; i < movimenti.length; i++) {
    const m = movimenti[i];
    if (m.importoDare < 0 || m.importoAvere < 0) {
      errori.push(`Riga ${i + 1}: importi negativi non ammessi`);
    }
    if (m.importoDare > 0 && m.importoAvere > 0) {
      errori.push(`Riga ${i + 1}: dare e avere sono mutualmente esclusivi`);
    }
  }

  const totaleDare = movimenti.reduce((sum, m) => sum + m.importoDare, 0);
  const totaleAvere = movimenti.reduce((sum, m) => sum + m.importoAvere, 0);

  if (Math.abs(totaleDare - totaleAvere) > TOLERANCE) {
    errori.push(
      `Errore di quadratura: Dare ${totaleDare.toFixed(2)} != Avere ${totaleAvere.toFixed(2)} (differenza: ${Math.abs(totaleDare - totaleAvere).toFixed(2)})`
    );
  }

  return {
    valida: errori.length === 0,
    errori,
    totaleDare: Math.round(totaleDare * 100) / 100,
    totaleAvere: Math.round(totaleAvere * 100) / 100,
  };
}
