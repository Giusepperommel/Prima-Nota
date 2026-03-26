import type { AlertRuleResult, EvaluationContext } from "../types";

export interface AlertRuleConfig {
  codice: string;
  categoria: AlertRuleResult["categoria"];
  descrizione: string;
  defaultGravita: AlertRuleResult["gravita"];
  defaultSogliaGiorni?: number;
  defaultSogliaValore?: number;
  evaluate: (ctx: EvaluationContext, soglia: RuleSoglia) => Promise<AlertRuleResult[]>;
}

export interface RuleSoglia {
  sogliaGiorni: number | null;
  sogliaValore: number | null;
}
