"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OperazioniCount {
  total: number;
  conDatiContabili: number;
}

interface BilancioVoce {
  codice: string;
  descrizione: string;
  voce: string;
  importo: number;
}

interface BilancioData {
  anno: number;
  operazioniTotali: number;
  operazioniConDatiContabili: number;
  contoEconomico: {
    voci: BilancioVoce[];
    risultatoNetto: number;
  };
  statoPatrimoniale: {
    attivo: BilancioVoce[];
    passivo: BilancioVoce[];
  };
}

type PhaseStatus = "complete" | "warning" | "pending";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  if (status === "complete") {
    return <Badge className="bg-green-100 text-green-800 border-green-300">&#10003;</Badge>;
  }
  if (status === "warning") {
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">&#9888;</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">&#9675;</Badge>;
}

// Group CE voci by section letter
function groupCeVoci(voci: BilancioVoce[]) {
  const sections: Record<string, { label: string; voci: BilancioVoce[]; totale: number }> = {
    A: { label: "A) Valore della produzione", voci: [], totale: 0 },
    B: { label: "B) Costi della produzione", voci: [], totale: 0 },
    C: { label: "C) Proventi e oneri finanziari", voci: [], totale: 0 },
    imposte: { label: "Imposte", voci: [], totale: 0 },
    altro: { label: "Altro", voci: [], totale: 0 },
  };

  for (const v of voci) {
    const letter = v.voce.charAt(0).toUpperCase();
    if (letter === "A") {
      sections.A.voci.push(v);
      sections.A.totale += v.importo;
    } else if (letter === "B") {
      sections.B.voci.push(v);
      sections.B.totale += v.importo;
    } else if (letter === "C") {
      sections.C.voci.push(v);
      sections.C.totale += v.importo;
    } else if (v.voce.toLowerCase().includes("impost")) {
      sections.imposte.voci.push(v);
      sections.imposte.totale += v.importo;
    } else {
      sections.altro.voci.push(v);
      sections.altro.totale += v.importo;
    }
  }

  return Object.entries(sections).filter(([, s]) => s.voci.length > 0);
}

