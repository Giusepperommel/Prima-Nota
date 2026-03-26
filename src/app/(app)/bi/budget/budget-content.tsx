"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { BudgetVsActualChart } from "@/components/bi/budget-vs-actual-chart";

interface BudgetItem {
  id: number;
  anno: number;
  nome: string;
  stato: string;
  createdAt: string;
}

export function BudgetContent() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [budgetDetail, setBudgetDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [newName, setNewName] = useState("");
  const [newAnno, setNewAnno] = useState(String(new Date().getFullYear()));
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch("/api/bi/budget");
      if (res.ok) {
        const data = await res.json();
        setBudgets(data.budgets || []);
      }
    } catch (err) {
      console.error("[Budget] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/bi/budget/${id}?mese=${mese}`);
      if (res.ok) setBudgetDetail(await res.json());
    } catch (err) {
      console.error("[Budget] Detail error:", err);
    }
  }, [mese]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId, fetchDetail]);

  const handleCreate = useCallback(async () => {
    if (!newName) return;
    try {
      const res = await fetch("/api/bi/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: Number(newAnno), nome: newName }),
      });
      if (res.ok) {
        setNewName("");
        setDialogOpen(false);
        await fetchBudgets();
      }
    } catch (err) {
      console.error("[Budget] Create error:", err);
    }
  }, [newName, newAnno, fetchBudgets]);

  const compChartData = budgetDetail?.comparison?.righe?.map((r: any) => ({
    label: r.label.slice(0, 20),
    budget: r.valorePrecedente,
    actual: r.valoreCorrente,
    delta: r.delta,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuovo Budget</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crea Budget</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Nome budget" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="number" placeholder="Anno" value={newAnno} onChange={(e) => setNewAnno(e.target.value)} />
              <Button onClick={handleCreate} disabled={!newName}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nessun budget creato</p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <Card
              key={b.id}
              className={`cursor-pointer transition-colors ${selectedId === b.id ? "border-blue-500" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedId(b.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{b.nome}</p>
                  <p className="text-xs text-muted-foreground">Anno {b.anno}</p>
                </div>
                <Badge variant={b.stato === "APPROVATO" ? "default" : "secondary"}>{b.stato}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {budgetDetail && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Confronto Mese</h3>
            <Select value={String(mese)} onValueChange={(v) => setMese(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"].map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {compChartData.length > 0 && <BudgetVsActualChart data={compChartData} />}
        </div>
      )}
    </div>
  );
}
