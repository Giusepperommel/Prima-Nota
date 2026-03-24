/**
 * Stato Patrimoniale Builder — art. 2424 c.c.
 *
 * Prende i saldi dei conti patrimoniali e li organizza nella struttura
 * gerarchica dello Stato Patrimoniale civilistico.
 */

import type {
  SaldoConto,
  StatoPatrimoniale,
  SezioneSP,
  ClasseSP,
  SottoclasseSP,
  VoceBilancio,
  ContoAggregato,
  VoceParsed,
} from "./types";

// ─── Schema art. 2424 ───

const ATTIVO_SCHEMA: { codice: string; descrizione: string; sottoclassi?: { codice: string; descrizione: string }[] }[] = [
  { codice: "A", descrizione: "Crediti verso soci per versamenti ancora dovuti" },
  {
    codice: "B", descrizione: "Immobilizzazioni",
    sottoclassi: [
      { codice: "I", descrizione: "Immobilizzazioni immateriali" },
      { codice: "II", descrizione: "Immobilizzazioni materiali" },
      { codice: "III", descrizione: "Immobilizzazioni finanziarie" },
    ],
  },
  {
    codice: "C", descrizione: "Attivo circolante",
    sottoclassi: [
      { codice: "I", descrizione: "Rimanenze" },
      { codice: "II", descrizione: "Crediti" },
      { codice: "III", descrizione: "Attivita finanziarie che non costituiscono immobilizzazioni" },
      { codice: "IV", descrizione: "Disponibilita liquide" },
    ],
  },
  { codice: "D", descrizione: "Ratei e risconti attivi" },
];

const PASSIVO_SCHEMA: { codice: string; descrizione: string; sottoclassi?: { codice: string; descrizione: string }[] }[] = [
  {
    codice: "A", descrizione: "Patrimonio netto",
    sottoclassi: [
      { codice: "I", descrizione: "Capitale" },
      { codice: "II", descrizione: "Riserva da sovrapprezzo delle azioni" },
      { codice: "III", descrizione: "Riserve di rivalutazione" },
      { codice: "IV", descrizione: "Riserva legale" },
      { codice: "V", descrizione: "Riserve statutarie" },
      { codice: "VI", descrizione: "Altre riserve" },
      { codice: "VII", descrizione: "Riserva per operazioni di copertura attesa dei flussi finanziari" },
      { codice: "VIII", descrizione: "Utili (perdite) portati a nuovo" },
      { codice: "IX", descrizione: "Utile (perdita) dell'esercizio" },
    ],
  },
  {
    codice: "B", descrizione: "Fondi per rischi e oneri",
    sottoclassi: [
      { codice: "1", descrizione: "Per trattamento di quiescenza e obblighi simili" },
      { codice: "2", descrizione: "Per imposte, anche differite" },
      { codice: "3", descrizione: "Strumenti finanziari derivati passivi" },
      { codice: "4", descrizione: "Altri" },
    ],
  },
  { codice: "C", descrizione: "Trattamento di fine rapporto di lavoro subordinato" },
  {
    codice: "D", descrizione: "Debiti",
    sottoclassi: [
      { codice: "1", descrizione: "Obbligazioni" },
      { codice: "2", descrizione: "Obbligazioni convertibili" },
      { codice: "3", descrizione: "Debiti verso soci per finanziamenti" },
      { codice: "4", descrizione: "Debiti verso banche" },
      { codice: "5", descrizione: "Debiti verso altri finanziatori" },
      { codice: "6", descrizione: "Acconti" },
      { codice: "7", descrizione: "Debiti verso fornitori" },
      { codice: "8", descrizione: "Debiti rappresentati da titoli di credito" },
      { codice: "9", descrizione: "Debiti verso imprese controllate" },
      { codice: "10", descrizione: "Debiti verso imprese collegate" },
      { codice: "11", descrizione: "Debiti verso controllanti" },
      { codice: "11-bis", descrizione: "Debiti verso imprese sottoposte al controllo delle controllanti" },
      { codice: "12", descrizione: "Debiti tributari" },
      { codice: "13", descrizione: "Debiti verso istituti di previdenza e di sicurezza sociale" },
      { codice: "14", descrizione: "Altri debiti" },
    ],
  },
  { codice: "E", descrizione: "Ratei e risconti passivi" },
];

