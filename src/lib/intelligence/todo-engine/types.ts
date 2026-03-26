import type { TodoItem, TodoGenerationContext } from "../types";

export interface TodoGeneratorConfig {
  fonte: TodoItem["fonte"];
  descrizione: string;
  modalita: ("semplice" | "avanzata" | "commercialista")[] | null; // null = all
  generate: (ctx: TodoGenerationContext) => Promise<TodoItem[]>;
}
