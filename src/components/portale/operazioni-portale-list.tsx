"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OpPortale {
  id: number;
  tipo: string;
  stato: string;
  noteCommercialista: string | null;
  createdAt: string;
  dati: any;
}

interface OperazioniPortaleListProps {
  operazioni: OpPortale[];
}

const TIPO_LABELS: Record<string, string> = { INCASSO: "Incasso", PAGAMENTO: "Pagamento", FATTURA: "Fattura" };
const STATO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BOZZA: "secondary", VALIDATA: "default", RIFIUTATA: "destructive",
};

export function OperazioniPortaleList({ operazioni }: OperazioniPortaleListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Le tue operazioni</CardTitle>
      </CardHeader>
      <CardContent>
        {operazioni.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna operazione registrata</p>
        ) : (
          <div className="space-y-2">
            {operazioni.map((op) => (
              <div key={op.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{TIPO_LABELS[op.tipo] || op.tipo}</span>
                    <Badge variant={STATO_VARIANT[op.stato] || "outline"} className="text-[10px]">{op.stato}</Badge>
                  </div>
                  {op.dati?.importo && <p className="text-xs text-muted-foreground">€ {Number(op.dati.importo).toLocaleString("it-IT")}</p>}
                  {op.noteCommercialista && <p className="text-xs text-amber-600 mt-0.5">Nota: {op.noteCommercialista}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(op.createdAt).toLocaleDateString("it-IT")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
