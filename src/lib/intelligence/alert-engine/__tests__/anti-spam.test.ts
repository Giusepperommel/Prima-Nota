import { describe, it, expect } from "vitest";
import {
  isAlertSnoozed,
  filterSnoozedAlerts,
  shouldGroupAlert,
} from "../anti-spam";
import type { AlertRuleResult } from "../../types";

describe("anti-spam", () => {
  describe("isAlertSnoozed", () => {
    it("returns true when snooze is active (future date)", () => {
      const future = new Date("2026-04-01T00:00:00Z");
      const now = new Date("2026-03-15T00:00:00Z");
      expect(isAlertSnoozed(future, now)).toBe(true);
    });

    it("returns false when snooze has expired (past date)", () => {
      const past = new Date("2026-03-01T00:00:00Z");
      const now = new Date("2026-03-15T00:00:00Z");
      expect(isAlertSnoozed(past, now)).toBe(false);
    });

    it("returns false when snoozeFinoA is null", () => {
      expect(isAlertSnoozed(null, new Date())).toBe(false);
    });

    it("returns false when snooze date equals now", () => {
      const now = new Date("2026-03-15T12:00:00Z");
      expect(isAlertSnoozed(now, now)).toBe(false);
    });
  });

  describe("filterSnoozedAlerts", () => {
    const alerts: AlertRuleResult[] = [
      {
        codiceRegola: "RULE_A",
        messaggio: "Alert A",
        gravita: "WARNING",
        categoria: "SCADENZE",
        dedupeKey: "key_a",
      },
      {
        codiceRegola: "RULE_B",
        messaggio: "Alert B",
        gravita: "CRITICAL",
        categoria: "ANOMALIE_CONTABILI",
        dedupeKey: "key_b",
      },
      {
        codiceRegola: "RULE_C",
        messaggio: "Alert C",
        gravita: "INFO",
        categoria: "CASH_FLOW",
        dedupeKey: "key_c",
      },
    ];

    it("removes alerts with snoozed dedupeKeys", () => {
      const snoozedKeys = new Set(["key_a", "key_c"]);
      const filtered = filterSnoozedAlerts(alerts, snoozedKeys);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].dedupeKey).toBe("key_b");
    });

    it("returns all alerts when no keys are snoozed", () => {
      const filtered = filterSnoozedAlerts(alerts, new Set());
      expect(filtered).toHaveLength(3);
    });

    it("returns empty when all are snoozed", () => {
      const snoozedKeys = new Set(["key_a", "key_b", "key_c"]);
      const filtered = filterSnoozedAlerts(alerts, snoozedKeys);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("shouldGroupAlert", () => {
    it("groups alerts of the same codiceRegola when count >= threshold", () => {
      const alerts: AlertRuleResult[] = [
        {
          codiceRegola: "RULE_X",
          messaggio: "Item 1",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "x_1",
        },
        {
          codiceRegola: "RULE_X",
          messaggio: "Item 2",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "x_2",
        },
        {
          codiceRegola: "RULE_X",
          messaggio: "Item 3",
          gravita: "CRITICAL",
          categoria: "SCADENZE",
          dedupeKey: "x_3",
        },
        {
          codiceRegola: "RULE_Y",
          messaggio: "Other",
          gravita: "INFO",
          categoria: "CASH_FLOW",
          dedupeKey: "y_1",
        },
      ];

      const result = shouldGroupAlert(alerts, 3);
      // 3 RULE_X alerts should be grouped into 1 summary, RULE_Y stays as is
      expect(result).toHaveLength(2);

      const grouped = result.find((r) => r.codiceRegola === "RULE_X");
      expect(grouped).toBeDefined();
      expect(grouped!.messaggio).toContain("3");
      // Should use highest severity from grouped alerts
      expect(grouped!.gravita).toBe("CRITICAL");
    });

    it("does not group when count < threshold", () => {
      const alerts: AlertRuleResult[] = [
        {
          codiceRegola: "RULE_X",
          messaggio: "Item 1",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "x_1",
        },
        {
          codiceRegola: "RULE_X",
          messaggio: "Item 2",
          gravita: "WARNING",
          categoria: "SCADENZE",
          dedupeKey: "x_2",
        },
      ];

      const result = shouldGroupAlert(alerts, 3);
      expect(result).toHaveLength(2);
    });

    it("uses default threshold of 3", () => {
      const alerts: AlertRuleResult[] = Array.from({ length: 3 }, (_, i) => ({
        codiceRegola: "RULE_Z",
        messaggio: `Item ${i + 1}`,
        gravita: "INFO" as const,
        categoria: "RICONCILIAZIONE" as const,
        dedupeKey: `z_${i}`,
      }));

      const result = shouldGroupAlert(alerts);
      expect(result).toHaveLength(1);
      expect(result[0].messaggio).toContain("3");
    });

    it("returns empty array for empty input", () => {
      expect(shouldGroupAlert([])).toEqual([]);
    });
  });
});
