import type { AlertRuleResult } from "../types";

const SEVERITY_ORDER: Record<AlertRuleResult["gravita"], number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
};

/**
 * Returns true if a snooze is currently active (snoozeFinoA is in the future).
 */
export function isAlertSnoozed(snoozeFinoA: Date | null, now: Date): boolean {
  if (!snoozeFinoA) return false;
  return snoozeFinoA.getTime() > now.getTime();
}

/**
 * Filters out alerts whose dedupeKey is in the snoozed set.
 */
export function filterSnoozedAlerts(
  alerts: AlertRuleResult[],
  snoozedDedupeKeys: Set<string>
): AlertRuleResult[] {
  return alerts.filter((alert) => !snoozedDedupeKeys.has(alert.dedupeKey));
}

/**
 * Groups alerts with the same codiceRegola into a summary alert
 * when their count meets or exceeds the groupThreshold (default 3).
 *
 * The summary alert uses the highest severity from the grouped alerts
 * and a combined dedupeKey.
 */
export function shouldGroupAlert(
  alerts: AlertRuleResult[],
  groupThreshold: number = 3
): AlertRuleResult[] {
  if (alerts.length === 0) return [];

  // Group by codiceRegola
  const groups = new Map<string, AlertRuleResult[]>();
  for (const alert of alerts) {
    const existing = groups.get(alert.codiceRegola) ?? [];
    existing.push(alert);
    groups.set(alert.codiceRegola, existing);
  }

  const result: AlertRuleResult[] = [];

  for (const [codiceRegola, groupAlerts] of groups) {
    if (groupAlerts.length >= groupThreshold) {
      // Find highest severity
      const highestGravita = groupAlerts.reduce<AlertRuleResult["gravita"]>(
        (max, alert) =>
          SEVERITY_ORDER[alert.gravita] > SEVERITY_ORDER[max] ? alert.gravita : max,
        "INFO"
      );

      result.push({
        codiceRegola,
        messaggio: `${groupAlerts.length} alert raggruppati per la regola ${codiceRegola}`,
        gravita: highestGravita,
        categoria: groupAlerts[0].categoria,
        dedupeKey: `grouped_${codiceRegola}`,
        datiContesto: {
          conteggio: groupAlerts.length,
          dedupeKeys: groupAlerts.map((a) => a.dedupeKey),
        },
      });
    } else {
      // Below threshold: keep individual alerts
      result.push(...groupAlerts);
    }
  }

  return result;
}
