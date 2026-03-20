"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Save, Loader2, Plus } from "lucide-react";
import { calcolaRitenuta } from "@/lib/calcoli-ritenuta";
import { suggerisciConto } from "@/lib/mapping-categoria-conto";
import { formatCurrency } from "@/lib/business-utils";

type Anagrafica = {
  id: number;
  denominazione: string;
  partitaIva: string | null;
  tipo: string;
  regimeForfettario: boolean;
  soggettoARitenuta: boolean;
  tipoRitenuta: string | null;
};

type Conto = {
  id: number;
  codice: string;
  descrizione: string;
};

type RitenutaData = {
  tipoRitenuta: string;
  aliquota: number;
  percentualeImponibile: number;
  importoLordo: number;
  baseImponibile: number;
  importoRitenuta: number;
  importoNetto: number;
  rivalsaInps: number | null;
  cassaPrevidenza: number | null;
  meseCompetenza: number;
  annoCompetenza: number;
  codiceTributo: string;
};

export type DatiContabiliTabProps = {
  operazioneId: number;
  tipoOperazione: string;
  importoTotale: number;
  importoIva: number;
  categoriaName?: string;
  hasPianoPagamento: boolean;
  initialData?: any;
  onSaved?: () => void;
};

const NATURA_IVA_OPTIONS = [
  { value: "N1", label: "N1 - Escluse art. 15" },
  { value: "N2_1", label: "N2.1 - Non soggette art. 7" },
  { value: "N2_2", label: "N2.2 - Non soggette altri casi" },
  { value: "N3_1", label: "N3.1 - Non imponibili esportazioni" },
  { value: "N3_2", label: "N3.2 - Non imponibili cessioni intra" },
  { value: "N3_3", label: "N3.3 - Non imponibili verso San Marino" },
  { value: "N3_4", label: "N3.4 - Non imponibili assimilate" },
  { value: "N3_5", label: "N3.5 - Non imponibili a seguito dichiarazioni intento" },
  { value: "N3_6", label: "N3.6 - Non imponibili altre" },
  { value: "N4", label: "N4 - Esenti" },
  { value: "N5", label: "N5 - Regime del margine" },
  { value: "N6_1", label: "N6.1 - Reverse charge cessione rottami" },
  { value: "N6_2", label: "N6.2 - Reverse charge cessione oro/argento" },
  { value: "N6_3", label: "N6.3 - Reverse charge subappalto edilizia" },
  { value: "N6_4", label: "N6.4 - Reverse charge cessione fabbricati" },
  { value: "N6_5", label: "N6.5 - Reverse charge cellulari" },
  { value: "N6_6", label: "N6.6 - Reverse charge prodotti elettronici" },
  { value: "N6_7", label: "N6.7 - Reverse charge prestazioni comparto edile" },
  { value: "N6_8", label: "N6.8 - Reverse charge settore energetico" },
  { value: "N6_9", label: "N6.9 - Reverse charge altri casi" },
  { value: "N7", label: "N7 - IVA assolta in altro stato UE" },
];

