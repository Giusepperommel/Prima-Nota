"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatCurrency } from "@/lib/business-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

// Badge variants per stato
const STATO_CONFIG = {
  PREVISTO: { label: "Previsto", variant: "outline" as const, icon: Clock },
  EFFETTUATO: { label: "Pagato", variant: "default" as const, icon: CheckCircle },
  ANNULLATO: { label: "Annullato", variant: "secondary" as const, icon: XCircle },
};

const MOTIVO_LABELS: Record<string, string> = {
  ESTINZIONE_ANTICIPATA: "Estinzione anticipata",
  PERMUTA: "Permuta",
  RIFINANZIAMENTO: "Rifinanziamento",
};

const STATO_PIANO_LABELS: Record<string, string> = {
  ATTIVO: "Attivo",
  CHIUSO_ANTICIPATAMENTE: "Chiuso anticipatamente",
  COMPLETATO: "Completato",
};

const FREQUENZA_LABELS: Record<string, string> = {
  MENSILE: "Mensile",
  BIMESTRALE: "Bimestrale",
  TRIMESTRALE: "Trimestrale",
  QUADRIMESTRALE: "Quadrimestrale",
  SEMESTRALE: "Semestrale",
  ANNUALE: "Annuale",
};

type Pagamento = {
  id: number;
  numeroPagamento: number;
  data: string;
  importo: number;
  quotaCapitale: number;
  quotaInteressi: number;
  stato: "PREVISTO" | "EFFETTUATO" | "ANNULLATO";
  dataEffettivaPagamento?: string | null;
  note?: string | null;
};

type PianoPagamentoData = {
  id: number;
  tipo: "RATEALE" | "CUSTOM";
  stato: "ATTIVO" | "CHIUSO_ANTICIPATAMENTE" | "COMPLETATO";
  numeroRate?: number | null;
  importoRata?: number | null;
  tan?: number | null;
  anticipo?: number | null;
  frequenzaRate: string;
  dataInizio: string;
  dataChiusura?: string | null;
  motivoChiusura?: string | null;
  penaleEstinzione?: number | null;
  saldoResiduo?: number | null;
  pagamenti: Pagamento[];
};

type Props = {
  pianoPagamento: PianoPagamentoData;
  canEdit: boolean;
};

