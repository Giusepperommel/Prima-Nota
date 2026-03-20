"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChiusuraEsercizio {
  id: number;
  anno: number;
  saldoBancaIniziale: number | null;
  saldoCassaIniziale: number | null;
  capitaleSociale: number | null;
  riservaLegale: number | null;
  riservaStatutaria: number | null;
  riservaEstraordinaria: number | null;
  utiliPerditePortatiANuovo: number | null;
  saldoBancaFinale: number | null;
  saldoCassaFinale: number | null;
  risultatoEsercizio: number | null;
  stato: string;
  rateiRisconti: RateoRisconto[];
}

interface RateoRisconto {
  id: number;
  tipo: string;
  descrizione: string;
  importoOriginario: number;
  importoCalcolato: number;
  dataInizioCompetenza: string;
  dataFineCompetenza: string;
  voceSp: string | null;
}

interface PropostaRateo {
  operazioneId: number;
  tipo: string;
  descrizione: string;
  importoOriginario: number;
  importoCalcolato: number;
  dataInizioCompetenza: string;
  dataFineCompetenza: string;
  dataManifestazioneFin: string;
  voceSp: string;
  giorniTotali: number;
  giorniFuturi: number;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function ChiusuraEsercizioContent() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [anno, setAnno] = useState<string>(String(currentYear));
  const [chiusura, setChiusura] = useState<ChiusuraEsercizio | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 form
  const [saldoBancaIniziale, setSaldoBancaIniziale] = useState("");
  const [saldoCassaIniziale, setSaldoCassaIniziale] = useState("");
  const [capitaleSociale, setCapitaleSociale] = useState("");
  const [riservaLegale, setRiservaLegale] = useState("");
  const [riservaEstraordinaria, setRiservaEstraordinaria] = useState("");
  const [utiliPerditePortatiANuovo, setUtiliPerditePortatiANuovo] = useState("");

  // Step 2
  const [operazioniIncomplete, setOperazioniIncomplete] = useState<{
    total: number;
    conDatiContabili: number;
  } | null>(null);

  // Step 3
  const [proposteRatei, setProposteRatei] = useState<PropostaRateo[]>([]);
  const [selectedRatei, setSelectedRatei] = useState<Set<number>>(new Set());
  const [calcolandoRatei, setCalcolandoRatei] = useState(false);

  // Step 4
  const [saldoBancaFinale, setSaldoBancaFinale] = useState("");

  const loadChiusura = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chiusura-esercizio/${anno}`);
      if (res.status === 404) {
        setChiusura(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setChiusura(data);

      // Pre-fill form fields
      setSaldoBancaIniziale(data.saldoBancaIniziale != null ? String(data.saldoBancaIniziale) : "");
      setSaldoCassaIniziale(data.saldoCassaIniziale != null ? String(data.saldoCassaIniziale) : "");
      setCapitaleSociale(data.capitaleSociale != null ? String(data.capitaleSociale) : "");
      setRiservaLegale(data.riservaLegale != null ? String(data.riservaLegale) : "");
      setRiservaEstraordinaria(data.riservaEstraordinaria != null ? String(data.riservaEstraordinaria) : "");
      setUtiliPerditePortatiANuovo(data.utiliPerditePortatiANuovo != null ? String(data.utiliPerditePortatiANuovo) : "");
      setSaldoBancaFinale(data.saldoBancaFinale != null ? String(data.saldoBancaFinale) : "");
    } catch {
      toast.error("Errore nel caricamento della chiusura esercizio");
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    loadChiusura();
  }, [loadChiusura]);

  const createChiusura = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/chiusura-esercizio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: parseInt(anno, 10) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione");
      }
      toast.success("Chiusura esercizio creata");
      await loadChiusura();
    } catch (e: any) {
      toast.error(e.message || "Errore nella creazione");
    } finally {
      setSaving(false);
    }
  };

  // Step 1: Save saldi di apertura
  const saveSaldiApertura = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      if (saldoBancaIniziale) payload.saldoBancaIniziale = parseFloat(saldoBancaIniziale);
      if (saldoCassaIniziale) payload.saldoCassaIniziale = parseFloat(saldoCassaIniziale);
      if (capitaleSociale) payload.capitaleSociale = parseFloat(capitaleSociale);
      if (riservaLegale) payload.riservaLegale = parseFloat(riservaLegale);
      if (riservaEstraordinaria) payload.riservaEstraordinaria = parseFloat(riservaEstraordinaria);
      if (utiliPerditePortatiANuovo) payload.utiliPerditePortatiANuovo = parseFloat(utiliPerditePortatiANuovo);

      const res = await fetch(`/api/chiusura-esercizio/${anno}/saldi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      toast.success("Saldi di apertura salvati");
      setCurrentStep(2);
      await loadChiusura();
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Load operazioni incomplete
  useEffect(() => {
    if (currentStep === 2) {
      fetch("/api/operazioni?countOnly=true")
        .then((res) => res.json())
        .then((data) => setOperazioniIncomplete(data))
        .catch(() => toast.error("Errore nel caricamento operazioni"));
    }
  }, [currentStep]);

