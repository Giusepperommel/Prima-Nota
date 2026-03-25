"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type HealthScore = {
  areaContabilita: number;
  areaIva: number;
  areaScadenze: number;
  areaDocumentale: number;
  areaBanca: number;
  scoreComplessivo: number;
};

type MultiScore = {
  societaId: number;
  ragioneSociale: string;
  score: number;
  areaContabilita: number;
  areaIva: number;
  areaScadenze: number;
  areaDocumentale: number;
  areaBanca: number;
};

type Anomalia = {
  id: number;
  tipo: string;
  sorgente: string;
  priorita: string;
  titolo: string;
  descrizione: string;
  stato: string;
  entityType?: string;
  entityId?: number;
  createdAt: string;
};

function getScoreColor(score: number): string {
  if (score > 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score > 80) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getPriorityBadge(priorita: string) {
  switch (priorita) {
    case "CRITICA":
      return <Badge variant="destructive">Critica</Badge>;
    case "ALTA":
      return <Badge className="bg-orange-500 text-white">Alta</Badge>;
    case "MEDIA":
      return <Badge variant="secondary">Media</Badge>;
    case "BASSA":
      return <Badge variant="outline">Bassa</Badge>;
    default:
      return <Badge variant="outline">{priorita}</Badge>;
  }
}

const AREA_LABELS: { key: keyof Omit<HealthScore, "scoreComplessivo">; label: string }[] = [
  { key: "areaContabilita", label: "Contabilit\u00e0" },
  { key: "areaIva", label: "IVA" },
  { key: "areaScadenze", label: "Scadenze" },
  { key: "areaDocumentale", label: "Documentale" },
  { key: "areaBanca", label: "Banca" },
];

export function SaluteAziendaContent({
  isCommercialista,
}: {
  isCommercialista: boolean;
}) {
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [multiScores, setMultiScores] = useState<MultiScore[]>([]);
  const [anomalie, setAnomalie] = useState<Anomalia[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, anomalieRes] = await Promise.all([
        fetch("/api/health-score"),
        fetch("/api/controlli?stato=APERTA"),
      ]);

      if (scoreRes.ok) {
        setHealthScore(await scoreRes.json());
      }
      if (anomalieRes.ok) {
        const data: Anomalia[] = await anomalieRes.json();
        // Sort by priority: CRITICA first
        const priorityOrder: Record<string, number> = {
          CRITICA: 0,
          ALTA: 1,
          MEDIA: 2,
          BASSA: 3,
        };
        data.sort(
          (a, b) =>
            (priorityOrder[a.priorita] ?? 4) - (priorityOrder[b.priorita] ?? 4)
        );
        setAnomalie(data);
      }

      if (isCommercialista) {
        const multiRes = await fetch("/api/health-score/multi");
        if (multiRes.ok) {
          setMultiScores(await multiRes.json());
        }
      }
    } catch (error) {
      console.error("Errore caricamento dati salute:", error);
    } finally {
      setLoading(false);
    }
  }, [isCommercialista]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunChecks = async () => {
    setRunningChecks(true);
    try {
      const res = await fetch("/api/controlli", { method: "POST" });
      if (res.ok) {
        // Refresh data after checks
        await fetchData();
      }
    } catch (error) {
      console.error("Errore esecuzione controlli:", error);
    } finally {
      setRunningChecks(false);
    }
  };

  const handleResolve = async (id: number, stato: string) => {
    try {
      const res = await fetch(`/api/controlli/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato }),
      });
      if (res.ok) {
        // Remove from list
        setAnomalie((prev) => prev.filter((a) => a.id !== id));
        // Refresh score
        const scoreRes = await fetch("/api/health-score");
        if (scoreRes.ok) {
          setHealthScore(await scoreRes.json());
        }
      }
    } catch (error) {
      console.error("Errore risoluzione anomalia:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Salute Azienda</h2>
          <p className="text-muted-foreground">
            Panoramica dello stato di salute contabile
          </p>
        </div>
        <Button onClick={handleRunChecks} disabled={runningChecks}>
          {runningChecks ? "Esecuzione controlli..." : "Esegui controlli"}
        </Button>
      </div>

      {/* Overall Score */}
      {healthScore && (
        <Card>
          <CardHeader>
            <CardTitle>Punteggio complessivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div
                className={`text-6xl font-bold ${getScoreColor(healthScore.scoreComplessivo)}`}
              >
                {healthScore.scoreComplessivo}
              </div>
              <div className="text-lg text-muted-foreground">/100</div>
              <div className="flex-1">
                <div
                  className="h-4 rounded-full bg-muted overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full transition-all ${getScoreBg(healthScore.scoreComplessivo)}`}
                    style={{ width: `${healthScore.scoreComplessivo}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-area bars */}
      {healthScore && (
        <Card>
          <CardHeader>
            <CardTitle>Dettaglio per area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {AREA_LABELS.map(({ key, label }) => {
              const value = healthScore[key];
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className={getScoreColor(value)}>{value}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getScoreBg(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Open anomalies */}
      <Card>
        <CardHeader>
          <CardTitle>
            Anomalie aperte{" "}
            {anomalie.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {anomalie.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {anomalie.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nessuna anomalia aperta. Ottimo lavoro!
            </p>
          ) : (
            <div className="space-y-3">
              {anomalie.map((anomalia) => (
                <div
                  key={anomalia.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(anomalia.priorita)}
                      <span className="font-medium">{anomalia.titolo}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {anomalia.descrizione}
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>Tipo: {anomalia.tipo}</span>
                      <span>-</span>
                      <span>
                        {new Date(anomalia.createdAt).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(anomalia.id, "RISOLTA")}
                    >
                      Risolvi
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolve(anomalia.id, "IGNORATA")}
                    >
                      Ignora
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-company view for commercialista */}
      {isCommercialista && multiScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Panoramica aziende</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Azienda</TableHead>
                  <TableHead className="text-center">Punteggio</TableHead>
                  <TableHead className="text-center">Contabilit&agrave;</TableHead>
                  <TableHead className="text-center">IVA</TableHead>
                  <TableHead className="text-center">Scadenze</TableHead>
                  <TableHead className="text-center">Documentale</TableHead>
                  <TableHead className="text-center">Banca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multiScores.map((ms) => (
                  <TableRow key={ms.societaId}>
                    <TableCell className="font-medium">
                      {ms.ragioneSociale}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-bold ${getScoreColor(ms.score)}`}
                      >
                        {ms.score}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getScoreColor(ms.areaContabilita)}>
                        {ms.areaContabilita}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getScoreColor(ms.areaIva)}>
                        {ms.areaIva}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getScoreColor(ms.areaScadenze)}>
                        {ms.areaScadenze}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getScoreColor(ms.areaDocumentale)}>
                        {ms.areaDocumentale}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={getScoreColor(ms.areaBanca)}>
                        {ms.areaBanca}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
