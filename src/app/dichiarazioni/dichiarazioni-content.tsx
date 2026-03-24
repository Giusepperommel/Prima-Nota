"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  CreditCard,
  Users,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScadenzaItem = {
  data: string;
  descrizione: string;
  tipo: string;
  giorniMancanti: number;
};

type F24Item = {
  id: number;
  anno: number;
  mese: number;
  dataScadenza: string;
  dataPagamento: string | null;
  stato: string;
  totaleDebito: number;
  totaleCredito: number;
  totaleVersamento: number;
  righe: {
    id: number;
    sezione: string;
    codiceTributo: string;
    annoRiferimento: number;
    periodoRiferimento: string | null;
    importoDebito: number;
    importoCredito: number;
    descrizione: string | null;
  }[];
};

type CUItem = {
  id: number;
  anno: number;
  anagraficaId: number;
  causaleCu: string;
  ammontareLordo: number;
  imponibile: number;
  ritenutaAcconto: number;
  rivalsaInps: number;
  cassaPrevidenza: number;
  stato: string;
  dataGenerazione: string | null;
  anagrafica: {
    id: number;
    denominazione: string;
    codiceFiscale: string | null;
    partitaIva: string | null;
  };
};

type RiepilogoData = {
  anno: number;
  prossimeScadenze: ScadenzaItem[];
  f24: {
    daPagare: number;
    pagati: number;
    scaduti: number;
    totaleDaPagare: number;
    totalePagato: number;
  };
  cu: { bozza: number; generate: number; inviate: number };
  ritenute: {
    daVersare: number;
    versate: number;
    scadute: number;
    totaleRitenute: number;
  };
  dichiarazioni: {
    tipo: string;
    stato: string;
    dataGenerazione: string | null;
    dataInvio: string | null;
  }[];
};

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function formatCurrency(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("it-IT");
}

