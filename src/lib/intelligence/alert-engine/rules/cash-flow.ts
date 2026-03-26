import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../../types";
import type { AlertRuleConfig, RuleSoglia } from "../types";

/**
 * CF_INCASSI_RITARDO: ScadenzaPartitario tipo=CLIENTE, stato in [APERTA,PARZIALE],
 * dataScadenza < today - sogliaGiorni(30). Sum outstanding (importo - importoPagato).
 * WARNING, CRITICAL if total > sogliaValore(10000).
 */
const cfIncassiRitardo: AlertRuleConfig = {
  codice: "CF_INCASSI_RITARDO",
  categoria: "CASH_FLOW",
  descrizione: "Incassi clienti in ritardo significativo",
  defaultGravita: "WARNING",
  defaultSogliaGiorni: 30,
  defaultSogliaValore: 10000,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const valoreLimite = soglia.sogliaValore ?? this.defaultSogliaValore!;
    const cutoff = subDays(ctx.oggi, giorni);

    const scadenze = await prisma.scadenzaPartitario.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: "CLIENTE",
        stato: { in: ["APERTA", "PARZIALE"] },
        dataScadenza: { lt: cutoff },
      },
      include: { anagrafica: { select: { denominazione: true } } },
    });

    if (scadenze.length === 0) return [];

    const totaleInsoluto = scadenze.reduce((sum, s) => {
      return sum + (Number(s.importo) - Number(s.importoPagato));
    }, 0);

    const gravita = totaleInsoluto > valoreLimite ? "CRITICAL" : this.defaultGravita;

    return [
      {
        codiceRegola: this.codice,
        messaggio: `${scadenze.length} incassi clienti scaduti da oltre ${giorni} giorni per un totale di ${totaleInsoluto.toFixed(2)} EUR`,
        gravita,
        categoria: this.categoria,
        linkAzione: "/partitario?tipo=CLIENTE&stato=scaduto",
        datiContesto: {
          conteggio: scadenze.length,
          totaleInsoluto,
          giorniRitardo: giorni,
          dettaglio: scadenze.slice(0, 5).map((s) => ({
            id: s.id,
            anagrafica: s.anagrafica.denominazione,
            importoResiduo: Number(s.importo) - Number(s.importoPagato),
          })),
        },
        dedupeKey: `${this.codice}_${ctx.societaId}`,
      },
    ];
  },
};

/**
 * CF_SALDO_NEGATIVO_PREVISTO: aggregate payables vs receivables next N days (default 15).
 * If net is negative (more to pay than to receive), CRITICAL.
 */
const cfSaldoNegativoPrevisto: AlertRuleConfig = {
  codice: "CF_SALDO_NEGATIVO_PREVISTO",
  categoria: "CASH_FLOW",
  descrizione: "Saldo negativo previsto nel breve periodo",
  defaultGravita: "CRITICAL",
  defaultSogliaGiorni: 15,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const limite = addDays(ctx.oggi, giorni);

    // Receivables (CLIENTE) due in the next N days
    const crediti = await prisma.scadenzaPartitario.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: "CLIENTE",
        stato: { in: ["APERTA", "PARZIALE"] },
        dataScadenza: { gte: ctx.oggi, lte: limite },
      },
    });

    // Payables (FORNITORE) due in the next N days
    const debiti = await prisma.scadenzaPartitario.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: "FORNITORE",
        stato: { in: ["APERTA", "PARZIALE"] },
        dataScadenza: { gte: ctx.oggi, lte: limite },
      },
    });

    const totaleCrediti = crediti.reduce(
      (sum, s) => sum + (Number(s.importo) - Number(s.importoPagato)),
      0
    );
    const totaleDebiti = debiti.reduce(
      (sum, s) => sum + (Number(s.importo) - Number(s.importoPagato)),
      0
    );

    const netFlow = totaleCrediti - totaleDebiti;

    if (netFlow >= 0) return [];

    return [
      {
        codiceRegola: this.codice,
        messaggio: `Saldo previsto negativo nei prossimi ${giorni} giorni: ${netFlow.toFixed(2)} EUR (crediti: ${totaleCrediti.toFixed(2)}, debiti: ${totaleDebiti.toFixed(2)})`,
        gravita: this.defaultGravita,
        categoria: this.categoria,
        linkAzione: "/cash-flow",
        datiContesto: {
          giorni,
          totaleCrediti,
          totaleDebiti,
          netFlow,
        },
        dedupeKey: `${this.codice}_${ctx.societaId}`,
      },
    ];
  },
};

export const cashFlowRules: AlertRuleConfig[] = [
  cfIncassiRitardo,
  cfSaldoNegativoPrevisto,
];
