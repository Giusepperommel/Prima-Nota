import { prisma } from "@/lib/prisma";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

async function sumRevenue(societaId: number, year: number): Promise<number> {
  const result = await prisma.operazione.aggregate({
    where: {
      societaId,
      tipoOperazione: "FATTURA_ATTIVA",
      dataOperazione: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      eliminato: false,
      bozza: false,
    },
    _sum: { importoTotale: true },
  });
  return Number(result._sum.importoTotale ?? 0);
}

async function sumCosts(societaId: number, year: number): Promise<number> {
  const result = await prisma.operazione.aggregate({
    where: {
      societaId,
      tipoOperazione: "COSTO",
      dataOperazione: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      eliminato: false,
      bozza: false,
    },
    _sum: { importoTotale: true },
  });
  return Number(result._sum.importoTotale ?? 0);
}

export const confrontoRules: AlertRuleConfig[] = [
  {
    codice: "CONF_RICAVI_CALO",
    categoria: "CONFRONTO",
    descrizione: "Calo ricavi YoY oltre soglia percentuale",
    defaultGravita: "WARNING",
    defaultSogliaValore: 20,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const anno = ctx.oggi.getFullYear();
      const ricaviCorrente = await sumRevenue(ctx.societaId, anno);
      const ricaviPrec = await sumRevenue(ctx.societaId, anno - 1);

      if (ricaviPrec === 0) return [];
      const variazione = ((ricaviCorrente - ricaviPrec) / ricaviPrec) * 100;
      const sogliaPerc = -(soglia.sogliaValore ?? 20);

      if (variazione < sogliaPerc) {
        return [
          {
            codiceRegola: this.codice,
            messaggio: `Ricavi in calo del ${Math.abs(variazione).toFixed(1)}% rispetto all'anno precedente`,
            gravita: variazione < sogliaPerc * 2 ? "CRITICAL" : "WARNING",
            categoria: "CONFRONTO",
            linkAzione: "/bi?periodoTipo=ANNO",
            datiContesto: { ricaviCorrente, ricaviPrec, variazione },
            dedupeKey: `CONF_RICAVI_CALO:${ctx.societaId}:${anno}`,
          },
        ];
      }
      return [];
    },
  },
  {
    codice: "CONF_COSTI_ANOMALI",
    categoria: "CONFRONTO",
    descrizione: "Aumento costi YoY oltre soglia percentuale",
    defaultGravita: "WARNING",
    defaultSogliaValore: 30,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const anno = ctx.oggi.getFullYear();
      const costiCorrente = await sumCosts(ctx.societaId, anno);
      const costiPrec = await sumCosts(ctx.societaId, anno - 1);

      if (costiPrec === 0) return [];
      const variazione = ((costiCorrente - costiPrec) / costiPrec) * 100;
      const sogliaPerc = soglia.sogliaValore ?? 30;

      if (variazione > sogliaPerc) {
        return [
          {
            codiceRegola: this.codice,
            messaggio: `Costi in aumento del ${variazione.toFixed(1)}% rispetto all'anno precedente`,
            gravita: variazione > sogliaPerc * 1.5 ? "CRITICAL" : "WARNING",
            categoria: "CONFRONTO",
            linkAzione: "/bi?periodoTipo=ANNO",
            datiContesto: { costiCorrente, costiPrec, variazione },
            dedupeKey: `CONF_COSTI_ANOMALI:${ctx.societaId}:${anno}`,
          },
        ];
      }
      return [];
    },
  },
];