function statoBadge(stato: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    DA_PAGARE: { variant: "outline", label: "Da pagare" },
    PAGATO: { variant: "default", label: "Pagato" },
    SCADUTO: { variant: "destructive", label: "Scaduto" },
    BOZZA: { variant: "outline", label: "Bozza" },
    GENERATA: { variant: "secondary", label: "Generata" },
    INVIATA: { variant: "default", label: "Inviata" },
    NON_INIZIATA: { variant: "outline", label: "Non iniziata" },
    IN_PREPARAZIONE: { variant: "secondary", label: "In preparazione" },
  };
  const cfg = map[stato] ?? { variant: "outline" as const, label: stato };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function DichiarazioniContent() {
  const currentYear = new Date().getFullYear();
  const [anno, setAnno] = useState(currentYear);
  const [riepilogo, setRiepilogo] = useState<RiepilogoData | null>(null);
  const [f24List, setF24List] = useState<F24Item[]>([]);
  const [cuList, setCuList] = useState<CUItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generaF24Open, setGeneraF24Open] = useState(false);
  const [f24Mese, setF24Mese] = useState(new Date().getMonth()); // 0-indexed prev month
  const [pagaF24Open, setPagaF24Open] = useState(false);
  const [pagaF24Id, setPagaF24Id] = useState<number | null>(null);
  const [pagaF24Data, setPagaF24Data] = useState("");

  const fetchRiepilogo = useCallback(async () => {
    try {
      const res = await fetch(`/api/dichiarazioni/riepilogo?anno=${anno}`);
      if (res.ok) setRiepilogo(await res.json());
    } catch {
      // silent
    }
  }, [anno]);

  const fetchF24 = useCallback(async () => {
    try {
      const res = await fetch(`/api/dichiarazioni/f24?anno=${anno}`);
      if (res.ok) setF24List(await res.json());
    } catch {
      // silent
    }
  }, [anno]);

  const fetchCU = useCallback(async () => {
    try {
      const res = await fetch(`/api/dichiarazioni/cu?anno=${anno}`);
      if (res.ok) setCuList(await res.json());
    } catch {
      // silent
    }
  }, [anno]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRiepilogo(), fetchF24(), fetchCU()]);
    setLoading(false);
  }, [fetchRiepilogo, fetchF24, fetchCU]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleGeneraF24 = async () => {
    try {
      const res = await fetch("/api/dichiarazioni/f24/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, mese: f24Mese + 1 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`F24 generato per ${MESI[f24Mese]} ${anno}`);
        setGeneraF24Open(false);
        loadAll();
      } else {
        toast.error(data.error ?? "Errore nella generazione");
      }
    } catch {
      toast.error("Errore di rete");
    }
  };

  const handlePagaF24 = async () => {
    if (!pagaF24Id || !pagaF24Data) return;
    try {
      const res = await fetch(`/api/dichiarazioni/f24/${pagaF24Id}/paga`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataPagamento: pagaF24Data }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("F24 segnato come pagato");
        setPagaF24Open(false);
        loadAll();
      } else {
        toast.error(data.error ?? "Errore");
      }
    } catch {
      toast.error("Errore di rete");
    }
  };

  const handleGeneraCU = async () => {
    try {
      const res = await fetch("/api/dichiarazioni/cu/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`CU generate: ${data.totalePercipienti} percipienti`);
        if (data.warnings?.length) {
          data.warnings.forEach((w: string) => toast.warning(w));
        }
        loadAll();
      } else {
        toast.error(data.error ?? "Errore nella generazione CU");
      }
    } catch {
      toast.error("Errore di rete");
    }
  };

  const handleExportCU = () => {
    if (cuList.length === 0) {
      toast.error("Nessuna CU da esportare");
      return;
    }
    const csv = [
      "Anno,Percipiente,CF,P.IVA,Causale,Lordo,Imponibile,Ritenuta,Rivalsa INPS,Cassa Prev.,Stato",
      ...cuList.map((c) =>
        [
          c.anno,
          `"${c.anagrafica.denominazione}"`,
          c.anagrafica.codiceFiscale ?? "",
          c.anagrafica.partitaIva ?? "",
          c.causaleCu,
          c.ammontareLordo.toFixed(2),
          c.imponibile.toFixed(2),
          c.ritenutaAcconto.toFixed(2),
          c.rivalsaInps.toFixed(2),
          c.cassaPrevidenza.toFixed(2),
          c.stato,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CU_${anno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label>Anno fiscale</Label>
          <Select value={String(anno)} onValueChange={(v) => setAnno(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {riepilogo && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">F24 da pagare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riepilogo.f24.daPagare}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(riepilogo.f24.totaleDaPagare)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">F24 pagati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riepilogo.f24.pagati}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(riepilogo.f24.totalePagato)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CU generate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riepilogo.cu.generate + riepilogo.cu.inviate}</div>
              <p className="text-xs text-muted-foreground">
                {riepilogo.cu.inviate} inviate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ritenute</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(riepilogo.ritenute.totaleRitenute)}
              </div>
              <p className="text-xs text-muted-foreground">
                {riepilogo.ritenute.daVersare} da versare
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="scadenze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scadenze">
            <Calendar className="h-4 w-4 mr-2" /> Scadenze
          </TabsTrigger>
          <TabsTrigger value="f24">
            <CreditCard className="h-4 w-4 mr-2" /> F24
          </TabsTrigger>
          <TabsTrigger value="cu">
            <Users className="h-4 w-4 mr-2" /> CU
          </TabsTrigger>
          <TabsTrigger value="redditi">
            <Calculator className="h-4 w-4 mr-2" /> Redditi / IRAP
          </TabsTrigger>
        </TabsList>

        {/* SCADENZE TAB */}
        <TabsContent value="scadenze">
          <Card>
            <CardHeader>
              <CardTitle>Prossime Scadenze Fiscali</CardTitle>
              <CardDescription>Scadenze nei prossimi 60 giorni</CardDescription>
            </CardHeader>
            <CardContent>
              {riepilogo?.prossimeScadenze.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessuna scadenza imminente</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Adempimento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Giorni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riepilogo?.prossimeScadenze.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDate(s.data)}</TableCell>
                        <TableCell>{s.descrizione}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.tipo}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={s.giorniMancanti <= 7 ? "text-red-500 font-bold" : s.giorniMancanti <= 14 ? "text-orange-500" : ""}>
                            {s.giorniMancanti}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* F24 TAB */}
        <TabsContent value="f24">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Versamenti F24</CardTitle>
                <CardDescription>Gestione modelli F24 per l&#39;anno {anno}</CardDescription>
              </div>
              <Button onClick={() => setGeneraF24Open(true)}>
                <FileText className="h-4 w-4 mr-2" /> Genera F24
              </Button>
            </CardHeader>
            <CardContent>
              {f24List.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessun F24 generato per quest&#39;anno</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead className="text-right">Debito</TableHead>
                      <TableHead className="text-right">Credito</TableHead>
                      <TableHead className="text-right">Versamento</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f24List.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{MESI[f.mese - 1]} {f.anno}</TableCell>
                        <TableCell>{formatDate(f.dataScadenza)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.totaleDebito)}</TableCell>
                        <TableCell className="text-right">
                          {f.totaleCredito > 0 ? formatCurrency(f.totaleCredito) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(f.totaleVersamento)}
                        </TableCell>
                        <TableCell>{statoBadge(f.stato)}</TableCell>
                        <TableCell>{formatDate(f.dataPagamento)}</TableCell>
                        <TableCell>
                          {f.stato === "DA_PAGARE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPagaF24Id(f.id);
                                setPagaF24Data(new Date().toISOString().split("T")[0]);
                                setPagaF24Open(true);
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Paga
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* F24 detail: show righe for the first unpaid */}
              {f24List.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">Dettaglio righe ultimo F24</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sezione</TableHead>
                        <TableHead>Codice Tributo</TableHead>
                        <TableHead>Periodo</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Debito</TableHead>
                        <TableHead className="text-right">Credito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f24List[0].righe.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant="outline">{r.sezione}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">{r.codiceTributo}</TableCell>
                          <TableCell>
                            {r.periodoRiferimento ?? ""} / {r.annoRiferimento}
                          </TableCell>
                          <TableCell>{r.descrizione}</TableCell>
                          <TableCell className="text-right">
                            {r.importoDebito > 0 ? formatCurrency(r.importoDebito) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.importoCredito > 0 ? formatCurrency(r.importoCredito) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CU TAB */}
        <TabsContent value="cu">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Certificazioni Uniche</CardTitle>
                <CardDescription>CU per l&#39;anno {anno}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCU}>
                  <Download className="h-4 w-4 mr-2" /> Esporta CSV
                </Button>
                <Button onClick={handleGeneraCU}>
                  <FileText className="h-4 w-4 mr-2" /> Genera CU
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cuList.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessuna CU generata per quest&#39;anno</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Percipiente</TableHead>
                      <TableHead>CF</TableHead>
                      <TableHead>Causale</TableHead>
                      <TableHead className="text-right">Lordo</TableHead>
                      <TableHead className="text-right">Imponibile</TableHead>
                      <TableHead className="text-right">Ritenuta</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Generata il</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuList.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.anagrafica.denominazione}</TableCell>
                        <TableCell className="font-mono text-xs">{c.anagrafica.codiceFiscale ?? "-"}</TableCell>
                        <TableCell>{c.causaleCu}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.ammontareLordo)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.imponibile)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.ritenutaAcconto)}</TableCell>
                        <TableCell>{statoBadge(c.stato)}</TableCell>
                        <TableCell>{formatDate(c.dataGenerazione)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REDDITI TAB */}
        <TabsContent value="redditi">
          <Card>
            <CardHeader>
              <CardTitle>Riepilogo Redditi / IRAP</CardTitle>
              <CardDescription>
                Stato delle dichiarazioni annuali per il {anno}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riepilogo?.dichiarazioni && riepilogo.dichiarazioni.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dichiarazione</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Generata</TableHead>
                        <TableHead>Inviata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riepilogo.dichiarazioni.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {d.tipo === "REDDITI_SC" ? "Modello Redditi SC" :
                             d.tipo === "IRAP" ? "Dichiarazione IRAP" :
                             d.tipo === "MOD_770" ? "Modello 770" : d.tipo}
                          </TableCell>
                          <TableCell>{statoBadge(d.stato)}</TableCell>
                          <TableCell>{formatDate(d.dataGenerazione)}</TableCell>
                          <TableCell>{formatDate(d.dataInvio)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Modello Redditi SC</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Non iniziata</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Scadenza: 30 novembre {anno}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Dichiarazione IRAP</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Non iniziata</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Scadenza: 30 novembre {anno}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Modello 770</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Non iniziata</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Scadenza: 31 ottobre {anno}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Le dichiarazioni verranno compilate dal bilancio e dalle ritenute dell&#39;anno {anno - 1}.
                      I dati calcolati potranno essere esportati per l&#39;importazione nel software fiscale del commercialista.
                    </p>
                  </div>
                )}

                {/* Ritenute summary for 770 */}
                {riepilogo && riepilogo.ritenute.totaleRitenute > 0 && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Riepilogo Ritenute per 770</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Totale operate</span>
                          <p className="font-medium">{formatCurrency(riepilogo.ritenute.totaleRitenute)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Versate</span>
                          <p className="font-medium text-green-600">{riepilogo.ritenute.versate}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Da versare</span>
                          <p className="font-medium text-orange-600">{riepilogo.ritenute.daVersare}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Scadute</span>
                          <p className="font-medium text-red-600">{riepilogo.ritenute.scadute}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Genera F24 */}
      <Dialog open={generaF24Open} onOpenChange={setGeneraF24Open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Genera F24</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mese di competenza</Label>
              <Select value={String(f24Mese)} onValueChange={(v) => setF24Mese(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESI.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m} {anno}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Verranno incluse le ritenute da versare per il mese selezionato.
              IVA e imposte dirette possono essere aggiunte manualmente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGeneraF24Open(false)}>Annulla</Button>
            <Button onClick={handleGeneraF24}>Genera</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Paga F24 */}
      <Dialog open={pagaF24Open} onOpenChange={setPagaF24Open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra pagamento F24</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data pagamento</Label>
              <Input
                type="date"
                value={pagaF24Data}
                onChange={(e) => setPagaF24Data(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagaF24Open(false)}>Annulla</Button>
            <Button onClick={handlePagaF24}>Conferma pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
