import { prisma } from "@/lib/prisma";
import type { AlertRuleResult, EvaluationContext } from "../types";
import type { AlertRuleConfig, RuleSoglia } from "./types";
import { scadenzeRules } from "./rules/scadenze";
import { anomalieRules } from "./rules/anomalie";
import { cashFlowRules } from "./rules/cash-flow";
import { complianceRules } from "./rules/compliance";
import { riconciliazioneRules } from "./rules/riconciliazione";

const SEVERITY_ORDER: Record<AlertRuleResult["gravita"], number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
};

/**
 * Returns flat array of all alert rules from all modules.
 */
export function getAllAlertRules(): AlertRuleConfig[] {
  return [
    ...scadenzeRules,
    ...anomalieRules,
    ...cashFlowRules,
    ...complianceRules,
    ...riconciliazioneRules,
  ];
}

/**
 * Deduplicates alert results by dedupeKey, keeping the highest severity.
 * CRITICAL > WARNING > INFO
 */
export function deduplicateResults(results: AlertRuleResult[]): AlertRuleResult[] {
  if (results.length === 0) return [];

  const map = new Map<string, AlertRuleResult>();

  for (const result of results) {
    const existing = map.get(result.dedupeKey);
    if (!existing || SEVERITY_ORDER[result.gravita] > SEVERITY_ORDER[existing.gravita]) {
      map.set(result.dedupeKey, result);
    }
  }

  return Array.from(map.values());
}

/**
 * Loads DB rule configs for a societa (or global), runs each rule
 * with merged thresholds, and deduplicates results.
 */
export async function evaluateAllRules(ctx: EvaluationContext): Promise<AlertRuleResult[]> {
  const allRules = getAllAlertRules();

  // Load DB rule configs for this societa (or global ones with societaId=null)
  const dbConfigs = await prisma.regolaAlert.findMany({
    where: {
      OR: [{ societaId: ctx.societaId }, { societaId: null }],
      attiva: true,
    },
  });

  // Index by codice, prefer societa-specific over global
  const configMap = new Map<string, { sogliaGiorni: number | null; sogliaValore: number | null }>();
  for (const cfg of dbConfigs) {
    const existing = configMap.get(cfg.codice);
    // If there's already a societa-specific config, skip the global one
    if (existing && cfg.societaId === null) continue;
    configMap.set(cfg.codice, {
      sogliaGiorni: cfg.sogliaGiorni,
      sogliaValore: cfg.sogliaValore,
    });
  }

  const allResults: AlertRuleResult[] = [];

  for (const rule of allRules) {
    const dbSoglia = configMap.get(rule.codice);
    const soglia: RuleSoglia = {
      sogliaGiorni: dbSoglia?.sogliaGiorni ?? null,
      sogliaValore: dbSoglia?.sogliaValore ?? null,
    };

    try {
      const results = await rule.evaluate(ctx, soglia);
      allResults.push(...results);
    } catch (error) {
      console.error(`[AlertEngine] Error evaluating rule ${rule.codice}:`, error);
    }
  }

  return deduplicateResults(allResults);
}

/**
 * Evaluates all rules, finds target users via UtenteAzienda, and creates
 * AlertGenerato records. Skips if an existing non-resolved alert with the
 * same dedupeKey exists (stored in datiContesto JSON).
 */
export async function generateAlerts(societaId: number): Promise<number> {
  const ctx: EvaluationContext = { societaId, oggi: new Date() };
  const results = await evaluateAllRules(ctx);

  if (results.length === 0) return 0;

  // Find target users for this societa
  const utenteAzienda = await prisma.utenteAzienda.findMany({
    where: { societaId, attivo: true },
    select: { utenteId: true },
  });

  if (utenteAzienda.length === 0) return 0;

  // Find existing non-resolved alerts to avoid duplicates
  const existingAlerts = await prisma.alertGenerato.findMany({
    where: {
      societaId,
      stato: { notIn: ["RISOLTO"] },
    },
    select: { datiContesto: true },
  });

  // Extract dedupeKeys from existing alerts' datiContesto
  const existingDedupeKeys = new Set<string>();
  for (const alert of existingAlerts) {
    const ctx = alert.datiContesto as Record<string, unknown> | null;
    if (ctx && typeof ctx.dedupeKey === "string") {
      existingDedupeKeys.add(ctx.dedupeKey);
    }
  }

  // Get rule configs to map codice -> regolaId
  const regolaConfigs = await prisma.regolaAlert.findMany({
    where: {
      OR: [{ societaId }, { societaId: null }],
      attiva: true,
    },
  });

  const regolaMap = new Map<string, number>();
  for (const r of regolaConfigs) {
    // Prefer societa-specific
    if (!regolaMap.has(r.codice) || r.societaId !== null) {
      regolaMap.set(r.codice, r.id);
    }
  }

  let created = 0;

  for (const result of results) {
    // Skip if already alerted
    if (existingDedupeKeys.has(result.dedupeKey)) continue;

    const regolaId = regolaMap.get(result.codiceRegola);
    if (!regolaId) {
      console.warn(`[AlertEngine] No RegolaAlert record found for codice: ${result.codiceRegola}`);
      continue;
    }

    // Create alert for each target user
    for (const ua of utenteAzienda) {
      await prisma.alertGenerato.create({
        data: {
          societaId,
          regolaId,
          utenteDestinatarioId: ua.utenteId,
          tipo: result.categoria,
          messaggio: result.messaggio,
          gravita: result.gravita,
          datiContesto: {
            ...result.datiContesto,
            dedupeKey: result.dedupeKey,
          },
          linkAzione: result.linkAzione ?? null,
        },
      });
      created++;
    }
  }

  return created;
}
