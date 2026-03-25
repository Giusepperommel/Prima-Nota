"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileText,
  Landmark,
  CheckCircle2,
  XCircle,
  CheckCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bozza = {
  id: number;
  dataOperazione: string;
  descrizione: string;
  importoTotale: number;
  tipoOperazione: string;
  sorgente: string | null;
  aiConfidence: number | null;
  fornitore: { id: number; denominazione: string } | null;
  categoria: { id: number; nome: string } | null;
};

type Movimento = {
  id: number;
  data: string;
  descrizione: string;
  importo: number;
  segno: string;
  statoRiconciliazione: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function confidenceBadge(confidence: number | null) {
  if (confidence == null) {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-500/15 text-gray-400 border-gray-500/25">
        N/D
      </span>
    );
  }
  const pct = Math.round(confidence * 100);
  if (pct >= 90) {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/25">
        {pct}%
      </Badge>
    );
  }
  if (pct >= 50) {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/25">
        {pct}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/25">
      {pct}%
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CentroImportContent() {
  const [bozze, setBozze] = useState<Bozza[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Data fetching ----

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bozzeRes, movRes] = await Promise.all([
        fetch("/api/bozze"),
        fetch("/api/riconciliazione/movimenti"),
      ]);

      if (bozzeRes.ok) {
        const data: Bozza[] = await bozzeRes.json();
        setBozze(data);
      }

      if (movRes.ok) {
        const data = await movRes.json();
        setMovimenti(data.movimenti || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nel caricamento";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Derived data ----

  const importBozze = bozze.filter(
    (b) => b.sorgente === "XML_IMPORT" || b.sorgente === "OCR"
  );

  const fatturePassiveBozze = bozze.filter(
    (b) => b.sorgente === "XML_IMPORT"
  );
  const pendingReview = fatturePassiveBozze.filter(
    (b) => b.aiConfidence == null || b.aiConfidence < 0.9
  );

  const nonRiconciliati = movimenti.filter(
    (m) => m.statoRiconciliazione === "NON_RICONCILIATO"
  );
  // "without match" = all non-reconciled (no operazione linked)
  const senzaMatch = nonRiconciliati;

  const confirmable = importBozze.filter(
    (b) => b.aiConfidence != null && b.aiConfidence >= 0.9
  );

  // ---- Actions ----

  const handleUploadXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const res = await fetch("/api/import/fatture", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nell'importazione");
      }

      const data = await res.json();
      toast.success(
        `Importate ${data.bozzeCreate ?? data.importate ?? 0} fatture come bozze`
      );
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nell'importazione";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApprove = async (id: number) => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/bozze/${id}/conferma`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nella conferma");
      }
      toast.success("Bozza confermata");
      setBozze((prev) => prev.filter((b) => b.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nella conferma";
      toast.error(message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/operazioni/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nell'eliminazione");
      }
      toast.success("Bozza eliminata");
      setBozze((prev) => prev.filter((b) => b.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      toast.error(message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmAll = async () => {
    setConfirmingAll(true);
    try {
      const res = await fetch("/api/import/conferma-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minConfidence: 0.9 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nella conferma batch");
      }

      const data = await res.json();
      toast.success(`Confermate ${data.confermate} bozze`);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nella conferma batch";
      toast.error(message);
    } finally {
      setConfirmingAll(false);
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Summary cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fatture passive (bozze)
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fatturePassiveBozze.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingReview.length} da revisionare
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Movimenti banca
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nonRiconciliati.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {senzaMatch.length} senza corrispondenza
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pronte per conferma
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {confirmable.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Confidence &ge; 90%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Totale bozze import
            </CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importBozze.length}</div>
            <p className="text-xs text-muted-foreground">
              XML + OCR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Quick actions ---- */}
      <div className="flex flex-wrap gap-3">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            className="hidden"
            onChange={handleUploadXml}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Importazione in corso..." : "Importa XML"}
          </Button>
        </div>

        <Button variant="outline" asChild>
          <a href="/riconciliazione-bancaria">
            <Landmark className="mr-2 h-4 w-4" />
            Importa CSV banca
          </a>
        </Button>
      </div>

      {/* ---- Review queue ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Coda di revisione</CardTitle>
        </CardHeader>
        <CardContent>
          {importBozze.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Nessuna bozza da revisionare
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Fornitore</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="text-center">Confidence</TableHead>
                    <TableHead className="text-center">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importBozze.map((bozza) => (
                    <TableRow key={bozza.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(bozza.dataOperazione)}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {bozza.descrizione}
                      </TableCell>
                      <TableCell>
                        {bozza.fornitore?.denominazione ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(bozza.importoTotale)}
                      </TableCell>
                      <TableCell className="text-center">
                        {confidenceBadge(bozza.aiConfidence)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                            disabled={actionInProgress === bozza.id}
                            onClick={() => handleApprove(bozza.id)}
                            title="Conferma"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            disabled={actionInProgress === bozza.id}
                            onClick={() => handleReject(bozza.id)}
                            title="Elimina"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Batch action bar ---- */}
      {confirmable.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {confirmable.length}
            </span>{" "}
            {confirmable.length === 1 ? "bozza pronta" : "bozze pronte"} per
            la conferma automatica (confidence &ge; 90%)
          </p>
          <Button
            onClick={handleConfirmAll}
            disabled={confirmingAll}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            {confirmingAll
              ? "Conferma in corso..."
              : `Conferma tutti >90%`}
          </Button>
        </div>
      )}
    </div>
  );
}
