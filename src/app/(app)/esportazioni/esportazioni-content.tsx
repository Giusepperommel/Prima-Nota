"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, FileArchive, Loader2 } from "lucide-react";

interface EntityOption {
  tipo: string;
  nome: string;
  campi: string[];
}

export function EsportazioniContent() {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/esportazioni");
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entitaDisponibili || []);
        setFormats(data.formatiDisponibili || []);
      }
    } catch (err) {
      console.error("[Export] Config error:", err);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleExport = useCallback(async (entityType?: string) => {
    setExporting(true);
    try {
      const body: Record<string, unknown> = {
        entityType: entityType || selectedEntity,
        format: selectedFormat,
      };
      if (dateFrom) body.filters = { ...body.filters as object, da: dateFrom };
      if (dateTo) body.filters = { ...body.filters as object, a: dateTo };

      const res = await fetch("/api/esportazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") || "";
        const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
        const filename = filenameMatch?.[1] || `export.${selectedFormat}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[Export] Error:", err);
    } finally {
      setExporting(false);
    }
  }, [selectedEntity, selectedFormat, dateFrom, dateTo]);

  const FORMAT_LABELS: Record<string, string> = { csv: "CSV", json: "JSON", xlsx: "Excel", pdf: "PDF" };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Esporta Dati</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo dati</label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger><SelectValue placeholder="Seleziona entità..." /></SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.tipo} value={e.tipo}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Formato</label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f} value={f}>{FORMAT_LABELS[f] || f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Da (opzionale)</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">A (opzionale)</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => handleExport()} disabled={!selectedEntity || exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Esporta
            </Button>
            <Button variant="outline" onClick={() => handleExport("backup-completo")} disabled={exporting}>
              <FileArchive className="h-4 w-4 mr-1" /> Backup Completo (ZIP)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entità Disponibili</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {entities.map((e) => (
              <div key={e.tipo} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{e.nome}</span>
                <Badge variant="outline" className="text-[10px]">{e.campi.length} campi</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
