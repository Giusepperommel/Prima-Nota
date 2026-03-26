import { addDays, differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../../types";
import type { AlertRuleConfig, RuleSoglia } from "../types";

/**
 * SCAD_IVA_TRIMESTRALE: checks ScadenzaFiscale with tipo in
 * [F24_IVA, ACCONTO_IVA, DICHIARAZIONE_IVA], stato in [NON_INIZIATA, IN_PREPARAZIONE],
 * scadenza within N days. Default: 7 days, WARNING.
 */
const scadIvaTrimestrale: AlertRuleConfig = {
  codice: "SCAD_IVA_TRIMESTRALE",
  categoria: "SCADENZE",
  descrizione: "Scadenza IVA trimestrale in avvicinamento",
  defaultGravita: "WARNING",
  defaultSogliaGiorni: 7,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const limite = addDays(ctx.oggi, giorni);

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: { in: ["F24_IVA", "ACCONTO_IVA", "DICHIARAZIONE_IVA"] },
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { gte: ctx.oggi, lte: limite },
      },
    });

    return scadenze.map((s) => {
      const giorniMancanti = differenceInDays(s.scadenza, ctx.oggi);
      return {
        codiceRegola: this.codice,
        messaggio: `Scadenza IVA (${s.tipo}) tra ${giorniMancanti} giorni (${s.scadenza.toISOString().slice(0, 10)})`,
        gravita: this.defaultGravita,
        categoria: this.categoria,
        linkAzione: `/adempimenti/${s.id}`,
        datiContesto: {
          scadenzaFiscaleId: s.id,
          tipo: s.tipo,
          scadenza: s.scadenza.toISOString(),
          giorniMancanti,
        },
        dedupeKey: `${this.codice}_${s.id}`,
      };
    });
  },
};

/**
 * SCAD_F24: checks F24_IVA, F24_RITENUTE, F24_ACCONTO_IRES, F24_ACCONTO_IRPEF.
 * Default: 3 days, CRITICAL.
 */
const scadF24: AlertRuleConfig = {
  codice: "SCAD_F24",
  categoria: "SCADENZE",
  descrizione: "Scadenza F24 imminente",
  defaultGravita: "CRITICAL",
  defaultSogliaGiorni: 3,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const limite = addDays(ctx.oggi, giorni);

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: { in: ["F24_IVA", "F24_RITENUTE", "F24_ACCONTO_IRES", "F24_ACCONTO_IRPEF"] },
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { gte: ctx.oggi, lte: limite },
      },
    });

    return scadenze.map((s) => {
      const giorniMancanti = differenceInDays(s.scadenza, ctx.oggi);
      return {
        codiceRegola: this.codice,
        messaggio: `Scadenza F24 (${s.tipo}) tra ${giorniMancanti} giorni (${s.scadenza.toISOString().slice(0, 10)})`,
        gravita: this.defaultGravita,
        categoria: this.categoria,
        linkAzione: `/adempimenti/${s.id}`,
        datiContesto: {
          scadenzaFiscaleId: s.id,
          tipo: s.tipo,
          scadenza: s.scadenza.toISOString(),
          giorniMancanti,
        },
        dedupeKey: `${this.codice}_${s.id}`,
      };
    });
  },
};

/**
 * SCAD_CU_GENERAZIONE: checks CU. Default: 14 days, WARNING.
 */
const scadCuGenerazione: AlertRuleConfig = {
  codice: "SCAD_CU_GENERAZIONE",
  categoria: "SCADENZE",
  descrizione: "Scadenza generazione CU in avvicinamento",
  defaultGravita: "WARNING",
  defaultSogliaGiorni: 14,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const limite = addDays(ctx.oggi, giorni);

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: "CU",
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { gte: ctx.oggi, lte: limite },
      },
    });

    return scadenze.map((s) => {
      const giorniMancanti = differenceInDays(s.scadenza, ctx.oggi);
      return {
        codiceRegola: this.codice,
        messaggio: `Scadenza CU tra ${giorniMancanti} giorni (${s.scadenza.toISOString().slice(0, 10)})`,
        gravita: this.defaultGravita,
        categoria: this.categoria,
        linkAzione: `/adempimenti/${s.id}`,
        datiContesto: {
          scadenzaFiscaleId: s.id,
          scadenza: s.scadenza.toISOString(),
          giorniMancanti,
        },
        dedupeKey: `${this.codice}_${s.id}`,
      };
    });
  },
};

export const scadenzeRules: AlertRuleConfig[] = [
  scadIvaTrimestrale,
  scadF24,
  scadCuGenerazione,
];
