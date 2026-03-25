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
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: number;
  ordine: number;
  descrizione: string;
  verificaAutomatica: boolean;
  queryVerifica: string | null;
  completata: boolean;
  completataAt: string | null;
};

type Scadenza = {
  id: number;
  societaId: number;
  tipo: string;
  anno: number;
  periodo: number | null;
  scadenza: string;
  stato: string;
  percentualeCompletamento: number;
  bloccataDa: string | null;
  checklist: ChecklistItem[];
  societa?: { ragioneSociale: string };
};

type CompanyProgress = {
  societaId: number;
  ragioneSociale: string;
  totale: number;
  completate: number;
  percentuale: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatoBadge(stato: string) {
  switch (stato) {
    case "PRONTA":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          Pronta
        </Badge>
      );
    case "IN_PREPARAZIONE":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          In preparazione
        </Badge>
      );
    case "NON_INIZIATA":
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          Non iniziata
        </Badge>
      );
    case "COMPLETATA":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
          Completata
        </Badge>
      );
    default:
      return <Badge variant="outline">{stato}</Badge>;
  }
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    F24_IVA: "F24 IVA",
    F24_RITENUTE: "F24 Ritenute",
    F24_ACCONTO_IRES: "Acconto IRES",
    F24_ACCONTO_IRPEF: "Acconto IRPEF",
    LIPE: "LIPE",
    CU: "Certificazione Unica",
    DICHIARAZIONE_IVA: "Dichiarazione IVA",
    DICHIARAZIONE_770: "Modello 770",
    REDDITI: "Dichiarazione Redditi",
    IRAP: "Dichiarazione IRAP",
    BILANCIO_DEPOSITO: "Deposito Bilancio",
    DIRITTO_CCIAA: "Diritto CCIAA",
    ACCONTO_IVA: "Acconto IVA",
    CONSERVAZIONE: "Conservazione",
  };
  return labels[tipo] ?? tipo;
}