// ─── Parsing voce SP ───

/**
 * Parsa una voce SP come "C.IV.1" o "D" o "A.IX" o "D.12" o "B.I.3"
 */
export function parseVoceSp(voce: string): VoceParsed {
  const parts = voce.split(".");
  const result: VoceParsed = { classe: parts[0] };

  if (parts.length >= 2) {
    result.sottoclasse = parts[1];
  }
  if (parts.length >= 3) {
    result.voce = parts[2];
  }
  if (parts.length >= 4) {
    result.sottovoce = parts[3];
  }

  return result;
}

/**
 * Determina la sezione (ATTIVO/PASSIVO) di un conto in base al suo tipo.
 */
function getSezione(tipo: string): "ATTIVO" | "PASSIVO" {
  if (tipo === "PATRIMONIALE_ATTIVO") return "ATTIVO";
  return "PASSIVO";
}

/**
 * Calcola il saldo effettivo per la collocazione in bilancio.
 *
 * Per conti ATTIVI:
 * - naturaSaldo DARE → saldo = dare - avere (positivo se attivo)
 * - naturaSaldo AVERE (fondi amm.to) → saldo = -(avere - dare) → negativo = rettifica
 *
 * Per conti PASSIVI:
 * - naturaSaldo AVERE → saldo = avere - dare (positivo se passivo)
 * - naturaSaldo DARE → saldo = -(dare - avere) → negativo = rettifica
 */
function calcolaSaldoPerBilancio(conto: SaldoConto): number {
  const isAttivo = conto.tipo === "PATRIMONIALE_ATTIVO";

  if (isAttivo) {
    // In attivo: conti normali (DARE) sono positivi, fondi amm.to (AVERE) sono negativi
    if (conto.naturaSaldo === "AVERE") {
      return -(conto.totaleAvere - conto.totaleDare);
    }
    return conto.totaleDare - conto.totaleAvere;
  } else {
    // In passivo: conti normali (AVERE) sono positivi
    if (conto.naturaSaldo === "AVERE") {
      return conto.totaleAvere - conto.totaleDare;
    }
    return -(conto.totaleDare - conto.totaleAvere);
  }
}

// ─── Builder ───

export function buildStatoPatrimoniale(conti: SaldoConto[]): StatoPatrimoniale {
  // Filtra solo conti patrimoniali con voceSp
  const contiSp = conti.filter(
    c => c.voceSp && (c.tipo === "PATRIMONIALE_ATTIVO" || c.tipo === "PATRIMONIALE_PASSIVO")
  );

  // Separa attivo e passivo
  const contiAttivo = contiSp.filter(c => getSezione(c.tipo) === "ATTIVO");
  const contiPassivo = contiSp.filter(c => getSezione(c.tipo) === "PASSIVO");

  const attivo = buildSezione("ATTIVO", ATTIVO_SCHEMA, contiAttivo);
  const passivo = buildSezione("PASSIVO", PASSIVO_SCHEMA, contiPassivo);

  return { attivo, passivo };
}

function buildSezione(
  nome: "ATTIVO" | "PASSIVO",
  schema: typeof ATTIVO_SCHEMA,
  conti: SaldoConto[]
): SezioneSP {
  const classi = schema.map(classeSchema => {
    const contiClasse = conti.filter(c => {
      const parsed = parseVoceSp(c.voceSp!);
      return parsed.classe === classeSchema.codice;
    });

    return buildClasse(classeSchema, contiClasse);
  });

  const totale = round2(classi.reduce((sum, c) => sum + c.importo, 0));

  return { nome, classi, totale };
}

