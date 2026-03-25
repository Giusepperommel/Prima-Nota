"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
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
import { Upload, Link2, Unlink, Sparkles } from "lucide-react";

type Movimento = {
  id: number;
  data: string;
  descrizione: string;
  importo: number;
  segno: string;
  saldo: number | null;
  statoRiconciliazione: string;
  operazione: {
    id: number;
    descrizione: string;
    importoTotale: number;
  } | null;
};

type Suggerimento = {
  movimentoId: number;
  operazioneId: number;
  score: number;
  motivazione: string;
};

const STATO_BADGE: Record<string, string> = {
  NON_RICONCILIATO: "bg-red-500/15 text-red-400 border-red-500/25",
  RICONCILIATO: "bg-green-500/15 text-green-400 border-green-500/25",
  PARZIALE: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
};

const STATO_LABELS: Record<string, string> = {
  NON_RICONCILIATO: "Non riconciliato",
  RICONCILIATO: "Riconciliato",
  PARZIALE: "Parziale",
};

export function RiconciliazioneContent() {
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [suggerimenti, setSuggerimenti] = useState<Suggerimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statoFilter, setStatoFilter] = useState("");
  const [preset, setPreset] = useState("GENERICO");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMovimenti = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statoFilter) params.set("stato", statoFilter);
      const res = await fetch(`/api/riconciliazione/movimenti?${params}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setMovimenti(data.movimenti || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [statoFilter]);

  const fetchSuggerimenti = useCallback(async () => {
    try {
      const res = await fetch("/api/riconciliazione/suggerimenti");
      if (!res.ok) return;
      const data = await res.json();
      setSuggerimenti(data.suggerimenti || []);
    } catch {
      // Non-critical, ignore
    }
  }, []);

  useEffect(() => {
    fetchMovimenti();
    fetchSuggerimenti();
  }, [fetchMovimenti, fetchSuggerimenti]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const csvContent = await file.text();
      const res = await fetch("/api/riconciliazione/importa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, preset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nell'importazione");
      toast.success(`Importati ${data.importati} movimenti`);
      if (data.errori?.length > 0) {
        toast.warning(`${data.errori.length} righe con errori`);
      }
      fetchMovimenti();
      fetchSuggerimenti();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRiconcilia = async (movimentoId: number, operazioneId: number) => {
    try {
      const res = await fetch("/api/riconciliazione/riconcilia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movimentoId, operazioneId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Riconciliazione effettuata");
      fetchMovimenti();
      fetchSuggerimenti();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSriconcilia = async (movimentoId: number) => {
    try {
      const res = await fetch("/api/riconciliazione/riconcilia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movimentoId, operazioneId: null }),
      });
      if (!res.ok) throw new Error("Errore");
      toast.success("Riconciliazione rimossa");
      fetchMovimenti();
      fetchSuggerimenti();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getSuggerimento = (movimentoId: number) =>
    suggerimenti.find((s) => s.movimentoId === movimentoId);

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Importa Estratto Conto</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Formato Banca
            </label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERICO">Generico</SelectItem>
                <SelectItem value="INTESA_SANPAOLO">Intesa Sanpaolo</SelectItem>
                <SelectItem value="UNICREDIT">UniCredit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Importazione..." : "Carica CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select
          value={statoFilter || "ALL"}
          onValueChange={(v) => setStatoFilter(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti gli stati</SelectItem>
            <SelectItem value="NON_RICONCILIATO">Non riconciliato</SelectItem>
            <SelectItem value="RICONCILIATO">Riconciliato</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {movimenti.length} movimenti
        </p>
      </div>

      {/* Movements table */}
      <div className="rounded-lg border">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : movimenti.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessun movimento bancario. Importa un estratto conto CSV.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right w-[120px]">Importo</TableHead>
                <TableHead className="w-[60px]">Segno</TableHead>
                <TableHead className="w-[140px]">Stato</TableHead>
                <TableHead>Operazione</TableHead>
                <TableHead className="w-[120px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimenti.map((m) => {
                const sugg = getSuggerimento(m.id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(m.data).toLocaleDateString("it-IT")}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate">{m.descrizione}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(m.importo)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          m.segno === "AVERE"
                            ? "bg-green-500/15 text-green-400 border-green-500/25"
                            : "bg-red-500/15 text-red-400 border-red-500/25"
                        }
                      >
                        {m.segno === "AVERE" ? "+" : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATO_BADGE[m.statoRiconciliazione] || ""}
                      >
                        {STATO_LABELS[m.statoRiconciliazione] || m.statoRiconciliazione}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.operazione ? (
                        <span className="text-green-400">
                          {m.operazione.descrizione}
                        </span>
                      ) : sugg ? (
                        <span className="text-yellow-400 text-xs">
                          <Sparkles className="inline h-3 w-3 mr-1" />
                          {sugg.motivazione} (score: {sugg.score})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.operazione ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSriconcilia(m.id)}
                          title="Rimuovi riconciliazione"
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      ) : sugg ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            handleRiconcilia(m.id, sugg.operazioneId)
                          }
                          title="Accetta suggerimento"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
