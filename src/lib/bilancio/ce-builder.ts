/**
 * Conto Economico Builder — art. 2425 c.c.
 *
 * Prende i saldi dei conti economici e li organizza nella struttura
 * scalare del Conto Economico civilistico.
 */

import type {
  SaldoConto,
  ContoEconomico,
  SezioneCE,
  VoceCE,
  SottovoceCE,
  ContoAggregato,
  VoceParsed,
} from "./types";

// ─── Schema art. 2425 ───

type VoceSchema = {
  codice: string;
  descrizione: string;
  sottovoci?: { codice: string; descrizione: string }[];
};

type SezioneSchema = {
  codice: string;
  descrizione: string;
  segno: "RICAVO" | "COSTO";  // per determinare il segno nel CE
  voci: VoceSchema[];
};

const CE_SCHEMA: SezioneSchema[] = [
  {
    codice: "A",
    descrizione: "Valore della produzione",
    segno: "RICAVO",
    voci: [
      { codice: "1", descrizione: "Ricavi delle vendite e delle prestazioni" },
      { codice: "2", descrizione: "Variazioni delle rimanenze di prodotti in corso di lavorazione, semilavorati e finiti" },
      { codice: "3", descrizione: "Variazioni dei lavori in corso su ordinazione" },
      { codice: "4", descrizione: "Incrementi di immobilizzazioni per lavori interni" },
      { codice: "5", descrizione: "Altri ricavi e proventi" },
    ],
  },
  {
    codice: "B",
    descrizione: "Costi della produzione",
    segno: "COSTO",
    voci: [
      { codice: "6", descrizione: "Per materie prime, sussidiarie, di consumo e di merci" },
      { codice: "7", descrizione: "Per servizi" },
      { codice: "8", descrizione: "Per godimento di beni di terzi" },
      {
        codice: "9", descrizione: "Per il personale",
        sottovoci: [
          { codice: "a", descrizione: "Salari e stipendi" },
          { codice: "b", descrizione: "Oneri sociali" },
          { codice: "c", descrizione: "Trattamento di fine rapporto" },
          { codice: "d", descrizione: "Trattamento di quiescenza e simili" },
          { codice: "e", descrizione: "Altri costi" },
        ],
      },
      {
        codice: "10", descrizione: "Ammortamenti e svalutazioni",
        sottovoci: [
          { codice: "a", descrizione: "Ammortamento delle immobilizzazioni immateriali" },
          { codice: "b", descrizione: "Ammortamento delle immobilizzazioni materiali" },
          { codice: "c", descrizione: "Altre svalutazioni delle immobilizzazioni" },
          { codice: "d", descrizione: "Svalutazioni dei crediti compresi nell'attivo circolante e delle disponibilita liquide" },
        ],
      },
      { codice: "11", descrizione: "Variazioni delle rimanenze di materie prime, sussidiarie, di consumo e merci" },
      { codice: "12", descrizione: "Accantonamenti per rischi" },
      { codice: "13", descrizione: "Altri accantonamenti" },
      { codice: "14", descrizione: "Oneri diversi di gestione" },
    ],
  },
  {
    codice: "C",
    descrizione: "Proventi e oneri finanziari",
    segno: "RICAVO", // netto puo essere positivo o negativo
    voci: [
      { codice: "15", descrizione: "Proventi da partecipazioni" },
      {
        codice: "16", descrizione: "Altri proventi finanziari",
        sottovoci: [
          { codice: "a", descrizione: "Da crediti iscritti nelle immobilizzazioni" },
          { codice: "b", descrizione: "Da titoli iscritti nelle immobilizzazioni che non costituiscono partecipazioni" },
          { codice: "c", descrizione: "Da titoli iscritti nell'attivo circolante che non costituiscono partecipazioni" },
          { codice: "d", descrizione: "Proventi diversi dai precedenti" },
        ],
      },
      { codice: "17", descrizione: "Interessi e altri oneri finanziari" },
      { codice: "17-bis", descrizione: "Utili e perdite su cambi" },
    ],
  },
  {
    codice: "D",
    descrizione: "Rettifiche di valore di attivita e passivita finanziarie",
    segno: "RICAVO",
    voci: [
      {
        codice: "18", descrizione: "Rivalutazioni",
        sottovoci: [
          { codice: "a", descrizione: "Di partecipazioni" },
          { codice: "b", descrizione: "Di immobilizzazioni finanziarie che non costituiscono partecipazioni" },
          { codice: "c", descrizione: "Di titoli iscritti nell'attivo circolante che non costituiscono partecipazioni" },
          { codice: "d", descrizione: "Di strumenti finanziari derivati" },
        ],
      },
      {
        codice: "19", descrizione: "Svalutazioni",
        sottovoci: [
          { codice: "a", descrizione: "Di partecipazioni" },
          { codice: "b", descrizione: "Di immobilizzazioni finanziarie che non costituiscono partecipazioni" },
          { codice: "c", descrizione: "Di titoli iscritti nell'attivo circolante che non costituiscono partecipazioni" },
          { codice: "d", descrizione: "Di strumenti finanziari derivati" },
        ],
      },
    ],
  },
];

// ─── Parsing voce CE ───

/**
 * Parsa una voce CE come "B.7" o "B.10.a" o "C.16.d" o "20" o "A.1"
 */