  // Step 3: Calcola ratei
  const calcolaRatei = async () => {
    setCalcolandoRatei(true);
    try {
      const res = await fetch(`/api/chiusura-esercizio/${anno}/calcola-ratei`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calcola: true }),
      });
      if (!res.ok) throw new Error("Errore nel calcolo");
      const data = await res.json();
      setProposteRatei(data.proposte);
      // Select all by default
      setSelectedRatei(new Set(data.proposte.map((_: PropostaRateo, i: number) => i)));
    } catch {
      toast.error("Errore nel calcolo dei ratei e risconti");
    } finally {
      setCalcolandoRatei(false);
    }
  };

  const confermaRatei = async () => {
    setSaving(true);
    try {
      const selected = proposteRatei.filter((_, i) => selectedRatei.has(i));
      const res = await fetch(`/api/chiusura-esercizio/${anno}/calcola-ratei`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conferma: true, rateiRisconti: selected }),
      });
      if (!res.ok) throw new Error("Errore nella conferma");
      toast.success("Ratei e risconti salvati");
      setCurrentStep(4);
      await loadChiusura();
    } catch {
      toast.error("Errore nella conferma dei ratei e risconti");
    } finally {
      setSaving(false);
    }
  };

  // Step 4: Save saldo banca finale
  const saveSaldoBancaFinale = async () => {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      if (saldoBancaFinale) payload.saldoBancaFinale = parseFloat(saldoBancaFinale);

      const res = await fetch(`/api/chiusura-esercizio/${anno}/saldi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      toast.success("Saldo banca finale salvato");
      setCurrentStep(5);
      await loadChiusura();
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const toggleRateo = (index: number) => {
    setSelectedRatei((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const steps = [
    { num: 1, label: "Saldi di Apertura" },
    { num: 2, label: "Operazioni Incomplete" },
    { num: 3, label: "Ratei e Risconti" },
    { num: 4, label: "Saldo Banca Finale" },
    { num: 5, label: "Risultato" },
  ];

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-center text-muted-foreground py-8">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chiusura Esercizio</h1>
        <Select value={anno} onValueChange={(v) => { setAnno(v); setCurrentStep(1); }}>
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

      {/* If no chiusura exists, show creation button */}
      {!chiusura ? (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Avvia Chiusura Esercizio {anno}</CardTitle>
            <CardDescription>
              Non esiste ancora una chiusura esercizio per l&apos;anno {anno}.
              Crea il record per iniziare il processo.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={createChiusura} disabled={saving} className="w-full">
              {saving ? "Creazione..." : `Crea Chiusura ${anno}`}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {steps.map((step) => (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num)}
                className="flex items-center gap-2"
              >
                <Badge
                  variant={currentStep === step.num ? "default" : "outline"}
                  className={`h-8 w-8 rounded-full flex items-center justify-center p-0 cursor-pointer ${
                    currentStep > step.num
                      ? "bg-green-100 text-green-800 border-green-300"
                      : currentStep === step.num
                        ? ""
                        : "text-muted-foreground"
                  }`}
                >
                  {step.num}
                </Badge>
                <span
                  className={`text-sm hidden sm:inline ${
                    currentStep === step.num ? "font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {step.num < 5 && <span className="text-muted-foreground mx-1 hidden sm:inline">/</span>}
              </button>
            ))}
          </div>

          {/* Step 1: Saldi di Apertura */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>1. Saldi di Apertura</CardTitle>
                <CardDescription>
                  Inserisci i saldi iniziali dell&apos;esercizio {anno}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="saldoBancaIniziale">Saldo Banca Iniziale</Label>
                    <Input
                      id="saldoBancaIniziale"
                      type="number"
                      step="0.01"
                      value={saldoBancaIniziale}
                      onChange={(e) => setSaldoBancaIniziale(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="saldoCassaIniziale">Saldo Cassa Iniziale</Label>
                    <Input
                      id="saldoCassaIniziale"
                      type="number"
                      step="0.01"
                      value={saldoCassaIniziale}
                      onChange={(e) => setSaldoCassaIniziale(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capitaleSociale">Capitale Sociale</Label>
                    <Input
                      id="capitaleSociale"
                      type="number"
                      step="0.01"
                      value={capitaleSociale}
                      onChange={(e) => setCapitaleSociale(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riservaLegale">Riserva Legale</Label>
                    <Input
                      id="riservaLegale"
                      type="number"
                      step="0.01"
                      value={riservaLegale}
                      onChange={(e) => setRiservaLegale(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riservaEstraordinaria">Riserva Straordinaria</Label>
                    <Input
                      id="riservaEstraordinaria"
                      type="number"
                      step="0.01"
                      value={riservaEstraordinaria}
                      onChange={(e) => setRiservaEstraordinaria(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utiliPerditePortatiANuovo">Utili/Perdite Portati a Nuovo</Label>
                    <Input
                      id="utiliPerditePortatiANuovo"
                      type="number"
                      step="0.01"
                      value={utiliPerditePortatiANuovo}
                      onChange={(e) => setUtiliPerditePortatiANuovo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveSaldiApertura} disabled={saving}>
                    {saving ? "Salvataggio..." : "Salva e Prosegui"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Operazioni Incomplete */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>2. Operazioni Incomplete</CardTitle>
                <CardDescription>
                  Verifica che tutte le operazioni abbiano i dati contabili assegnati.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {operazioniIncomplete ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="font-semibold">{operazioniIncomplete.conDatiContabili}</span>{" "}
                        / {operazioniIncomplete.total} operazioni con dati contabili
                      </div>
                      {operazioniIncomplete.total - operazioniIncomplete.conDatiContabili > 0 && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          {operazioniIncomplete.total - operazioniIncomplete.conDatiContabili} incomplete
                        </Badge>
                      )}
                    </div>
                    {operazioniIncomplete.total - operazioniIncomplete.conDatiContabili > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => router.push("/operazioni")}
                      >
                        Vai alle Operazioni
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Caricamento...</p>
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Indietro
                  </Button>
                  <Button onClick={() => setCurrentStep(3)}>
                    Prosegui
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Ratei e Risconti */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>3. Ratei e Risconti</CardTitle>
                <CardDescription>
                  Calcola e conferma i ratei e risconti per l&apos;esercizio {anno}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show existing ratei if any */}
                {chiusura.rateiRisconti.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Ratei/Risconti salvati:</h3>
                    <div className="border rounded-md divide-y">
                      {chiusura.rateiRisconti.map((rr) => (
                        <div key={rr.id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <div>
                            <Badge variant="outline" className="mr-2">{rr.tipo}</Badge>
                            {rr.descrizione}
                          </div>
                          <span className="font-mono">{formatCurrency(rr.importoCalcolato)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {proposteRatei.length === 0 ? (
                  <Button onClick={calcolaRatei} disabled={calcolandoRatei}>
                    {calcolandoRatei ? "Calcolo in corso..." : "Calcola Ratei e Risconti"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Proposte calcolate:</h3>
                    <div className="border rounded-md divide-y">
                      {proposteRatei.map((proposta, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <Checkbox
                            checked={selectedRatei.has(index)}
                            onCheckedChange={() => toggleRateo(index)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{proposta.tipo}</Badge>
                              <span className="text-sm truncate">{proposta.descrizione}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Importo originario: {formatCurrency(proposta.importoOriginario)} |{" "}
                              Giorni: {proposta.giorniFuturi}/{proposta.giorniTotali}
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold">
                            {formatCurrency(proposta.importoCalcolato)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button onClick={confermaRatei} disabled={saving || selectedRatei.size === 0}>
                      {saving ? "Salvataggio..." : `Conferma ${selectedRatei.size} Ratei/Risconti`}
                    </Button>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Indietro
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    Salta / Prosegui
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Saldo Banca Finale */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>4. Saldo Banca Finale</CardTitle>
                <CardDescription>
                  Inserisci il saldo banca al 31/12/{anno}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="saldoBancaFinale">Saldo Banca Finale</Label>
                  <Input
                    id="saldoBancaFinale"
                    type="number"
                    step="0.01"
                    value={saldoBancaFinale}
                    onChange={(e) => setSaldoBancaFinale(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Indietro
                  </Button>
                  <Button onClick={saveSaldoBancaFinale} disabled={saving}>
                    {saving ? "Salvataggio..." : "Salva e Prosegui"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Risultato */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle>5. Risultato</CardTitle>
                <CardDescription>
                  Riepilogo della chiusura esercizio {anno}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Saldo Banca Iniziale</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.saldoBancaIniziale)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Saldo Cassa Iniziale</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.saldoCassaIniziale)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Capitale Sociale</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.capitaleSociale)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Riserva Legale</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.riservaLegale)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Riserva Straordinaria</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.riservaEstraordinaria)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Utili/Perdite a Nuovo</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.utiliPerditePortatiANuovo)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Saldo Banca Finale</p>
                    <p className="font-mono font-semibold">{formatCurrency(chiusura.saldoBancaFinale)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Risultato Esercizio</p>
                    <p className={`font-mono font-semibold ${
                      chiusura.risultatoEsercizio != null && chiusura.risultatoEsercizio < 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}>
                      {formatCurrency(chiusura.risultatoEsercizio)}
                    </p>
                  </div>
                </div>

                {chiusura.rateiRisconti.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Ratei e Risconti ({chiusura.rateiRisconti.length})</h3>
                    <div className="border rounded-md divide-y">
                      {chiusura.rateiRisconti.map((rr) => (
                        <div key={rr.id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <div>
                            <Badge variant="outline" className="mr-2">{rr.tipo}</Badge>
                            {rr.descrizione}
                          </div>
                          <span className="font-mono">{formatCurrency(rr.importoCalcolato)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    Indietro
                  </Button>
                  <Button onClick={() => router.push("/bilancio?tab=provvisorio")}>
                    Visualizza Bilancio Provvisorio
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
