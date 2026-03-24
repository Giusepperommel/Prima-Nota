"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  operazioneId: number;
  tipoOperazione: string;
};

type FatturaInfo = {
  id: number;
  numero: string;
  nomeFile: string;
  stato: string;
  dataGenerazione: string;
};

const STATO_COLORS: Record<string, string> = {
  GENERATA: "bg-blue-100 text-blue-700",
  INVIATA: "bg-yellow-100 text-yellow-700",
  CONSEGNATA: "bg-green-100 text-green-700",
  SCARTATA: "bg-red-100 text-red-700",
};

const STATO_LABELS: Record<string, string> = {
  GENERATA: "Generata",
  INVIATA: "Inviata",
  CONSEGNATA: "Consegnata",
  SCARTATA: "Scartata",
  MANCATA_CONSEGNA: "Mancata consegna",
  ANNULLATA: "Annullata",
};

export function GeneraFatturaPanel({ operazioneId, tipoOperazione }: Props) {
  const [fattura, setFattura] = useState<FatturaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // Check if fattura already exists for this operation
    async function checkFattura() {
      try {
        const res = await fetch(
          `/api/fatture-elettroniche?page=1&perPage=1`
        );
        if (res.ok) {
          const data = await res.json();
          const existing = data.fatture.find(
            (f: any) => f.operazione?.id === operazioneId
          );
          if (existing) {
            setFattura({
              id: existing.id,
              numero: existing.numero,
              nomeFile: existing.nomeFile,
              stato: existing.stato,
              dataGenerazione: existing.dataGenerazione,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    checkFattura();
  }, [operazioneId]);

  if (tipoOperazione !== "FATTURA_ATTIVA") {
    return null;
  }

  const handleGenera = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/fatture-elettroniche/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operazioneId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore nella generazione");
      }

      setFattura({
        id: data.fattura.id,
        numero: data.fattura.numero,
        nomeFile: data.fattura.nomeFile,
        stato: data.fattura.stato,
        dataGenerazione: data.fattura.dataGenerazione,
      });

      if (!data.validation.valido) {
        toast.warning(
          `Fattura generata con ${data.validation.errori.length} errori di validazione`
        );
      } else {
        toast.success(`Fattura ${data.fattura.numero} generata con successo`);
      }
    } catch (error: any) {
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!fattura) return;
    try {
      const res = await fetch(`/api/fatture-elettroniche/${fattura.id}/xml`);
      if (!res.ok) throw new Error("Errore download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fattura.nomeFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Errore nel download del file XML");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Fatturazione Elettronica
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fattura ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">
                  Fattura {fattura.numero}
                </p>
                <p className="text-xs text-muted-foreground">
                  Generata il{" "}
                  {new Date(fattura.dataGenerazione).toLocaleDateString("it-IT")}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={STATO_COLORS[fattura.stato] || ""}
              >
                {STATO_LABELS[fattura.stato] || fattura.stato}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Scarica XML
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nessuna fattura elettronica generata per questa operazione
              </p>
            </div>
            <Button size="sm" onClick={handleGenera} disabled={generating}>
              {generating && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Genera Fattura Elettronica
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