export function SezionePagamenti({ pianoPagamento, canEdit }: Props) {
  const router = useRouter();
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [closureLoading, setClosureLoading] = useState(false);
  const [motivoChiusura, setMotivoChiusura] = useState("");
  const [penaleEstinzione, setPenaleEstinzione] = useState("");
  const [saldoResiduo, setSaldoResiduo] = useState("");

  const totaleInteressi = pianoPagamento.pagamenti.reduce(
    (acc, p) => acc + p.quotaInteressi,
    0
  );

  async function handleMarkPaid(pagamentoId: number) {
    setMarkingPaid(pagamentoId);
    try {
      const res = await fetch(
        `/api/piani-pagamento/${pianoPagamento.id}/pagamenti/${pagamentoId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stato: "EFFETTUATO" }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nel segnare il pagamento");
      }

      toast.success("Pagamento segnato come effettuato");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Errore imprevisto"
      );
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleEarlyClosure() {
    if (!motivoChiusura) {
      toast.error("Seleziona un motivo di chiusura");
      return;
    }

    setClosureLoading(true);
    try {
      const body: Record<string, unknown> = {
        motivoChiusura,
      };
      if (penaleEstinzione) {
        body.penaleEstinzione = parseFloat(penaleEstinzione);
      }
      if (saldoResiduo) {
        body.saldoResiduo = parseFloat(saldoResiduo);
      }

      const res = await fetch(`/api/piani-pagamento/${pianoPagamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nella chiusura anticipata");
      }

      toast.success("Piano chiuso anticipatamente");
      setClosureDialogOpen(false);
      setMotivoChiusura("");
      setPenaleEstinzione("");
      setSaldoResiduo("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Errore imprevisto"
      );
    } finally {
      setClosureLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Piano di Pagamento</CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              pianoPagamento.stato === "ATTIVO"
                ? "default"
                : pianoPagamento.stato === "COMPLETATO"
                  ? "secondary"
                  : "destructive"
            }
          >
            {STATO_PIANO_LABELS[pianoPagamento.stato] || pianoPagamento.stato}
          </Badge>
          {pianoPagamento.stato === "ATTIVO" && canEdit && (
            <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Chiudi anticipatamente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Chiusura anticipata del piano</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="motivoChiusura">Motivo chiusura *</Label>
                    <Select
                      value={motivoChiusura}
                      onValueChange={setMotivoChiusura}
                    >
                      <SelectTrigger id="motivoChiusura">
                        <SelectValue placeholder="Seleziona motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MOTIVO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="penaleEstinzione">
                      Penale estinzione (opzionale)
                    </Label>
                    <Input
                      id="penaleEstinzione"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={penaleEstinzione}
                      onChange={(e) => setPenaleEstinzione(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="saldoResiduo">
                      Saldo residuo (opzionale)
                    </Label>
                    <Input
                      id="saldoResiduo"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={saldoResiduo}
                      onChange={(e) => setSaldoResiduo(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setClosureDialogOpen(false)}
                    disabled={closureLoading}
                  >
                    Annulla
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleEarlyClosure}
                    disabled={closureLoading}
                  >
                    {closureLoading ? "Chiusura in corso..." : "Conferma chiusura"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Tipo</span>
            <p className="font-medium">
              {pianoPagamento.tipo === "RATEALE" ? "Rateale" : "Custom"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Frequenza</span>
            <p className="font-medium">
              {FREQUENZA_LABELS[pianoPagamento.frequenzaRate] ||
                pianoPagamento.frequenzaRate}
            </p>
          </div>
          {pianoPagamento.numeroRate != null && (
            <div>
              <span className="text-muted-foreground">Numero rate</span>
              <p className="font-medium">{pianoPagamento.numeroRate}</p>
            </div>
          )}
          {pianoPagamento.anticipo != null && pianoPagamento.anticipo > 0 && (
            <div>
              <span className="text-muted-foreground">Anticipo</span>
              <p className="font-medium">
                {formatCurrency(pianoPagamento.anticipo)}
              </p>
            </div>
          )}
          {pianoPagamento.tan != null && pianoPagamento.tan > 0 && (
            <div>
              <span className="text-muted-foreground">TAN</span>
              <p className="font-medium">{pianoPagamento.tan}%</p>
            </div>
          )}
          {totaleInteressi > 0 && (
            <div>
              <span className="text-muted-foreground">Totale interessi</span>
              <p className="font-medium">{formatCurrency(totaleInteressi)}</p>
            </div>
          )}
        </div>

        {/* Early closure info */}
        {pianoPagamento.stato === "CHIUSO_ANTICIPATAMENTE" && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-800 dark:bg-orange-950">
            <p className="font-medium text-orange-800 dark:text-orange-200">
              Piano chiuso anticipatamente
              {pianoPagamento.motivoChiusura &&
                ` - ${MOTIVO_LABELS[pianoPagamento.motivoChiusura] || pianoPagamento.motivoChiusura}`}
            </p>
            <div className="mt-1 flex gap-4 text-orange-700 dark:text-orange-300">
              {pianoPagamento.dataChiusura && (
                <span>
                  Data:{" "}
                  {format(new Date(pianoPagamento.dataChiusura), "dd/MM/yyyy", {
                    locale: it,
                  })}
                </span>
              )}
              {pianoPagamento.penaleEstinzione != null &&
                pianoPagamento.penaleEstinzione > 0 && (
                  <span>
                    Penale: {formatCurrency(pianoPagamento.penaleEstinzione)}
                  </span>
                )}
              {pianoPagamento.saldoResiduo != null &&
                pianoPagamento.saldoResiduo > 0 && (
                  <span>
                    Saldo residuo: {formatCurrency(pianoPagamento.saldoResiduo)}
                  </span>
                )}
            </div>
          </div>
        )}

        {/* Payments table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-right">Quota capitale</TableHead>
                <TableHead className="text-right">Quota interessi</TableHead>
                <TableHead>Stato</TableHead>
                {canEdit && <TableHead className="w-32">Azioni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pianoPagamento.pagamenti.map((pagamento) => {
                const config = STATO_CONFIG[pagamento.stato];
                const Icon = config.icon;
                return (
                  <TableRow key={pagamento.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {pagamento.numeroPagamento}
                    </TableCell>
                    <TableCell>
                      {format(new Date(pagamento.data), "dd/MM/yyyy", {
                        locale: it,
                      })}
                      {pagamento.dataEffettivaPagamento &&
                        pagamento.dataEffettivaPagamento !== pagamento.data && (
                          <span className="block text-xs text-muted-foreground">
                            Pagato il{" "}
                            {format(
                              new Date(pagamento.dataEffettivaPagamento),
                              "dd/MM/yyyy",
                              { locale: it }
                            )}
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pagamento.importo)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(pagamento.quotaCapitale)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(pagamento.quotaInteressi)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        {pagamento.stato === "PREVISTO" &&
                          pianoPagamento.stato === "ATTIVO" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={markingPaid === pagamento.id}
                              onClick={() => handleMarkPaid(pagamento.id)}
                            >
                              {markingPaid === pagamento.id
                                ? "..."
                                : "Segna pagato"}
                            </Button>
                          )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {pianoPagamento.pagamenti.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 7 : 6}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nessun pagamento presente
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
