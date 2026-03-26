// src/lib/bi/kpi/fiscali.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: "FISCALE",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function getIvaSaldo(societaId: number, anno: number): Promise<{ debito: number; credito: number }> {
  const liquidazioni = await prisma.liquidazioneIva.findMany({
    where: { societaId, anno },
    select: { saldo: true },
  });
  let debito = 0;
  let credito = 0;
  for (const l of liquidazioni) {
    const saldo = Number(l.saldo);
    if (saldo > 0) debito += saldo;
    else credito += Math.abs(saldo);
  }
  return { debito, credito };
}

export const kpiFiscali: KpiCalculator[] = [
  {
    codice: "DEBITO_IVA", nome: "Debito IVA Cumulato", categoria: "FISCALE", unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const anno = periodo.da.getFullYear();
      const { debito } = await getIvaSaldo(societaId, anno);
      const annoPrec = periodoPrec ? periodoPrec.da.getFullYear() : null;
      const valorePrec = annoPrec ? (await getIvaSaldo(societaId, annoPrec)).debito : null;
      return makeResult("DEBITO_IVA", "Debito IVA Cumulato", debito, valorePrec, "€");
    },
  },
  {
    codice: "CREDITO_IVA", nome: "Credito IVA", categoria: "FISCALE", unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const anno = periodo.da.getFullYear();
      const { credito } = await getIvaSaldo(societaId, anno);
      const annoPrec = periodoPrec ? periodoPrec.da.getFullYear() : null;
      const valorePrec = annoPrec ? (await getIvaSaldo(societaId, annoPrec)).credito : null;
      return makeResult("CREDITO_IVA", "Credito IVA", credito, valorePrec, "€");
    },
  },
];
