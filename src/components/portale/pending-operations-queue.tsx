"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, X, User, Loader2 } from "lucide-react";

interface PendingOp {
  id: number;
  tipo: string;
  stato: string;
  dati: any;
  createdAt: string;
  accessoCliente: { id: number; nome: string };
}

interface PendingOperationsQueueProps {
  operazioni: PendingOp[];
  onAction: (opId: number, azione: "VALIDATA" | "RIFIUTATA", note?: string) => Promise<void>;
}

const TIPO_LABELS: Record<string, string> = {
  INCASSO: "Incasso",
  PAGAMENTO: "Pagamento",
  FATTURA: "Fattura",
};

export function PendingOperationsQueue({ operazioni, onAction }: PendingOperationsQueueProps) {
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const handleAction = async (opId: number, azione: "VALIDATA" | "RIFIUTATA") => {
    setProcessingId(opId);
    try {
      await onAction(opId, azione, notes[opId] || undefined);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[opId];
        return next;
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Operazioni da Validare</span>
          {operazioni.length > 0 && (
            <Badge variant="secondary">{operazioni.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {operazioni.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessuna operazione in attesa di validazione
          </p>
        ) : (
          <div className="space-y-3">
            {operazioni.map((op) => {
              const isProcessing = processingId === op.id;
              return (
                <div
                  key={op.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {TIPO_LABELS[op.tipo] || op.tipo}
                        </span>
                        {op.dati?.importo && (
                          <span className="text-sm font-bold">
                            {Number(op.dati.importo).toLocaleString("it-IT", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {op.accessoCliente.nome}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          -- {new Date(op.createdAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                      {/* Show additional data details */}
                      <div className="text-xs text-muted-foreground mt-1 space-x-2">
                        {op.dati?.cliente && <span>Cliente: {op.dati.cliente}</span>}
                        {op.dati?.fornitore && <span>Fornitore: {op.dati.fornitore}</span>}
                        {op.dati?.descrizione && <span>-- {op.dati.descrizione}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Note (opzionale)"
                      value={notes[op.id] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [op.id]: e.target.value }))
                      }
                      className="flex-1 h-8 text-sm"
                      disabled={isProcessing}
                    />
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAction(op.id, "VALIDATA")}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Valida
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(op.id, "RIFIUTATA")}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Rifiuta
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
