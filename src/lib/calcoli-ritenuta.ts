import { TipoRitenuta } from "@prisma/client";

type InputCalcoloRitenuta = {
  tipo: TipoRitenuta;
  importoLordo: number;
  conStruttura?: boolean;
  rivalsaInps?: number;
  cassaPrevidenza?: number;
};

type RisultatoRitenuta = {
  aliquota: number;
  percentualeImponibile: number;
  baseImponibile: number;
  importoRitenuta: number;
  importoNetto: number;
  codiceTributo: string;
};

const CONFIG: Record<string, { aliquota: number; percentualeImponibile: number; codiceTributo: string }> = {
  LAVORO_AUTONOMO: { aliquota: 20, percentualeImponibile: 100, codiceTributo: "1040" },
  OCCASIONALE: { aliquota: 20, percentualeImponibile: 100, codiceTributo: "1040" },
  PROVVIGIONI: { aliquota: 23, percentualeImponibile: 50, codiceTributo: "1038" },
  DIRITTI_AUTORE: { aliquota: 20, percentualeImponibile: 75, codiceTributo: "1040" },
};

export function calcolaRitenuta(input: InputCalcoloRitenuta): RisultatoRitenuta {
  const config = { ...CONFIG[input.tipo] };
  if (input.tipo === "PROVVIGIONI" && input.conStruttura) {
    config.percentualeImponibile = 20;
  }
  const lordo = input.importoLordo + (input.rivalsaInps ?? 0) + (input.cassaPrevidenza ?? 0);
  const baseImponibile = Math.round((lordo * config.percentualeImponibile / 100) * 100) / 100;
  const importoRitenuta = Math.round((baseImponibile * config.aliquota / 100) * 100) / 100;
  const importoNetto = input.importoLordo - importoRitenuta;
  return {
    aliquota: config.aliquota,
    percentualeImponibile: config.percentualeImponibile,
    baseImponibile,
    importoRitenuta,
    importoNetto,
    codiceTributo: config.codiceTributo,
  };
}

export function getScadenzaVersamento(meseCompetenza: number, annoCompetenza: number): Date {
  const anno = meseCompetenza === 12 ? annoCompetenza + 1 : annoCompetenza;
  const meseSucc = meseCompetenza === 12 ? 0 : meseCompetenza;
  return new Date(anno, meseSucc, 16);
}
