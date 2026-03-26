import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../../types";
import type { AlertRuleConfig, RuleSoglia } from "../types";

/**
 * RICONC_MOVIMENTI_PENDING: count MovimentoBancario where societaId matches,
 * statoRiconciliazione=NON_RICONCILIATO, data < today - sogliaGiorni(7).
 * INFO, WARNING if count > sogliaValore(20).
 */
const riconcMovimentiPending: AlertRuleConfig = {
  codice: "RICONC_MOVIMENTI_PENDING",
  categoria: "RICONCILIAZIONE",
  descrizione: "Movimenti bancari non riconciliati da diversi giorni",
  defaultGravita: "INFO",
  defaultSogliaGiorni: 7,
  defaultSogliaValore: 20,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const valoreLimite = soglia.sogliaValore ?? this.defaultSogliaValore!;
    const cutoff = subDays(ctx.oggi, giorni);

    const count = await prisma.movimentoBancario.count({
      where: {
        societaId: ctx.societaId,
        statoRiconciliazione: "NON_RICONCILIATO",
        data: { lt: cutoff },
      },
    });

    if (count === 0) return [];

    const gravita = count > valoreLimite ? "WARNING" : this.defaultGravita;

    return [
      {
        codiceRegola: this.codice,
        messaggio: `${count} movimenti bancari non riconciliati da oltre ${giorni} giorni`,
        gravita,
        categoria: this.categoria,
        linkAzione: "/riconciliazione",
        datiContesto: {
          conteggio: count,
          giorniVecchiaia: giorni,
        },
        dedupeKey: `${this.codice}_${ctx.societaId}`,
      },
    ];
  },
};

export const riconciliazioneRules: AlertRuleConfig[] = [
  riconcMovimentiPending,
];
