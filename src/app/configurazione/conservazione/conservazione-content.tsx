"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Plus } from "lucide-react";

type Pacchetto = {
  id: number;
  anno: number;
  tipo: string;
  stato: string;
  hashSHA256: string;
  createdAt: string;
};

const TIPO_LABELS: Record<string, string> = {
  FATTURE_ATTIVE: "Fatture Attive",
  FATTURE_PASSIVE: "Fatture Passive",
  LIBRO_GIORNALE: "Libro Giornale",
  REGISTRI_IVA: "Registri IVA",
};

const STATO_BADGE: Record<string, string> = {
  GENERATO: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  FIRMATO: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  CONSERVATO: "bg-green-500/15 text-green-400 border-green-500/25",
};

export function ConservazioneContent() {
  const currentYear = new Date().getFullYear();
  const [pacchetti, setPacchetti] = useState<Pacchetto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [annoGen, setAnnoGen] = useState(String(currentYear));
  const [tipoGen, setTipoGen] = useState("FATTURE_ATTIVE");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchPacchetti = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conservazione/genera-pacchetto");
      if (res.status === 405) {
        // GET not supported on this endpoint, use a list endpoint or handle gracefully
        setPacchetti([]);
        return;
      }
      if (!res.ok) throw new Error("Errore nel caricamento");
      setPacchetti(await res.json());
    } catch {
      // No list endpoint yet - start empty
      setPacchetti([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacchetti();
  }, [fetchPacchetti]);

  const handleGenera = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/conservazione/genera-pacchetto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: parseInt(annoGen), tipo: tipoGen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella generazione");
      toast.success(`Pacchetto generato con ${data.numDocumenti} documenti`);
      fetchPacchetti();
    } catch (error: any) {
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (id: number) => {
    window.open(`/api/conservazione/${id}/download`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Generation section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Genera Nuovo Pacchetto</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Anno
            </label>
            <Select value={annoGen} onValueChange={setAnnoGen}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Tipo Documenti
            </label>
            <Select value={tipoGen} onValueChange={setTipoGen}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenera} disabled={generating}>
            <Plus className="h-4 w-4 mr-2" />
            {generating ? "Generazione..." : "Genera Pacchetto"}
          </Button>
        </div>
      </div>

      {/* Packages list */}
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Pacchetti Generati</h3>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : pacchetti.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessun pacchetto di conservazione generato
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Hash SHA-256</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacchetti.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.anno}</TableCell>
                  <TableCell>{TIPO_LABELS[p.tipo] || p.tipo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATO_BADGE[p.stato] || ""}>
                      {p.stato}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">
                    {p.hashSHA256}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(p.createdAt).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(p.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
