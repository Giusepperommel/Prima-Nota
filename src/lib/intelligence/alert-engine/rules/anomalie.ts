import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../../types";
import type { AlertRuleConfig, RuleSoglia } from "../types";

/**
 * ANOM_APERTE_ACCUMULO: count Anomalia where stato=APERTA.
 * If >= sogliaValore (default 5), generate alert. WARNING, escalate CRITICAL at 2x.
 */
const anomAperteAccumulo: AlertRuleConfig = {
  codice: "ANOM_APERTE_ACCUMULO",
  categoria: "ANOMALIE_CONTABILI",
  descrizione: "Accumulo di anomalie aperte non risolte",
  defaultGravita: "WARNING",
  defaultSogliaValore: 5,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const threshold = soglia.sogliaValore ?? this.defaultSogliaValore!;

    const count = await prisma.anomalia.count({
      where: {
        societaId: ctx.societaId,
        stato: "APERTA",
      },
    });

    if (count < threshold) return [];

    const gravita = count >= threshold * 2 ? "CRITICAL" : this.defaultGravita;

    return [
      {
        codiceRegola: this.codice,
        messaggio: `Ci sono ${count} anomalie aperte non risolte (soglia: ${threshold})`,
        gravita,
        categoria: this.categoria,
        linkAzione: "/anomalie",
        datiContesto: {
          conteggio: count,
          soglia: threshold,
        },
        dedupeKey: `${this.codice}_${ctx.societaId}`,
      },
    ];
  },
};

/**
 * ANOM_CRITICA_NUOVA: find Anomalia where stato=APERTA, priorita=CRITICA,
 * createdAt >= oggi-sogliaGiorni (default 1). One alert per anomaly. CRITICAL.
 */
const anomCriticaNuova: AlertRuleConfig = {
  codice: "ANOM_CRITICA_NUOVA",
  categoria: "ANOMALIE_CONTABILI",
  descrizione: "Nuova anomalia critica rilevata",
  defaultGravita: "CRITICAL",
  defaultSogliaGiorni: 1,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const since = subDays(ctx.oggi, giorni);

    const anomalie = await prisma.anomalia.findMany({
      where: {
        societaId: ctx.societaId,
        stato: "APERTA",
        priorita: "CRITICA",
        createdAt: { gte: since },
      },
    });

    return anomalie.map((a) => ({
      codiceRegola: this.codice,
      messaggio: `Anomalia critica: ${a.titolo}`,
      gravita: this.defaultGravita,
      categoria: this.categoria,
      linkAzione: `/anomalie/${a.id}`,
      datiContesto: {
        anomaliaId: a.id,
        tipo: a.tipo,
        titolo: a.titolo,
      },
      dedupeKey: `${this.codice}_${a.id}`,
    }));
  },
};

export const anomalieRules: AlertRuleConfig[] = [
  anomAperteAccumulo,
  anomCriticaNuova,
];