function isInDateRange(dateStr: string, startDate: Date, endDate: Date): boolean {
  const d = new Date(dateStr);
  return d >= startDate && d <= endDate;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CopilotaAdempimentiContent() {
  const [scadenze, setScadenze] = useState<Scadenza[]>([]);
  const [batchScadenze, setBatchScadenze] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [genAnno, setGenAnno] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scadenzeRes, batchRes] = await Promise.all([
        fetch(`/api/scadenze-fiscali?anno=${new Date().getFullYear()}`),
        fetch("/api/scadenze-fiscali/batch"),
      ]);

      if (scadenzeRes.ok) {
        setScadenze(await scadenzeRes.json());
      }
      if (batchRes.ok) {
        setBatchScadenze(await batchRes.json());
      }
    } catch (error) {
      console.error("Errore caricamento dati copilota:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Computed data ─────────────────────────────────────────────────────────

  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in21Days = new Date(now);
  in21Days.setDate(in21Days.getDate() + 21);

  const thisWeek = scadenze.filter((s) =>
    isInDateRange(s.scadenza, now, in7Days)
  );
  const nextTwoWeeks = scadenze.filter(
    (s) => isInDateRange(s.scadenza, in7Days, in21Days)
  );

  // Group this week by type
  const thisWeekByType = thisWeek.reduce(
    (acc, s) => {
      if (!acc[s.tipo]) acc[s.tipo] = { pronta: 0, inPreparazione: 0, bloccata: 0 };
      if (s.stato === "PRONTA" || s.stato === "COMPLETATA") acc[s.tipo].pronta++;
      else if (s.stato === "IN_PREPARAZIONE") acc[s.tipo].inPreparazione++;
      else acc[s.tipo].bloccata++;
      return acc;
    },
    {} as Record<string, { pronta: number; inPreparazione: number; bloccata: number }>
  );

  // Per-company progress from batch data
  const companyProgress: CompanyProgress[] = Object.values(
    batchScadenze.reduce(
      (acc, s) => {
        const key = s.societaId;
        if (!acc[key]) {
          acc[key] = {
            societaId: s.societaId,
            ragioneSociale: s.societa?.ragioneSociale ?? `Societa ${s.societaId}`,
            totale: 0,
            completate: 0,
            percentuale: 0,
          };
        }
        acc[key].totale++;
        if (s.stato === "PRONTA" || s.stato === "COMPLETATA") {
          acc[key].completate++;
        }
        acc[key].percentuale = Math.round(
          (acc[key].completate / acc[key].totale) * 100
        );
        return acc;
      },
      {} as Record<number, CompanyProgress>
    )
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleVerifica = async (scadenzaId: number) => {
    setVerifyingId(scadenzaId);
    try {
      const res = await fetch(`/api/scadenze-fiscali/${scadenzaId}/verifica`, {
        method: "POST",
      });
      if (res.ok) {
        const updated: Scadenza = await res.json();
        setScadenze((prev) =>
          prev.map((s) => (s.id === scadenzaId ? updated : s))
        );
      }
    } catch (error) {
      console.error("Errore verifica:", error);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleBatchAction = async (action: string) => {
    setBatchLoading(action);
    const periodo = now.getMonth() + 1;
    const anno = now.getFullYear();
    try {
      const res = await fetch("/api/scadenze-fiscali/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, anno, periodo }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Errore azione batch:", error);
    } finally {
      setBatchLoading(null);
    }
  };

  const handleGenera = async () => {
    setBatchLoading("genera");
    try {
      const res = await fetch("/api/scadenze-fiscali/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: genAnno }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Errore generazione calendario:", error);
    } finally {
      setBatchLoading(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── This Week ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Questa settimana
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(thisWeekByType).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna scadenza nei prossimi 7 giorni.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(thisWeekByType).map(([tipo, counts]) => (
                <div
                  key={tipo}
                  className="rounded-lg border p-3 space-y-1"
                >
                  <p className="font-medium text-sm">{getTipoLabel(tipo)}</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-600">
                      {counts.pronta} pronte
                    </span>
                    <span className="text-yellow-600">
                      {counts.inPreparazione} in corso
                    </span>
                    <span className="text-red-600">
                      {counts.bloccata} bloccate
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Next 2 Weeks ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-500" />
            Prossime 2 settimane
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nextTwoWeeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna scadenza nelle prossime 2 settimane.
            </p>
          ) : (
            <div className="space-y-2">
              {nextTwoWeeks.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {getTipoLabel(s.tipo)}
                      </span>
                      {s.periodo && (
                        <span className="text-xs text-muted-foreground">
                          (periodo {s.periodo})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Scadenza: {formatDate(s.scadenza)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatoBadge(s.stato)}
                    <span className="text-xs font-medium">
                      {s.percentualeCompletamento}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Batch Actions ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-purple-500" />
            Azioni batch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleBatchAction("generaTuttiF24")}
              disabled={batchLoading !== null}
            >
              {batchLoading === "generaTuttiF24" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Genera tutti F24 pronti
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBatchAction("calcolaTutteLiquidazioni")}
              disabled={batchLoading !== null}
            >
              {batchLoading === "calcolaTutteLiquidazioni" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Calcola tutte liquidazioni
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={genAnno}
                onChange={(e) => setGenAnno(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-24 rounded-md border px-2 py-1.5 text-sm"
                min={2000}
                max={2100}
              />
              <Button
                variant="outline"
                onClick={handleGenera}
                disabled={batchLoading !== null}
              >
                {batchLoading === "genera" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Genera calendario {genAnno}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Per-Company Table ──────────────────────────────────────────────── */}
      {companyProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso per azienda (mese corrente)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Completate / Totale</TableHead>
                  <TableHead className="w-[200px]">Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyProgress.map((cp) => (
                  <TableRow key={cp.societaId}>
                    <TableCell className="font-medium">
                      {cp.ragioneSociale}
                    </TableCell>
                    <TableCell>
                      {cp.completate} / {cp.totale}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={cp.percentuale} className="flex-1" />
                        <span className="text-xs font-medium w-10 text-right">
                          {cp.percentuale}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Deadline Detail List ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Tutte le scadenze {new Date().getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent>
          {scadenze.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna scadenza trovata. Genera il calendario fiscale per iniziare.
            </p>
          ) : (
            <div className="space-y-2">
              {scadenze.map((s) => (
                <div key={s.id} className="rounded-lg border">
                  <button
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedId(expandedId === s.id ? null : s.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {getTipoLabel(s.tipo)}
                          </span>
                          {s.periodo && (
                            <span className="text-xs text-muted-foreground">
                              periodo {s.periodo}
                            </span>
                          )}
                          {getStatoBadge(s.stato)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Scadenza: {formatDate(s.scadenza)} &mdash;{" "}
                          {s.percentualeCompletamento}% completato
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expandedId === s.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {expandedId === s.id && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-3">
                      {s.bloccataDa && (
                        <p className="text-xs text-red-600">
                          Bloccata da: {s.bloccataDa}
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {s.checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {item.completata ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : item.verificaAutomatica ? (
                              <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400 shrink-0" />
                            )}
                            <span
                              className={
                                item.completata
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }
                            >
                              {item.descrizione}
                            </span>
                            {item.verificaAutomatica && !item.completata && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                auto
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleVerifica(s.id)}
                        disabled={verifyingId === s.id}
                      >
                        {verifyingId === s.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-3 w-3" />
                        )}
                        Verifica
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