export function parseVoceCe(voce: string): { sezione: string; voce?: string; sottovoce?: string } {
  // Voci speciali: "20" e "21" (imposte e utile)
  if (voce === "20" || voce === "21") {
    return { sezione: voce };
  }

  const parts = voce.split(".");
  const result: { sezione: string; voce?: string; sottovoce?: string } = {
    sezione: parts[0],
  };

  if (parts.length >= 2) {
    result.voce = parts[1];
  }
  if (parts.length >= 3) {
    result.sottovoce = parts[2];
  }

  return result;
}

/**
 * Calcola l'importo di un conto economico.
 * I ricavi (naturaSaldo AVERE) hanno importo positivo quando avere > dare.
 * I costi (naturaSaldo DARE) hanno importo positivo quando dare > avere.
 */
function calcolaImportoCE(conto: SaldoConto): number {
  if (conto.naturaSaldo === "AVERE") {
    return conto.totaleAvere - conto.totaleDare;
  }
  return conto.totaleDare - conto.totaleAvere;
}

// ─── Builder ───

export function buildContoEconomico(conti: SaldoConto[]): ContoEconomico {
  // Filtra solo conti economici con voceCe
  const contiCe = conti.filter(
    c => c.voceCe && (c.tipo === "ECONOMICO_COSTO" || c.tipo === "ECONOMICO_RICAVO")
  );

  // Separa conti per imposte (voce 20)
  const contiImposte = contiCe.filter(c => parseVoceCe(c.voceCe!).sezione === "20");
  const contiNormali = contiCe.filter(c => {
    const parsed = parseVoceCe(c.voceCe!);
    return parsed.sezione !== "20" && parsed.sezione !== "21";
  });

  // Costruisci le sezioni A, B, C, D
  const sezioni = CE_SCHEMA.map(sezioneSchema => {
    const contiSezione = contiNormali.filter(c => {
      const parsed = parseVoceCe(c.voceCe!);
      return parsed.sezione === sezioneSchema.codice;
    });

    return buildSezioneCE(sezioneSchema, contiSezione);
  });

  const totaleA = sezioni.find(s => s.codice === "A")?.importo || 0;
  const totaleB = sezioni.find(s => s.codice === "B")?.importo || 0;
  const totaleC = sezioni.find(s => s.codice === "C")?.importo || 0;
  const totaleD = sezioni.find(s => s.codice === "D")?.importo || 0;

  const differenzaAB = round2(totaleA - totaleB);

  // Imposte
  const imposte = round2(
    contiImposte.reduce((sum, c) => sum + calcolaImportoCE(c), 0)
  );

  const risultatoPrimaImposte = round2(differenzaAB + totaleC + totaleD);
  const utilePerditaEsercizio = round2(risultatoPrimaImposte - imposte);

  return {
    sezioni,
    differenzaAB,
    totaleC,
    totaleD,
    risultatoPrimaImposte,
    imposte,
    utilePerditaEsercizio,
  };
}

function buildSezioneCE(schema: SezioneSchema, conti: SaldoConto[]): SezioneCE {
  const voci = schema.voci.map(voceSchema => {
    const contiVoce = conti.filter(c => {
      const parsed = parseVoceCe(c.voceCe!);
      return parsed.voce === voceSchema.codice;
    });

    return buildVoceCE(voceSchema, contiVoce);
  });

  const importo = round2(voci.reduce((sum, v) => sum + v.importo, 0));

  return {
    codice: schema.codice,
    descrizione: schema.descrizione,
    importo,
    voci,
  };
}

function buildVoceCE(schema: VoceSchema, conti: SaldoConto[]): VoceCE {
  const sottovoci: SottovoceCE[] = [];

  if (schema.sottovoci) {
    for (const svSchema of schema.sottovoci) {
      const contiSv = conti.filter(c => {
        const parsed = parseVoceCe(c.voceCe!);
        return parsed.sottovoce === svSchema.codice;
      });

      const aggregati = contiSv.map(c => ({
        contoId: c.contoId,
        codice: c.codice,
        descrizione: c.descrizione,
        saldo: round2(calcolaImportoCE(c)),
      }));

      const importo = round2(aggregati.reduce((s, a) => s + a.saldo, 0));

      sottovoci.push({
        codice: svSchema.codice,
        descrizione: svSchema.descrizione,
        importo,
        conti: aggregati,
      });
    }
  }

  // Conti senza sottovoce (collegati direttamente alla voce)
  const contiDiretti = conti.filter(c => {
    const parsed = parseVoceCe(c.voceCe!);
    return !parsed.sottovoce;
  });

  const aggregatiDiretti: ContoAggregato[] = contiDiretti.map(c => ({
    contoId: c.contoId,
    codice: c.codice,
    descrizione: c.descrizione,
    saldo: round2(calcolaImportoCE(c)),
  }));

  const importoSottovoci = sottovoci.reduce((s, sv) => s + sv.importo, 0);
  const importoDiretti = aggregatiDiretti.reduce((s, a) => s + a.saldo, 0);
  const importo = round2(importoSottovoci + importoDiretti);

  return {
    codice: schema.codice,
    descrizione: schema.descrizione,
    importo,
    sottovoci,
    conti: aggregatiDiretti.length > 0 ? aggregatiDiretti : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
