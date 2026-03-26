import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../types";
import type { TodoGeneratorConfig } from "./types";
import { scadenzeTodoGenerator } from "./generators/scadenze";
import { anomalieTodoGenerator } from "./generators/anomalie";
import { bozzeTodoGenerator } from "./generators/bozze";
import { riconciliazioneTodoGenerator } from "./generators/riconciliazione";
import { fattureTodoGenerator } from "./generators/fatture";

/**
 * Returns all registered todo generators.
 */
export function getAllTodoGenerators(): TodoGeneratorConfig[] {
  return [
    scadenzeTodoGenerator,
    anomalieTodoGenerator,
    bozzeTodoGenerator,
    riconciliazioneTodoGenerator,
    fattureTodoGenerator,
  ];
}

/**
 * Deduplicates todos by dedupeKey, keeping the item with the highest priority
 * (lowest number).
 */
export function deduplicateTodos(todos: TodoItem[]): TodoItem[] {
  const map = new Map<string, TodoItem>();

  for (const todo of todos) {
    const existing = map.get(todo.dedupeKey);
    if (!existing || todo.priorita < existing.priorita) {
      map.set(todo.dedupeKey, todo);
    }
  }

  return Array.from(map.values());
}

/**
 * Sorts todos by priorita ascending (1 = highest priority).
 * Stable sort preserves insertion order for equal priorities.
 */
export function prioritizeTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((a, b) => a.priorita - b.priorita);
}

/**
 * Determines whether a generator should run based on the user's modalita flags.
 */
function shouldRunGenerator(
  gen: TodoGeneratorConfig,
  ctx: TodoGenerationContext
): boolean {
  // null = runs for all modes
  if (gen.modalita === null) return true;

  if (gen.modalita.includes("avanzata") && ctx.modalitaAvanzata) return true;
  if (gen.modalita.includes("commercialista") && ctx.modalitaCommercialista)
    return true;
  if (
    gen.modalita.includes("semplice") &&
    !ctx.modalitaAvanzata &&
    !ctx.modalitaCommercialista
  )
    return true;

  return false;
}

/**
 * Generates todos for a user: loads user data, builds context, runs matching
 * generators, deduplicates, and prioritizes results.
 */
export async function generateTodosForUser(
  societaId: number,
  utenteId: number
): Promise<TodoItem[]> {
  const utente = await prisma.utente.findUniqueOrThrow({
    where: { id: utenteId },
    select: { modalitaAvanzata: true, modalitaCommercialista: true },
  });

  const ctx: TodoGenerationContext = {
    societaId,
    utenteId,
    oggi: startOfDay(new Date()),
    modalitaAvanzata: utente.modalitaAvanzata,
    modalitaCommercialista: utente.modalitaCommercialista,
  };

  const generators = getAllTodoGenerators().filter((gen) =>
    shouldRunGenerator(gen, ctx)
  );

  const results = await Promise.all(generators.map((gen) => gen.generate(ctx)));
  const allTodos = results.flat();

  return prioritizeTodos(deduplicateTodos(allTodos));
}

/**
 * Generates todos and persists them as TodoGenerato records.
 * Skips items that already exist for today (matching titolo + fonte + data).
 */
export async function persistTodosForUser(
  societaId: number,
  utenteId: number
): Promise<void> {
  const todos = await generateTodosForUser(societaId, utenteId);
  const oggi = startOfDay(new Date());

  // Find existing todos for today to avoid duplicates
  const existing = await prisma.todoGenerato.findMany({
    where: {
      societaId,
      utenteId,
      data: oggi,
    },
    select: { titolo: true, fonte: true },
  });

  const existingKeys = new Set(
    existing.map((e) => `${e.fonte}::${e.titolo}`)
  );

  const newTodos = todos.filter(
    (t) => !existingKeys.has(`${t.fonte}::${t.titolo}`)
  );

  if (newTodos.length === 0) return;

  await prisma.todoGenerato.createMany({
    data: newTodos.map((t) => ({
      societaId,
      utenteId,
      data: oggi,
      titolo: t.titolo,
      descrizione: t.descrizione ?? null,
      priorita: t.priorita,
      linkAzione: t.linkAzione ?? null,
      fonte: t.fonte,
    })),
  });
}