const TIPO_DOCUMENTO_SDI_OPTIONS = [
  { value: "TD01", label: "TD01 - Fattura" },
  { value: "TD02", label: "TD02 - Acconto/anticipo su fattura" },
  { value: "TD03", label: "TD03 - Acconto/anticipo su parcella" },
  { value: "TD04", label: "TD04 - Nota di credito" },
  { value: "TD05", label: "TD05 - Nota di debito" },
  { value: "TD06", label: "TD06 - Parcella" },
  { value: "TD07", label: "TD07 - Fattura semplificata" },
  { value: "TD08", label: "TD08 - Nota di credito semplificata" },
  { value: "TD09", label: "TD09 - Nota di debito semplificata" },
  { value: "TD16", label: "TD16 - Integrazione fattura reverse charge interno" },
  { value: "TD17", label: "TD17 - Integrazione/autofattura acquisto servizi estero" },
  { value: "TD18", label: "TD18 - Integrazione acquisto beni intra" },
  { value: "TD19", label: "TD19 - Integrazione/autofattura acquisto beni art. 17 c.2" },
  { value: "TD20", label: "TD20 - Autofattura/regolarizzazione" },
  { value: "TD21", label: "TD21 - Autofattura per splafonamento" },
  { value: "TD22", label: "TD22 - Estrazione beni da deposito IVA" },
  { value: "TD23", label: "TD23 - Estrazione beni da deposito IVA con pagamento IVA" },
  { value: "TD24", label: "TD24 - Fattura differita art. 21 c.4 lett. a" },
  { value: "TD25", label: "TD25 - Fattura differita art. 21 c.4 terzo periodo lett. b" },
  { value: "TD26", label: "TD26 - Cessione beni ammortizzabili / passaggi interni" },
  { value: "TD27", label: "TD27 - Fattura autoconsumo / cessioni gratuite senza rivalsa" },
  { value: "TD28", label: "TD28 - Acquisti da San Marino con IVA" },
  { value: "TD29", label: "TD29 - Acquisti da San Marino senza IVA" },
];

const REGISTRO_IVA_OPTIONS = [
  { value: "VENDITE", label: "Registro vendite" },
  { value: "ACQUISTI", label: "Registro acquisti" },
  { value: "CORRISPETTIVI", label: "Registro corrispettivi" },
];

const TIPO_RITENUTA_OPTIONS = [
  { value: "LAVORO_AUTONOMO", label: "Lavoro autonomo (20%)" },
  { value: "PROVVIGIONI", label: "Provvigioni (23% su 50%)" },
  { value: "OCCASIONALE", label: "Prestazione occasionale (20%)" },
  { value: "DIRITTI_AUTORE", label: "Diritti d'autore (20% su 75%)" },
];

