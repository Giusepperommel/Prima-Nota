import { describe, it, expect } from "vitest";
import {
  getAllTodoGenerators,
  deduplicateTodos,
  prioritizeTodos,
} from "../generator";
import type { TodoItem } from "../../types";

describe("todo engine orchestrator", () => {
  describe("getAllTodoGenerators", () => {
    it("returns at least 5 generators", () => {
      const generators = getAllTodoGenerators();
      expect(generators.length).toBeGreaterThanOrEqual(5);
    });

    it("each generator has required fields", () => {
      const generators = getAllTodoGenerators();
      for (const gen of generators) {
        expect(gen.fonte).toBeTruthy();
        expect(gen.descrizione).toBeTruthy();
        expect(typeof gen.generate).toBe("function");
      }
    });

    it("has unique fonte values across generators", () => {
      const generators = getAllTodoGenerators();
      const fonti = generators.map((g) => g.fonte);
      expect(new Set(fonti).size).toBe(fonti.length);
    });
  });

  describe("deduplicateTodos", () => {
    it("removes duplicates keeping higher priority (lower number)", () => {
      const todos: TodoItem[] = [
        {
          titolo: "Todo A",
          priorita: 3,
          fonte: "SCADENZA",
          dedupeKey: "key_1",
        },
        {
          titolo: "Todo A (higher priority)",
          priorita: 1,
          fonte: "SCADENZA",
          dedupeKey: "key_1",
        },
        {
          titolo: "Todo B",
          priorita: 2,
          fonte: "ANOMALIA",
          dedupeKey: "key_2",
        },
      ];

      const result = deduplicateTodos(todos);
      expect(result).toHaveLength(2);

      const key1Item = result.find((t) => t.dedupeKey === "key_1");
      expect(key1Item).toBeDefined();
      expect(key1Item!.priorita).toBe(1);
      expect(key1Item!.titolo).toBe("Todo A (higher priority)");
    });

    it("returns empty array for empty input", () => {
      expect(deduplicateTodos([])).toEqual([]);
    });

    it("keeps all items when no duplicates", () => {
      const todos: TodoItem[] = [
        { titolo: "A", priorita: 1, fonte: "SCADENZA", dedupeKey: "a" },
        { titolo: "B", priorita: 2, fonte: "BOZZA", dedupeKey: "b" },
        { titolo: "C", priorita: 3, fonte: "FATTURA", dedupeKey: "c" },
      ];
      expect(deduplicateTodos(todos)).toHaveLength(3);
    });
  });

  describe("prioritizeTodos", () => {
    it("sorts by priorita ascending", () => {
      const todos: TodoItem[] = [
        { titolo: "Low", priorita: 4, fonte: "BOZZA", dedupeKey: "a" },
        { titolo: "High", priorita: 1, fonte: "SCADENZA", dedupeKey: "b" },
        { titolo: "Medium", priorita: 2, fonte: "ANOMALIA", dedupeKey: "c" },
      ];

      const result = prioritizeTodos(todos);
      expect(result[0].priorita).toBe(1);
      expect(result[1].priorita).toBe(2);
      expect(result[2].priorita).toBe(4);
    });

    it("returns empty array for empty input", () => {
      expect(prioritizeTodos([])).toEqual([]);
    });

    it("preserves order for equal priorities", () => {
      const todos: TodoItem[] = [
        { titolo: "First", priorita: 2, fonte: "SCADENZA", dedupeKey: "a" },
        { titolo: "Second", priorita: 2, fonte: "BOZZA", dedupeKey: "b" },
      ];

      const result = prioritizeTodos(todos);
      expect(result[0].titolo).toBe("First");
      expect(result[1].titolo).toBe("Second");
    });
  });
});