export default function BilancioHubPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "provvisorio" ? "provvisorio" : "avanzamento";

  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState(initialTab);

  // Avanzamento state
  const [operazioniCount, setOperazioniCount] = useState<OperazioniCount | null>(null);
  const [anagraficheCount, setAnagraficheCount] = useState<number | null>(null);
  const [pianoContiCount, setPianoContiCount] = useState<number | null>(null);
  const [ritenuteCount, setRitenuteCount] = useState<number | null>(null);
  const [chiusuraExists, setChiusuraExists] = useState<boolean | null>(null);
  const [loadingAvanzamento, setLoadingAvanzamento] = useState(true);

  // Bilancio provvisorio state
  const [bilancioAnno, setBilancioAnno] = useState<string>(String(currentYear));
  const [bilancio, setBilancio] = useState<BilancioData | null>(null);
  const [loadingBilancio, setLoadingBilancio] = useState(false);

  // Load avanzamento data
  useEffect(() => {
    if (tab !== "avanzamento") return;
    setLoadingAvanzamento(true);

    Promise.allSettled([
      fetch("/api/operazioni?countOnly=true").then((r) => r.json()),
      fetch("/api/anagrafiche").then((r) => r.json()),
      fetch("/api/piano-dei-conti").then((r) => r.json()),
      fetch("/api/ritenute").then((r) => r.json()),
      fetch(`/api/chiusura-esercizio/${currentYear}`).then((r) => {
        if (r.status === 404) return null;
        return r.json();
      }),
    ]).then(([opResult, anagResult, pdcResult, ritResult, chiusResult]) => {
      if (opResult.status === "fulfilled") setOperazioniCount(opResult.value);
      if (anagResult.status === "fulfilled") {
        const data = anagResult.value;
        setAnagraficheCount(Array.isArray(data) ? data.length : data.data?.length ?? 0);
      }
      if (pdcResult.status === "fulfilled") {
        const data = pdcResult.value;
        setPianoContiCount(Array.isArray(data) ? data.length : 0);
      }
      if (ritResult.status === "fulfilled") {
        const data = ritResult.value;
        setRitenuteCount(Array.isArray(data) ? data.length : 0);
      }
      if (chiusResult.status === "fulfilled") {
        setChiusuraExists(chiusResult.value != null);
      } else {
        setChiusuraExists(false);
      }
      setLoadingAvanzamento(false);
    });
  }, [tab, currentYear]);

  // Load bilancio provvisorio
  const loadBilancio = useCallback(async () => {
    setLoadingBilancio(true);
    try {
      const res = await fetch(`/api/bilancio/${bilancioAnno}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setBilancio(data);
    } catch {
      toast.error("Errore nel caricamento del bilancio provvisorio");
    } finally {
      setLoadingBilancio(false);
    }
  }, [bilancioAnno]);

  useEffect(() => {
    if (tab === "provvisorio") {
      loadBilancio();
    }
  }, [tab, loadBilancio]);

  const progressPercent =
    operazioniCount && operazioniCount.total > 0
      ? Math.round((operazioniCount.conDatiContabili / operazioniCount.total) * 100)
      : 0;

  const getAnagraficheStatus = (): PhaseStatus => {
    if (anagraficheCount == null) return "pending";
    return anagraficheCount > 0 ? "complete" : "pending";
  };

  const getPianoContiStatus = (): PhaseStatus => {
    if (pianoContiCount == null) return "pending";
    return pianoContiCount > 0 ? "complete" : "pending";
  };

  const getImputazioneStatus = (): PhaseStatus => {
    if (!operazioniCount) return "pending";
    if (operazioniCount.total === 0) return "pending";
    if (operazioniCount.conDatiContabili === operazioniCount.total) return "complete";
    return "warning";
  };

  const getRitenuteStatus = (): PhaseStatus => {
    if (ritenuteCount == null) return "pending";
    return ritenuteCount > 0 ? "complete" : "pending";
  };

  const getChiusuraStatus = (): PhaseStatus => {
    if (chiusuraExists == null) return "pending";
    return chiusuraExists ? "warning" : "pending";
  };

  const phases = [
    {
      label: "Anagrafiche",
      description: anagraficheCount != null ? `${anagraficheCount} anagrafiche registrate` : "Caricamento...",
      status: getAnagraficheStatus(),
      link: "/bilancio/anagrafiche",
    },
    {
      label: "Piano dei Conti",
      description: pianoContiCount != null ? `${pianoContiCount} conti configurati` : "Caricamento...",
      status: getPianoContiStatus(),
      link: "/bilancio/piano-dei-conti",
    },
    {
      label: "Imputazione Operazioni",
      description: operazioniCount
        ? `${operazioniCount.conDatiContabili}/${operazioniCount.total} operazioni con dati contabili`
        : "Caricamento...",
      status: getImputazioneStatus(),
      link: "/operazioni",
    },
    {
      label: "Ritenute",
      description: ritenuteCount != null ? `${ritenuteCount} ritenute registrate` : "Caricamento...",
      status: getRitenuteStatus(),
      link: "/bilancio/ritenute",
    },
    {
      label: "Chiusura Esercizio",
      description: chiusuraExists ? "Chiusura avviata" : "Non ancora avviata",
      status: getChiusuraStatus(),
      link: "/bilancio/chiusura-esercizio",
    },
  ];

  const ceSections = bilancio ? groupCeVoci(bilancio.contoEconomico.voci) : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7" />
        <h1 className="text-2xl font-bold">Bilancio</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="avanzamento">Avanzamento</TabsTrigger>
          <TabsTrigger value="provvisorio">Bilancio Provvisorio</TabsTrigger>
        </TabsList>

        {/* Tab Avanzamento */}
        <TabsContent value="avanzamento" className="space-y-6">
          {loadingAvanzamento ? (
            <p className="text-center text-muted-foreground py-8">Caricamento...</p>
          ) : (
            <>
              {/* Progress bar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Completamento Dati Contabili</CardTitle>
                  <CardDescription>
                    {operazioniCount
                      ? `${operazioniCount.conDatiContabili} di ${operazioniCount.total} operazioni hanno i dati contabili`
                      : "Nessun dato disponibile"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                  </div>
                </CardContent>
              </Card>

              {/* Phase checklist */}
              <div className="space-y-3">
                {phases.map((phase, index) => (
                  <Card key={index}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <StatusBadge status={phase.status} />
                        <div>
                          <p className="font-medium">{phase.label}</p>
                          <p className="text-sm text-muted-foreground">{phase.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={phase.link}>
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab Bilancio Provvisorio */}
        <TabsContent value="provvisorio" className="space-y-6">
          <div className="flex items-center gap-4">
            <Select value={bilancioAnno} onValueChange={setBilancioAnno}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingBilancio ? (
            <p className="text-center text-muted-foreground py-8">Caricamento...</p>
          ) : bilancio ? (
            <>
              {/* Warning if not all operations have dati contabili */}
              {bilancio.operazioniConDatiContabili < bilancio.operazioniTotali && (
                <Alert>
                  <AlertDescription>
                    Attenzione: solo {bilancio.operazioniConDatiContabili} di {bilancio.operazioniTotali} operazioni
                    hanno i dati contabili assegnati. Il bilancio potrebbe non essere completo.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conto Economico */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conto Economico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ceSections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
                    ) : (
                      ceSections.map(([key, section]) => (
                        <div key={key} className="space-y-2">
                          <h3 className="text-sm font-semibold text-muted-foreground">
                            {section.label}
                          </h3>
                          <div className="border rounded-md">
                            <Table>
                              <TableBody>
                                {section.voci.map((voce, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-xs w-[80px]">
                                      {voce.codice}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {voce.descrizione}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(voce.importo)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/50">
                                  <TableCell colSpan={2} className="font-semibold text-sm">
                                    Totale {key.toUpperCase()}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-semibold text-sm">
                                    {formatCurrency(section.totale)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Risultato netto */}
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Risultato Netto</span>
                        <span
                          className={`font-mono font-bold text-lg ${
                            bilancio.contoEconomico.risultatoNetto >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(bilancio.contoEconomico.risultatoNetto)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stato Patrimoniale */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stato Patrimoniale</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Attivo */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Attivo</h3>
                      {bilancio.statoPatrimoniale.attivo.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun dato</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableBody>
                              {bilancio.statoPatrimoniale.attivo.map((voce, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-xs w-[80px]">
                                    {voce.codice}
                                  </TableCell>
                                  <TableCell className="text-sm">{voce.descrizione}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatCurrency(voce.importo)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={2} className="font-semibold text-sm">
                                  Totale Attivo
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-sm">
                                  {formatCurrency(
                                    bilancio.statoPatrimoniale.attivo.reduce((s, v) => s + v.importo, 0)
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Passivo */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Passivo</h3>
                      {bilancio.statoPatrimoniale.passivo.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun dato</p>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableBody>
                              {bilancio.statoPatrimoniale.passivo.map((voce, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-xs w-[80px]">
                                    {voce.codice}
                                  </TableCell>
                                  <TableCell className="text-sm">{voce.descrizione}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatCurrency(voce.importo)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={2} className="font-semibold text-sm">
                                  Totale Passivo
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-sm">
                                  {formatCurrency(
                                    bilancio.statoPatrimoniale.passivo.reduce((s, v) => s + v.importo, 0)
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nessun dato disponibile</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
