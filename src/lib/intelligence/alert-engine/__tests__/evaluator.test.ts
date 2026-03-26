import { describe, it, expect } from "vitest";
import { getAllAlertRules, deduplicateResults } from "../evaluator";
import type { AlertRuleResult } from "../../types";

describe("evaluator", () => {
  describe("getAllAlertRules", () => {
    it("returns at least 8 rules from all modules", () => {
      const rules = getAllAlertRules();
      expect(rules.length).toBeGreaterThanOrEqual(8);
    });

    it("includes rules from all categories", () => {
      const rules = getAllAlertRules();
      const categories = new Set(rules.map((r) => r.categoria));
      expect(categories).toContain("SCADENZE");
      expect(categories).toContain("ANOMALIE_CONTABILI");
      expect(categories).toContain("CASH_FLOW");
      expect(categories).toContain("COMPLIANCE");
      expect(categories).toContain("RICONCILIAZIONE");
    });

    it("all rules have unique codice", () => {
      const rules = getAllAlertRules();
      const codici = rules.map((r) => r.codice);
      expect(new Set(codici).size).toBe(codici.length);
    });
  });

  describe("deduplicateResults", () => {
    it("keeps highest severity when duplicates exist", () => {
      const results: AlertRuleResult[] = [
        {
          codiceRegola: "TEST_RULE",
          messaggio: "Warning version",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "test_1",
        },
        {
          codiceRegola: "TEST_RULE",
          messaggio: "Critical version",
          gravita: "CRITICAL",
          categoria: "SCADENZE",
          dedupeKey: "test_1",
        },
        {
          codiceRegola: "TEST_RULE",
          messaggio: "Info version",
          gravita: "INFO",
          categoria: "SCADENZE",
          dedupeKey: "test_1",
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].gravita).toBe("CRITICAL");
      expect(deduped[0].messaggio).toBe("Critical version");
    });

    it("keeps all results with different dedupeKeys", () => {
      const results: AlertRuleResult[] = [
        {
          codiceRegola: "RULE_A",
          messaggio: "A",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "key_a",
        },
        {
          codiceRegola: "RULE_B",
          messaggio: "B",
          gravita: "INFO",
          categoria: "ANOMALIE_CONTABILI",
          dedupeKey: "key_b",
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped).toHaveLength(2);
    });

    it("returns empty array for empty input", () => {
      expect(deduplicateResults([])).toEqual([]);
    });

    it("prefers CRITICAL over WARNING over INFO", () => {
      const results: AlertRuleResult[] = [
        {
          codiceRegola: "R",
          messaggio: "info",
          gravita: "INFO",
          categoria: "SCADENZE",
          dedupeKey: "dup1",
        },
        {
          codiceRegola: "R",
          messaggio: "warning",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "dup1",
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].gravita).toBe("WARNING");
    });
  });
});
