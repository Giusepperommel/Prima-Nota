/**
 * F24 generation engine.
 * Builds F24 data structure from pending taxes (ritenute, IVA, IRES, IRAP, bollo).
 * Pure function — no DB access.
 */

import {
  type F24Data,
  type RigaF24,
  type GeneraF24Input,
  CODICI_TRIBUTO,
  IMPOSTA_TO_CODICE,
  BOLLO_TO_CODICE,
  scadenzaF24Mensile,
} from "./f24-types";
import { applicaCompensazione } from "./compensazione";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates an F24 data structure from pending taxes for a given period.
 */
export function generaF24(input: GeneraF24Input): F24Data {
  const righe: RigaF24[] = [];

  // 1. Ritenute — grouped by codice tributo
  const ritenGruppo = new Map<string, number>();
  for (const r of input.ritenute) {
    const key = r.codiceTributo;
    ritenGruppo.set(key, (ritenGruppo.get(key) ?? 0) + r.importoRitenuta);
  }

  for (const [codice, importo] of ritenGruppo) {
    const descrizione = codice === "1040"
      ? "Ritenute lavoro autonomo/occasionale"
      : codice === "1038"
        ? "Ritenute su provvigioni"
        : codice === "1041"
          ? "Ritenute diritti d'autore"
          : `Ritenute cod. ${codice}`;

    righe.push({
      sezione: "ERARIO",
      codiceTributo: codice,
      annoRiferimento: input.anno,
      periodoRiferimento: String(input.mese).padStart(2, "0"),
      importoDebito: round2(importo),
      importoCredito: 0,
      descrizione,
    });
  }

  // 2. IVA
  if (input.iva && input.iva.importo !== 0) {
    let codiceTributo: string;
    let periodoRif: string | undefined;

    if (input.iva.tipo === "MENSILE") {
      codiceTributo = CODICI_TRIBUTO.IVA_MENSILE_MAP[input.iva.periodo] ?? `600${input.iva.periodo}`;
      periodoRif = String(input.iva.periodo).padStart(2, "0");
    } else if (input.iva.tipo === "TRIMESTRALE") {
      codiceTributo = CODICI_TRIBUTO.IVA_TRIMESTRALE_MAP[input.iva.periodo] ?? "6099";
      periodoRif = `0${input.iva.periodo}`;
    } else if (input.iva.tipo === "ANNUALE") {
      codiceTributo = CODICI_TRIBUTO.IVA_ANNUALE;
    } else {
      codiceTributo = CODICI_TRIBUTO.IVA_ACCONTO;
    }

    if (input.iva.importo > 0) {
      righe.push({
        sezione: "ERARIO",
        codiceTributo,
        annoRiferimento: input.iva.anno,
        periodoRiferimento: periodoRif,
        importoDebito: round2(input.iva.importo),
        importoCredito: 0,
        descrizione: `IVA ${input.iva.tipo.toLowerCase()} periodo ${input.iva.periodo}/${input.iva.anno}`,
      });
    }
    // If IVA is negative (credit), it won't become an F24 debit row
  }

  // 3. Imposte dirette (IRES, IRAP)
  for (const imp of input.imposte) {
    if (imp.importo <= 0) continue;

    const codice = IMPOSTA_TO_CODICE[imp.tipo];
    const sezione: "ERARIO" | "REGIONI_ENTI_LOCALI" =
      imp.tipo.startsWith("IRAP") ? "REGIONI_ENTI_LOCALI" : "ERARIO";

    const descrizioneMap: Record<string, string> = {
      IRES_SALDO: `IRES saldo ${imp.anno}`,
      IRES_ACCONTO_1: `IRES I acconto ${imp.anno}`,
      IRES_ACCONTO_2: `IRES II acconto ${imp.anno}`,
      IRAP_SALDO: `IRAP saldo ${imp.anno}`,
      IRAP_ACCONTO_1: `IRAP I acconto ${imp.anno}`,
      IRAP_ACCONTO_2: `IRAP II acconto ${imp.anno}`,
    };

    righe.push({
      sezione,
      codiceTributo: codice,
      annoRiferimento: imp.anno,
      importoDebito: round2(imp.importo),
      importoCredito: 0,
      descrizione: descrizioneMap[imp.tipo] ?? imp.tipo,
    });
  }

  // 4. Bolli
  for (const bollo of input.bolli) {
    if (bollo.importo <= 0) continue;

    const codice = BOLLO_TO_CODICE[bollo.tipo];
    const descrizioneMap: Record<string, string> = {
      LIBRO_GIORNALE: "Bollo libro giornale",
      TASSA_CCGG: "Tassa CC.GG. libri sociali",
      BOLLO_FE_Q1: "Bollo fatture elettroniche I trim",
      BOLLO_FE_Q2: "Bollo fatture elettroniche II trim",
      BOLLO_FE_Q3: "Bollo fatture elettroniche III trim",
      BOLLO_FE_Q4: "Bollo fatture elettroniche IV trim",
    };

    righe.push({
      sezione: "ERARIO",
      codiceTributo: codice,
      annoRiferimento: bollo.anno,
      importoDebito: round2(bollo.importo),
      importoCredito: 0,
      descrizione: descrizioneMap[bollo.tipo] ?? bollo.tipo,
    });
  }

  // 5. Apply compensazione if credits available
  const righeConCompensazione = applicaCompensazione(righe, input.creditiCompensazione);

  // 6. Calculate totals
  let totaleDebito = 0;
  let totaleCredito = 0;
  for (const r of righeConCompensazione) {
    totaleDebito += r.importoDebito;
    totaleCredito += r.importoCredito;
  }
  totaleDebito = round2(totaleDebito);
  totaleCredito = round2(totaleCredito);
  const totaleVersamento = round2(totaleDebito - totaleCredito);

  // 7. Determine scadenza
  const dataScadenza = scadenzaF24Mensile(input.anno, input.mese);

  return {
    anno: input.anno,
    mese: input.mese,
    dataScadenza,
    righe: righeConCompensazione,
    totaleDebito,
    totaleCredito,
    totaleVersamento: Math.max(0, totaleVersamento),
  };
}

/**
 * Groups ritenute by codice tributo for a given month/year.
 */
export function raggruppaRitenute(
  ritenute: Array<{
    codiceTributo: string;
    importoRitenuta: number;
    meseCompetenza: number;
    annoCompetenza: number;
  }>,
  mese: number,
  anno: number,
) {
  return ritenute
    .filter((r) => r.meseCompetenza === mese && r.annoCompetenza === anno)
    .reduce(
      (acc, r) => {
        acc[r.codiceTributo] = (acc[r.codiceTributo] ?? 0) + r.importoRitenuta;
        return acc;
      },
      {} as Record<string, number>,
    );
}