function buildClasse(
  schema: typeof ATTIVO_SCHEMA[0],
  conti: SaldoConto[]
): ClasseSP {
  const sottoclassi: SottoclasseSP[] = [];
  const vociDirette: VoceBilancio[] = [];

  if (schema.sottoclassi) {
    for (const scSchema of schema.sottoclassi) {
      const contiSc = conti.filter(c => {
        const parsed = parseVoceSp(c.voceSp!);
        return parsed.sottoclasse === scSchema.codice;
      });

      const sottoclasse = buildSottoclasse(scSchema, contiSc);
      sottoclassi.push(sottoclasse);
    }
  }

  // Conti senza sottoclasse (es. voceSp="D" per ratei/risconti)
  const contiDiretti = conti.filter(c => {
    const parsed = parseVoceSp(c.voceSp!);
    return !parsed.sottoclasse;
  });

  if (contiDiretti.length > 0) {
    const aggregati = aggregaConti(contiDiretti);
    const importoDir = round2(aggregati.reduce((s, a) => s + a.saldo, 0));
    vociDirette.push({
      codice: "",
      descrizione: schema.descrizione,
      importo: importoDir,
      conti: aggregati,
    });
  }

  const importoSottoclassi = sottoclassi.reduce((sum, sc) => sum + sc.importo, 0);
  const importoVociDirette = vociDirette.reduce((sum, v) => sum + v.importo, 0);
  const importo = round2(importoSottoclassi + importoVociDirette);

  return {
    codice: schema.codice,
    descrizione: schema.descrizione,
    importo,
    sottoclassi,
    vociDirette,
  };
}

function buildSottoclasse(
  schema: { codice: string; descrizione: string },
  conti: SaldoConto[]
): SottoclasseSP {
  // Raggruppa per voce (numero)
  const vociMap = new Map<string, SaldoConto[]>();
  const contiSenzaVoce: SaldoConto[] = [];

  for (const conto of conti) {
    const parsed = parseVoceSp(conto.voceSp!);
    if (parsed.voce) {
      const key = parsed.voce;
      if (!vociMap.has(key)) vociMap.set(key, []);
      vociMap.get(key)!.push(conto);
    } else {
      contiSenzaVoce.push(conto);
    }
  }

  const voci: VoceBilancio[] = [];

  for (const [voceCode, contiVoce] of vociMap) {
    const aggregati = aggregaConti(contiVoce);
    const importo = round2(aggregati.reduce((s, a) => s + a.saldo, 0));
    voci.push({
      codice: voceCode,
      descrizione: `Voce ${schema.codice}.${voceCode}`,
      importo,
      conti: aggregati,
    });
  }

  // Conti collegati alla sottoclasse ma senza voce specifica
  if (contiSenzaVoce.length > 0) {
    const aggregati = aggregaConti(contiSenzaVoce);
    const importo = round2(aggregati.reduce((s, a) => s + a.saldo, 0));
    voci.push({
      codice: "",
      descrizione: `${schema.descrizione} (altri)`,
      importo,
      conti: aggregati,
    });
  }

  // Ordina voci per codice
  voci.sort((a, b) => {
    if (!a.codice) return 1;
    if (!b.codice) return -1;
    return a.codice.localeCompare(b.codice, undefined, { numeric: true });
  });

  const importo = round2(voci.reduce((s, v) => s + v.importo, 0));

  return {
    codice: schema.codice,
    descrizione: schema.descrizione,
    importo,
    voci,
  };
}

function aggregaConti(conti: SaldoConto[]): ContoAggregato[] {
  return conti.map(c => ({
    contoId: c.contoId,
    codice: c.codice,
    descrizione: c.descrizione,
    saldo: round2(calcolaSaldoPerBilancio(c)),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
