"use client";

import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

interface ScadenzaCountdownProps {
  scadenze: { id: number; tipo: string; scadenza: string; stato: string; percentualeCompletamento: number }[];
}

export function ScadenzaCountdown({ scadenze }: ScadenzaCountdownProps) {
  const now = new Date();

  return (
    <div className="space-y-2">
      {scadenze.map((s) => {
        const giorni = differenceInDays(new Date(s.scadenza), now);
        const urgency = giorni <= 3 ? "destructive" : giorni <= 7 ? "secondary" : "outline";
        return (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{s.tipo.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">{s.percentualeCompletamento}% completato</p>
            </div>
            <Badge variant={urgency as any}>
              {giorni <= 0 ? "Scaduto" : giorni === 1 ? "Domani" : `${giorni} giorni`}
            </Badge>
          </div>
        );
      })}
      {scadenze.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nessuna scadenza imminente</p>}
    </div>
  );
}
