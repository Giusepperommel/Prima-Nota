"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CreditCard, AlertTriangle } from "lucide-react";

type Scadenza = {
  id: number;
  dataScadenza: string;
  importo: number;
  importoPagato: number;
  stato: string;
  tipo: string;
  operazione: {
    id: number;
    descrizione: string;
    importoTotale: number;
    dataOperazione: string;
  } | null;
};

type AnagraficaGroup = {
  anagrafica: {
    id: number;
    denominazione: string;
    tipo: string;
    partitaIva: string | null;
  };
  saldoAperto: number;
  scadenze: Scadenza[];
};

type ScadenzaScadenziario = {
  id: number;
  dataScadenza: string;
  importo: number;
  importoPagato: number;
  residuo: number;
  stato: string;
  tipo: string;
  giorniAllaScadenza: number;
  scaduta: boolean;
  anagrafica: { id: number; denominazione: string };
};

const STATO_BADGE: Record<string, string> = {
  APERTA: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  PARZIALE: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  CHIUSA: "bg-green-500/15 text-green-400 border-green-500/25",
};

export function PartitarioContent() {
  const [clienti, setClienti] = useState<AnagraficaGroup[]>([]);
  const [fornitori, setFornitori] = useState<AnagraficaGroup[]>([]);
  const [scadenziario, setScadenziario] = useState<ScadenzaScadenziario[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: number; residuo: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resClienti, resFornitori, resScadenziario] = await Promise.all([
        fetch("/api/partitario?tipo=CLIENTE"),
        fetch("/api/partitario?tipo=FORNITORE"),
        fetch("/api/partitario/scadenziario"),
      ]);

      if (resClienti.ok) setClienti(await resClienti.json());
      if (resFornitori.ok) setFornitori(await resFornitori.json());
      if (resScadenziario.ok) setScadenziario(await resScadenziario.json());
    } catch (error: any) {
      toast.error(error.message || "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openPayDialog = (scadenzaId: number, residuo: number) => {
    setPayTarget({ id: scadenzaId, residuo });
    setPayAmount(residuo.toFixed(2));
    setPayDialogOpen(true);
  };

  const handlePay = async () => {
    if (!payTarget) return;
    try {
      const res = await fetch(`/api/partitario/${payTarget.id}/paga`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importoPagamento: parseFloat(payAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Pagamento registrato. Residuo: ${formatCurrency(data.residuo)}`);
      setPayDialogOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const renderPartitario = (groups: AnagraficaGroup[]) => {
    if (groups.length === 0) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          Nessuna posizione aperta
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.anagrafica.id} className="rounded-lg border">
            <div className="flex items-center justify-between p-4 bg-muted/30">
              <div>
                <p className="font-semibold">{g.anagrafica.denominazione}</p>
                {g.anagrafica.partitaIva && (
                  <p className="text-xs text-muted-foreground">P.IVA: {g.anagrafica.partitaIva}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo aperto</p>
                <p className="font-mono font-bold text-lg">{formatCurrency(g.saldoAperto)}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Scadenza</TableHead>
                  <TableHead>Operazione</TableHead>
                  <TableHead className="text-right w-[120px]">Importo</TableHead>
                  <TableHead className="text-right w-[120px]">Pagato</TableHead>
                  <TableHead className="text-right w-[120px]">Residuo</TableHead>
                  <TableHead className="w-[100px]">Stato</TableHead>
                  <TableHead className="w-[80px] text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.scadenze.map((s) => {
                  const residuo = Math.round((s.importo - s.importoPagato) * 100) / 100;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">
                        {new Date(s.dataScadenza).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.operazione?.descrizione || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(s.importo)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(s.importoPagato)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(residuo)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATO_BADGE[s.stato] || ""}>
                          {s.stato}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.stato !== "CHIUSA" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openPayDialog(s.id, residuo)}
                            title="Registra pagamento"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="clienti">
        <TabsList>
          <TabsTrigger value="clienti">
            Clienti ({clienti.length})
          </TabsTrigger>
          <TabsTrigger value="fornitori">
            Fornitori ({fornitori.length})
          </TabsTrigger>
          <TabsTrigger value="scadenziario">
            Scadenziario ({scadenziario.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clienti">
          {renderPartitario(clienti)}
        </TabsContent>

        <TabsContent value="fornitori">
          {renderPartitario(fornitori)}
        </TabsContent>

        <TabsContent value="scadenziario">
          {scadenziario.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nessuna scadenza nei prossimi 90 giorni
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Scadenza</TableHead>
                    <TableHead>Anagrafica</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right w-[120px]">Residuo</TableHead>
                    <TableHead className="w-[100px]">Stato</TableHead>
                    <TableHead className="w-[120px]">Giorni</TableHead>
                    <TableHead className="w-[80px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scadenziario.map((s) => (
                    <TableRow key={s.id} className={s.scaduta ? "bg-red-500/5" : ""}>
                      <TableCell className="font-mono text-sm">
                        {new Date(s.dataScadenza).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell>{s.anagrafica.denominazione}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.tipo === "CLIENTE" ? "Cliente" : "Fornitore"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(s.residuo)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATO_BADGE[s.stato] || ""}>
                          {s.stato}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.scaduta ? (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {Math.abs(s.giorniAllaScadenza)}g scaduta
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {s.giorniAllaScadenza}g
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.stato !== "CHIUSA" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openPayDialog(s.id, s.residuo)}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Importo pagamento</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={payTarget?.residuo}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Residuo: {payTarget ? formatCurrency(payTarget.residuo) : "-"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handlePay} disabled={!payAmount || parseFloat(payAmount) <= 0}>
              Conferma Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