export function DatiContabiliTab({
  operazioneId,
  tipoOperazione,
  importoTotale,
  importoIva,
  categoriaName,
  hasPianoPagamento,
  initialData,
  onSaved,
}: DatiContabiliTabProps) {
  const [saving, setSaving] = useState(false);

  // Fornitori/Clienti
  const [fornitori, setFornitori] = useState<Anagrafica[]>([]);
  const [clienti, setClienti] = useState<Anagrafica[]>([]);
  const [fornitoreId, setFornitoreId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [showNewFornitore, setShowNewFornitore] = useState(false);
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newAnagraficaDenominazione, setNewAnagraficaDenominazione] = useState("");
  const [newAnagraficaPiva, setNewAnagraficaPiva] = useState("");
  const [creatingAnagrafica, setCreatingAnagrafica] = useState(false);

  // Competenza
  const [competenzaDal, setCompetenzaDal] = useState("");
  const [competenzaAl, setCompetenzaAl] = useState("");

  // Stato pagamento
  const [statoPagamento, setStatoPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [importoPagato, setImportoPagato] = useState("");

  // Piano dei conti
  const [conti, setConti] = useState<Conto[]>([]);
  const [contoId, setContoId] = useState<string>("");
  const [contoSuggested, setContoSuggested] = useState(false);

  // IVA avanzata
  const [naturaIva, setNaturaIva] = useState<string>("");
  const [tipoDocumentoSdi, setTipoDocumentoSdi] = useState<string>("");
  const [registroIva, setRegistroIva] = useState<string>("");
  const [protocolloIva, setProtocolloIva] = useState("");
  const [dataRegistrazione, setDataRegistrazione] = useState("");
  const [splitPayment, setSplitPayment] = useState(false);

  // Ritenuta d'acconto
  const [soggettoARitenuta, setSoggettoARitenuta] = useState(false);
  const [tipoRitenuta, setTipoRitenuta] = useState<string>("");
  const [rivalsaInps, setRivalsaInps] = useState("");
  const [cassaPrevidenza, setCassaPrevidenza] = useState("");

  // Bollo virtuale
  const [bolloVirtuale, setBolloVirtuale] = useState(false);
  const [importoBollo, setImportoBollo] = useState("2.00");

  // Selected fornitore data (for ritenuta logic)
  const selectedFornitore = useMemo(() => {
    if (!fornitoreId) return null;
    return fornitori.find((f) => f.id === parseInt(fornitoreId));
  }, [fornitoreId, fornitori]);

  // Calcolo ritenuta
  const ritenutaCalcolata = useMemo(() => {
    if (!soggettoARitenuta || !tipoRitenuta) return null;
    try {
      return calcolaRitenuta({
        tipo: tipoRitenuta as any,
        importoLordo: importoTotale,
        rivalsaInps: rivalsaInps ? parseFloat(rivalsaInps) : undefined,
        cassaPrevidenza: cassaPrevidenza ? parseFloat(cassaPrevidenza) : undefined,
      });
    } catch {
      return null;
    }
  }, [soggettoARitenuta, tipoRitenuta, importoTotale, rivalsaInps, cassaPrevidenza]);

  // Fetch anagrafiche
  const fetchAnagrafiche = useCallback(async () => {
    try {
      const [fornitoriRes, clientiRes] = await Promise.all([
        fetch("/api/anagrafiche?tipo=FORNITORE"),
        fetch("/api/anagrafiche?tipo=CLIENTE"),
      ]);
      if (fornitoriRes.ok) {
        const data = await fornitoriRes.json();
        setFornitori(data.data || []);
      }
      if (clientiRes.ok) {
        const data = await clientiRes.json();
        setClienti(data.data || []);
      }
    } catch (err) {
      console.error("Errore nel caricamento delle anagrafiche:", err);
    }
  }, []);

  // Fetch piano dei conti
  const fetchConti = useCallback(async () => {
    try {
      const res = await fetch("/api/piano-dei-conti");
      if (res.ok) {
        const data = await res.json();
        setConti(data || []);
      }
    } catch (err) {
      console.error("Errore nel caricamento del piano dei conti:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAnagrafiche();
    fetchConti();
  }, [fetchAnagrafiche, fetchConti]);

  // Pre-populate from initialData
  useEffect(() => {
    if (!initialData) return;

    if (initialData.fornitoreId) setFornitoreId(String(initialData.fornitoreId));
    if (initialData.clienteId) setClienteId(String(initialData.clienteId));
    if (initialData.dataCompetenzaInizio) {
      setCompetenzaDal(initialData.dataCompetenzaInizio.split("T")[0]);
    }
    if (initialData.dataCompetenzaFine) {
      setCompetenzaAl(initialData.dataCompetenzaFine.split("T")[0]);
    }
    if (initialData.statoPagamentoFattura) {
      setStatoPagamento(initialData.statoPagamentoFattura);
    }
    if (initialData.dataPagamento) {
      setDataPagamento(initialData.dataPagamento.split("T")[0]);
    }
    if (initialData.importoPagato != null) {
      setImportoPagato(String(initialData.importoPagato));
    }
    if (initialData.codiceContoId) {
      setContoId(String(initialData.codiceContoId));
      setContoSuggested(true); // don't auto-suggest if already set
    }
    if (initialData.naturaOperazioneIva) setNaturaIva(initialData.naturaOperazioneIva);
    if (initialData.tipoDocumentoSdi) setTipoDocumentoSdi(initialData.tipoDocumentoSdi);
    if (initialData.registroIva) setRegistroIva(initialData.registroIva);
    if (initialData.protocolloIva) setProtocolloIva(initialData.protocolloIva);
    if (initialData.dataRegistrazione) {
      setDataRegistrazione(initialData.dataRegistrazione.split("T")[0]);
    }
    if (initialData.splitPayment) setSplitPayment(true);
    if (initialData.soggettoARitenuta) {
      setSoggettoARitenuta(true);
      if (initialData.ritenuta?.tipoRitenuta) {
        setTipoRitenuta(initialData.ritenuta.tipoRitenuta);
      }
      if (initialData.ritenuta?.rivalsaInps != null) {
        setRivalsaInps(String(Number(initialData.ritenuta.rivalsaInps)));
      }
      if (initialData.ritenuta?.cassaPrevidenza != null) {
        setCassaPrevidenza(String(Number(initialData.ritenuta.cassaPrevidenza)));
      }
    }
    if (initialData.bolloVirtuale) {
      setBolloVirtuale(true);
      if (initialData.importoBollo != null) {
        setImportoBollo(String(initialData.importoBollo));
      }
    }
  }, [initialData]);

  // Auto-suggest piano dei conti based on category name
  useEffect(() => {
    if (contoSuggested || contoId || !categoriaName || conti.length === 0) return;
    const suggested = suggerisciConto(categoriaName);
    if (suggested) {
      const match = conti.find((c) => c.codice === suggested);
      if (match) {
        setContoId(String(match.id));
        setContoSuggested(true);
      }
    }
  }, [categoriaName, conti, contoId, contoSuggested]);

  // Create new anagrafica
  const handleCreateAnagrafica = async (tipo: "FORNITORE" | "CLIENTE") => {
    if (!newAnagraficaDenominazione.trim()) {
      toast.error("Inserisci la denominazione");
      return;
    }
    setCreatingAnagrafica(true);
    try {
      const res = await fetch("/api/anagrafiche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          denominazione: newAnagraficaDenominazione.trim(),
          partitaIva: newAnagraficaPiva.trim() || null,
          tipo,
          tipoSoggetto: "AZIENDA",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Errore nella creazione");
        return;
      }
      const created = await res.json();
      toast.success("Anagrafica creata");
      await fetchAnagrafiche();
      if (tipo === "FORNITORE") {
        setFornitoreId(String(created.id));
        setShowNewFornitore(false);
      } else {
        setClienteId(String(created.id));
        setShowNewCliente(false);
      }
      setNewAnagraficaDenominazione("");
      setNewAnagraficaPiva("");
    } catch {
      toast.error("Errore nella creazione dell'anagrafica");
    } finally {
      setCreatingAnagrafica(false);
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const dataOp = initialData?.dataOperazione
        ? new Date(initialData.dataOperazione)
        : new Date();

      const payload: any = {
        fornitoreId: fornitoreId ? parseInt(fornitoreId) : null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        dataCompetenzaInizio: competenzaDal || null,
        dataCompetenzaFine: competenzaAl || null,
        statoPagamentoFattura: statoPagamento || null,
        dataPagamento: dataPagamento || null,
        importoPagato: importoPagato ? parseFloat(importoPagato) : null,
        codiceContoId: contoId ? parseInt(contoId) : null,
        naturaOperazioneIva: naturaIva || null,
        tipoDocumentoSdi: tipoDocumentoSdi || null,
        protocolloIva: protocolloIva || null,
        registroIva: registroIva || null,
        dataRegistrazione: dataRegistrazione || null,
        splitPayment: splitPayment || null,
        soggettoARitenuta,
        bolloVirtuale,
        importoBollo: bolloVirtuale ? parseFloat(importoBollo) || 2.0 : null,
      };

      // If ritenuta, include calculated values
      if (soggettoARitenuta && tipoRitenuta && ritenutaCalcolata) {
        payload.importoRitenuta = ritenutaCalcolata.importoRitenuta;
        payload.importoNettoRitenuta = ritenutaCalcolata.importoNetto;
        payload.ritenuta = {
          anagraficaId: fornitoreId ? parseInt(fornitoreId) : (clienteId ? parseInt(clienteId) : null),
          tipoRitenuta,
          aliquota: ritenutaCalcolata.aliquota,
          percentualeImponibile: ritenutaCalcolata.percentualeImponibile,
          importoLordo: importoTotale,
          baseImponibile: ritenutaCalcolata.baseImponibile,
          importoRitenuta: ritenutaCalcolata.importoRitenuta,
          importoNetto: ritenutaCalcolata.importoNetto,
          rivalsaInps: rivalsaInps ? parseFloat(rivalsaInps) : null,
          cassaPrevidenza: cassaPrevidenza ? parseFloat(cassaPrevidenza) : null,
          meseCompetenza: dataOp.getMonth() + 1,
          annoCompetenza: dataOp.getFullYear(),
          codiceTributo: ritenutaCalcolata.codiceTributo,
        };
      }

      const res = await fetch(`/api/operazioni/${operazioneId}/dati-contabili`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Errore nel salvataggio");
        return;
      }

      toast.success("Dati contabili salvati");
      onSaved?.();
    } catch {
      toast.error("Errore nel salvataggio dei dati contabili");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Fornitore / Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fornitore / Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fornitore */}
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <div className="flex gap-2">
              <Select value={fornitoreId} onValueChange={setFornitoreId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleziona fornitore..." />
                </SelectTrigger>
                <SelectContent>
                  {fornitori.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.denominazione}
                      {f.partitaIva ? ` (${f.partitaIva})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowNewFornitore(!showNewFornitore);
                  setShowNewCliente(false);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {fornitoreId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFornitoreId("")}
                >
                  Rimuovi
                </Button>
              )}
            </div>
            {showNewFornitore && (
              <div className="flex gap-2 items-end p-3 border rounded-md bg-muted/30">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Denominazione</Label>
                  <Input
                    value={newAnagraficaDenominazione}
                    onChange={(e) => setNewAnagraficaDenominazione(e.target.value)}
                    placeholder="Nome fornitore"
                  />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs">P.IVA</Label>
                  <Input
                    value={newAnagraficaPiva}
                    onChange={(e) => setNewAnagraficaPiva(e.target.value)}
                    placeholder="01234567890"
                    maxLength={11}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingAnagrafica}
                  onClick={() => handleCreateAnagrafica("FORNITORE")}
                >
                  {creatingAnagrafica ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
                </Button>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <div className="flex gap-2">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleziona cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clienti.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.denominazione}
                      {c.partitaIva ? ` (${c.partitaIva})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowNewCliente(!showNewCliente);
                  setShowNewFornitore(false);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {clienteId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClienteId("")}
                >
                  Rimuovi
                </Button>
              )}
            </div>
            {showNewCliente && (
              <div className="flex gap-2 items-end p-3 border rounded-md bg-muted/30">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Denominazione</Label>
                  <Input
                    value={newAnagraficaDenominazione}
                    onChange={(e) => setNewAnagraficaDenominazione(e.target.value)}
                    placeholder="Nome cliente"
                  />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs">P.IVA</Label>
                  <Input
                    value={newAnagraficaPiva}
                    onChange={(e) => setNewAnagraficaPiva(e.target.value)}
                    placeholder="01234567890"
                    maxLength={11}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingAnagrafica}
                  onClick={() => handleCreateAnagrafica("CLIENTE")}
                >
                  {creatingAnagrafica ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Competenza economica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competenza economica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Competenza dal</Label>
              <Input
                type="date"
                value={competenzaDal}
                onChange={(e) => setCompetenzaDal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Competenza al</Label>
              <Input
                type="date"
                value={competenzaAl}
                onChange={(e) => setCompetenzaAl(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Stato pagamento */}
      {!hasPianoPagamento && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stato pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={statoPagamento} onValueChange={setStatoPagamento}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NON_PAGATO" id="sp-non-pagato" />
                <Label htmlFor="sp-non-pagato">Non pagato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PAGATO" id="sp-pagato" />
                <Label htmlFor="sp-pagato">Pagato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PARZIALMENTE_PAGATO" id="sp-parziale" />
                <Label htmlFor="sp-parziale">Parzialmente pagato</Label>
              </div>
            </RadioGroup>

            {statoPagamento === "PAGATO" && (
              <div className="space-y-2">
                <Label>Data pagamento</Label>
                <Input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>
            )}

            {statoPagamento === "PARZIALMENTE_PAGATO" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Importo pagato</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={importoPagato}
                    onChange={(e) => setImportoPagato(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data pagamento</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Piano dei conti */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Piano dei conti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Conto contabile</Label>
          <Select value={contoId} onValueChange={setContoId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona conto..." />
            </SelectTrigger>
            <SelectContent>
              {conti.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.codice} - {c.descrizione}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {contoId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setContoId("");
                setContoSuggested(false);
              }}
            >
              Rimuovi selezione
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 5. IVA avanzata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IVA avanzata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!importoIva || importoIva === 0) && (
            <div className="space-y-2">
              <Label>Natura IVA (obbligatoria se IVA = 0)</Label>
              <Select value={naturaIva} onValueChange={setNaturaIva}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona natura IVA..." />
                </SelectTrigger>
                <SelectContent>
                  {NATURA_IVA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo documento SDI</Label>
            <Select value={tipoDocumentoSdi} onValueChange={setTipoDocumentoSdi}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo documento..." />
              </SelectTrigger>
              <SelectContent>
                {TIPO_DOCUMENTO_SDI_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Registro IVA</Label>
            <Select value={registroIva} onValueChange={setRegistroIva}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona registro..." />
              </SelectTrigger>
              <SelectContent>
                {REGISTRO_IVA_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Protocollo IVA</Label>
              <Input
                value={protocolloIva}
                onChange={(e) => setProtocolloIva(e.target.value)}
                placeholder="Es. 001/2026"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Data registrazione</Label>
              <Input
                type="date"
                value={dataRegistrazione}
                onChange={(e) => setDataRegistrazione(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="split-payment"
              checked={splitPayment}
              onCheckedChange={(checked) => setSplitPayment(checked === true)}
            />
            <Label htmlFor="split-payment">Split Payment (scissione dei pagamenti)</Label>
          </div>
        </CardContent>
      </Card>

      {/* 6. Ritenuta d'acconto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ritenuta d&apos;acconto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="soggetto-ritenuta"
                      checked={soggettoARitenuta}
                      onCheckedChange={setSoggettoARitenuta}
                      disabled={selectedFornitore?.regimeForfettario === true}
                    />
                    <Label htmlFor="soggetto-ritenuta">Soggetto a ritenuta</Label>
                  </div>
                </TooltipTrigger>
                {selectedFornitore?.regimeForfettario && (
                  <TooltipContent>
                    <p>Ritenuta non applicabile: il fornitore opera in regime forfettario</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {soggettoARitenuta && (
            <>
              <div className="space-y-2">
                <Label>Tipo ritenuta</Label>
                <Select value={tipoRitenuta} onValueChange={setTipoRitenuta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo ritenuta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_RITENUTA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rivalsa INPS</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rivalsaInps}
                    onChange={(e) => setRivalsaInps(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cassa previdenza</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cassaPrevidenza}
                    onChange={(e) => setCassaPrevidenza(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {ritenutaCalcolata && (
                <div className="p-3 border rounded-md bg-muted/30 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aliquota:</span>
                    <span className="font-medium">{ritenutaCalcolata.aliquota}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% imponibile:</span>
                    <span className="font-medium">{ritenutaCalcolata.percentualeImponibile}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base imponibile:</span>
                    <span className="font-medium">{formatCurrency(ritenutaCalcolata.baseImponibile)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Importo ritenuta:</span>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(ritenutaCalcolata.importoRitenuta)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Importo netto:</span>
                    <span className="font-semibold">
                      {formatCurrency(ritenutaCalcolata.importoNetto)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Codice tributo:</span>
                    <span className="font-medium">{ritenutaCalcolata.codiceTributo}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 7. Bollo virtuale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bollo virtuale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="bollo-virtuale"
              checked={bolloVirtuale}
              onCheckedChange={(checked) => {
                setBolloVirtuale(checked);
                if (checked && !importoBollo) setImportoBollo("2.00");
              }}
            />
            <Label htmlFor="bollo-virtuale">Applica bollo virtuale</Label>
          </div>

          {bolloVirtuale && (
            <div className="space-y-2 w-40">
              <Label>Importo bollo</Label>
              <Input
                type="number"
                step="0.01"
                value={importoBollo}
                onChange={(e) => setImportoBollo(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Salvataggio..." : "Salva dati contabili"}
        </Button>
      </div>
    </div>
  );
}
