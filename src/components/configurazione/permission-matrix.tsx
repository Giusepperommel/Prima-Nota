"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { PermissionPresets } from "./permission-presets";

interface Permesso {
  sezione: string;
  lettura: boolean;
  scrittura: boolean;
}

interface ClienteOption {
  id: number;
  nome: string;
  email: string;
}

const SEZIONE_LABELS: Record<string, string> = {
  KPI: "KPI Dashboard",
  PRIMA_NOTA: "Prima Nota",
  DOCUMENTI: "Documenti",
  CHAT: "Messaggistica",
  IVA: "Situazione IVA",
  SCADENZARIO: "Scadenzario",
  FATTURE: "Fatture",
  F24: "F24",
  BILANCIO: "Bilancio",
  REPORT: "Report",
};

interface PermissionMatrixProps {
  clienti: ClienteOption[];
}

export function PermissionMatrix({ clienti }: PermissionMatrixProps) {
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [permessi, setPermessi] = useState<Permesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPermessi = useCallback(async (clienteId: string) => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portale/permessi?clienteId=${clienteId}`);
      if (res.ok) {
        const data = await res.json();
        setPermessi(data.permessi || []);
      }
    } catch (err) {
      console.error("[Permessi] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClienteId) fetchPermessi(selectedClienteId);
  }, [selectedClienteId, fetchPermessi]);

  const togglePermesso = (sezione: string, campo: "lettura" | "scrittura") => {
    setPermessi((prev) => prev.map((p) => p.sezione === sezione ? { ...p, [campo]: !p[campo] } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/portale/permessi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessoClienteId: Number(selectedClienteId), permessi }),
      });
    } catch (err) {
      console.error("[Permessi] Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Permessi Portale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
          <SelectTrigger><SelectValue placeholder="Seleziona cliente..." /></SelectTrigger>
          <SelectContent>
            {clienti.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome} ({c.email})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedClienteId && !loading && (
          <>
            <PermissionPresets onApply={setPermessi} />

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Sezione</th>
                    <th className="text-center p-3 font-medium w-24">Lettura</th>
                    <th className="text-center p-3 font-medium w-24">Scrittura</th>
                  </tr>
                </thead>
                <tbody>
                  {permessi.map((p) => (
                    <tr key={p.sezione} className="border-t">
                      <td className="p-3">{SEZIONE_LABELS[p.sezione] || p.sezione}</td>
                      <td className="p-3 text-center">
                        <Checkbox checked={p.lettura} onCheckedChange={() => togglePermesso(p.sezione, "lettura")} />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox checked={p.scrittura} onCheckedChange={() => togglePermesso(p.sezione, "scrittura")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salva Permessi
            </Button>
          </>
        )}

        {loading && <div className="h-40 bg-muted animate-pulse rounded-lg" />}
      </CardContent>
    </Card>
  );
}
