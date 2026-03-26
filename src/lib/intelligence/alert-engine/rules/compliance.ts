import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../../types";
import type { AlertRuleConfig, RuleSoglia } from "../types";

/**
 * COMPL_FATTURA_NON_INVIATA: FatturaElettronica stato=GENERATA,
 * dataGenerazione < today - sogliaGiorni(5). One per fattura. WARNING.
 */
const complFatturaNonInviata: AlertRuleConfig = {
  codice: "COMPL_FATTURA_NON_INVIATA",
  categoria: "COMPLIANCE",
  descrizione: "Fattura elettronica generata ma non inviata",
  defaultGravita: "WARNING",
  defaultSogliaGiorni: 5,
  async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const giorni = soglia.sogliaGiorni ?? this.defaultSogliaGiorni!;
    const cutoff = subDays(ctx.oggi, giorni);

    const fatture = await prisma.fatturaElettronica.findMany({
      where: {
        societaId: ctx.societaId,
        stato: "GENERATA",
        dataGenerazione: { lt: cutoff },
      },
    });

    return fatture.map((f) => ({
      codiceRegola: this.codice,
      messaggio: `Fattura ${f.numero}/${f.annoRiferimento} generata da oltre ${giorni} giorni ma non ancora inviata`,
      gravita: this.defaultGravita,
      categoria: this.categoria,
      linkAzione: `/fatture-elettroniche/${f.id}`,
      datiContesto: {
        fatturaId: f.id,
        numero: f.numero,
        annoRiferimento: f.annoRiferimento,
        dataGenerazione: f.dataGenerazione.toISOString(),
      },
      dedupeKey: `${this.codice}_${f.id}`,
    }));
  },
};

/**
 * COMPL_LIPE_SCADUTA: ScadenzaFiscale tipo=LIPE,
 * stato in [NON_INIZIATA, IN_PREPARAZIONE], scadenza < today. CRITICAL.
 */
const complLipeScaduta: AlertRuleConfig = {
  codice: "COMPL_LIPE_SCADUTA",
  categoria: "COMPLIANCE",
  descrizione: "LIPE scaduta e non completata",
  defaultGravita: "CRITICAL",
  async evaluate(ctx: EvaluationContext, _soglia: RuleSoglia): Promise<AlertRuleResult[]> {
    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        tipo: "LIPE",
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { lt: ctx.oggi },
      },
    });

    return scadenze.map((s) => ({
      codiceRegola: this.codice,
      messaggio: `LIPE ${s.periodo ? `Q${s.periodo}` : ""} ${s.anno} scaduta il ${s.scadenza.toISOString().slice(0, 10)} e non ancora completata`,
      gravita: this.defaultGravita,
      categoria: this.categoria,
      linkAzione: `/adempimenti/${s.id}`,
      datiContesto: {
        scadenzaFiscaleId: s.id,
        anno: s.anno,
        periodo: s.periodo,
        scadenza: s.scadenza.toISOString(),
      },
      dedupeKey: `${this.codice}_${s.id}`,
    }));
  },
};

export const complianceRules: AlertRuleConfig[] = [
  complFatturaNonInviata,
  complLipeScaduta,
];
