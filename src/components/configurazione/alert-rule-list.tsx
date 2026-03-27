"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertRuleEditor } from "./alert-rule-editor";

interface RuleData {
  codice: string;
  descrizione: string;
  categoria: string;
  defaultGravita: string;
  defaultSogliaGiorni: number | null;
  defaultSogliaValore: number | null;
  // DB overrides
  attiva?: boolean;
  gravita?: string;
  sogliaGiorni?: number | null;
  sogliaValore?: number | null;
  canali?: string[];
  ruoliDestinatari?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  SCADENZE: "Scadenze",
  ANOMALIE_CONTABILI: "Anomalie Contabili",
  CASH_FLOW: "Cash Flow",
  COMPLIANCE: "Compliance",
  CONFRONTO: "Confronto",
  RICONCILIAZIONE: "Riconciliazione",
};

export function AlertRuleList() {
  const [rules, setRules] = useState<RuleData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/alert");
      if (res.ok) {
        const data = await res.json();
        // Merge builtin rules with DB overrides
        const builtins: RuleData[] = data.regoleBuiltin || [];
        const dbRules: Record<string, unknown>[] = data.regole || [];

        const merged = builtins.map((b) => {
          const db = dbRules.find((d: Record<string, unknown>) => d.codice === b.codice);
          if (db) {
            return {
              ...b,
              attiva: db.attiva as boolean | undefined,
              gravita: db.gravita as string | undefined,
              sogliaGiorni: db.sogliaGiorni as number | null | undefined,
              sogliaValore: db.sogliaValore as number | null | undefined,
              canali: db.canali as string[] | undefined,
              ruoliDestinatari: db.ruoliDestinatari as string[] | undefined,
            };
          }
          return b;
        });
        setRules(merged);
      }
    } catch (err) {
      console.error("[AlertRules] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = useCallback(async (codice: string, updates: Record<string, unknown>) => {
    try {
      await fetch("/api/configurazione/alert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, ...updates }),
      });
      fetchRules();
    } catch (err) {
      console.error("[AlertRules] Save error:", err);
    }
  }, [fetchRules]);

  // Group by category
  const grouped = rules.reduce<Record<string, RuleData[]>>((acc, rule) => {
    const cat = rule.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {});

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, catRules]) => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{CATEGORY_LABELS[cat] || cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catRules.map((rule) => (
              <AlertRuleEditor key={rule.codice} rule={rule} onSave={handleSave} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
