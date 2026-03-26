export type { CategoriaAlert, GravitaAlert, StatoAlert, StatoTodo, FonteTodo } from "@prisma/client";

export interface AlertRuleResult {
  codiceRegola: string;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  categoria: "SCADENZE" | "ANOMALIE_CONTABILI" | "CASH_FLOW" | "COMPLIANCE" | "CONFRONTO" | "RICONCILIAZIONE";
  linkAzione?: string;
  datiContesto?: Record<string, unknown>;
  dedupeKey: string;
}

export interface EvaluationContext {
  societaId: number;
  oggi: Date;
}

export type AlertRuleEvaluator = (ctx: EvaluationContext) => Promise<AlertRuleResult[]>;

export interface TodoItem {
  titolo: string;
  descrizione?: string;
  priorita: number;
  linkAzione?: string;
  fonte: "SCADENZA" | "ANOMALIA" | "BOZZA" | "RICONCILIAZIONE" | "FATTURA" | "PORTALE" | "ALTRO";
  dedupeKey: string;
}

export interface TodoGenerationContext {
  societaId: number;
  utenteId: number;
  oggi: Date;
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;
}

export type TodoGenerator = (ctx: TodoGenerationContext) => Promise<TodoItem[]>;
