"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DeliveryData {
  id: number;
  evento: string;
  statoHttp: number | null;
  stato: string;
  tentativo: number;
  createdAt: string;
}

export function DeliveryHistory({ endpointId }: { endpointId: number }) {
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([]);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch(`/api/configurazione/api/webhook?endpointId=${endpointId}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (err) { console.error(err); }
  }, [endpointId]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  if (deliveries.length === 0) return <p className="text-xs text-muted-foreground py-2">Nessuna consegna</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Evento</TableHead>
          <TableHead className="text-xs">Stato HTTP</TableHead>
          <TableHead className="text-xs">Risultato</TableHead>
          <TableHead className="text-xs">Tentativo</TableHead>
          <TableHead className="text-xs">Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.slice(0, 20).map((d) => (
          <TableRow key={d.id}>
            <TableCell className="text-xs font-mono">{d.evento}</TableCell>
            <TableCell className="text-xs">{d.statoHttp || "—"}</TableCell>
            <TableCell>
              <Badge variant={d.stato === "CONSEGNATO" ? "default" : "destructive"} className="text-[10px]">
                {d.stato}
              </Badge>
            </TableCell>
            <TableCell className="text-xs">{d.tentativo}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("it-IT")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
