"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  calcolaDeducibilita,
  formatCurrency,
  formatPercentuale,
} from "@/lib/business-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Save, X, Loader2 } from "lucide-react";

type Socio = {
  id: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type Categoria = {
  id: number;
  nome: string;
  percentualeDeducibilita: number;
};

type RipartizioneData = {
  id?: number;
  socioId: number;
  percentuale: number;
  importoCalcolato: number;
  socio: {
    id: number;
    nome: string;
    cognome: string;
    quotaPercentuale: number;
  };
};

type OperazioneData = {
  id: number;
  tipoOperazione: string;
  dataOperazione: string;
  numeroDocumento: string | null;
  descrizione: string;
  importoTotale: number;
  categoriaId: number;
  importoDeducibile: number;
  percentualeDeducibilita: number;
  deducibilitaCustom: boolean;
  tipoRipartizione: string;
  note: string | null;
  createdByUserId: number;
  ripartizioni: RipartizioneData[];
  categoria: {
    id: number;
    nome: string;
    percentualeDeducibilita: number;
  };
};

type Props = {
  soci: Socio[];
  categorie: Categoria[];
  operazione?: OperazioneData;
  readOnly?: boolean;
};

export function OperazioneForm({
  soci,
  categorie,
  operazione,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const isEditing = !!operazione;
  const [saving, setSaving] = useState(false);

  // Form state
  const [tipoOperazione, setTipoOperazione] = useState(
    operazione?.tipoOperazione || "COSTO"
  );
  const [dataOperazione, setDataOperazione] = useState(() => {
    if (operazione?.dataOperazione) {
      return operazione.dataOperazione.split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [numeroDocumento, setNumeroDocumento] = useState(
    operazione?.numeroDocumento || ""
  );
  const [descrizione, setDescrizione] = useState(
    operazione?.descrizione || ""
  );
  const [importoTotale, setImportoTotale] = useState(
    operazione ? String(operazione.importoTotale) : ""
  );
  const [categoriaId, setCategoriaId] = useState(
    operazione ? String(operazione.categoriaId) : ""
  );
  const [percentualeDeducibilita, setPercentualeDeducibilita] = useState(
    operazione ? String(operazione.percentualeDeducibilita) : ""
  );
  const [importoDeducibile, setImportoDeducibile] = useState(
    operazione ? String(operazione.importoDeducibile) : ""
  );
  const [deducibilitaCustom, setDeducibilitaCustom] = useState(
    operazione?.deducibilitaCustom || false
  );
  const [tipoRipartizione, setTipoRipartizione] = useState(
    operazione?.tipoRipartizione || "COMUNE"
  );
  const [socioSingoloId, setSocioSingoloId] = useState(() => {
    if (operazione?.tipoRipartizione === "SINGOLO") {
      const singolo = operazione.ripartizioni.find(
        (r) => r.percentuale === 100
      );
      return singolo ? String(singolo.socioId) : "";
    }
    return "";
  });
  const [customPercentuali, setCustomPercentuali] = useState<
    Record<number, string>
  >(() => {
    if (operazione?.tipoRipartizione === "CUSTOM") {
      const map: Record<number, string> = {};
      operazione.ripartizioni.forEach((r) => {
        map[r.socioId] = String(r.percentuale);
      });
      return map;
    }
    const map: Record<number, string> = {};
    soci.forEach((s) => {
      map[s.id] = String(s.quotaPercentuale);
    });
    return map;
  });
  const [note, setNote] = useState(operazione?.note || "");

  // Selected category
  const selectedCategoria = useMemo(() => {
    if (!categoriaId) return null;
    return categorie.find((c) => c.id === parseInt(categoriaId, 10)) || null;
  }, [categoriaId, categorie]);

  // Auto-fill deducibilita when category changes (and not custom)
  useEffect(() => {
    if (!deducibilitaCustom && selectedCategoria) {
      setPercentualeDeducibilita(
        String(selectedCategoria.percentualeDeducibilita)
      );
      const importo = parseFloat(importoTotale) || 0;
      const deduc = calcolaDeducibilita(
        importo,
        selectedCategoria.percentualeDeducibilita
      );
      setImportoDeducibile(String(deduc));
    }
  }, [selectedCategoria, deducibilitaCustom, importoTotale]);

  // Auto-calculate importo deducibile when percentuale or importo changes (and not custom)
  useEffect(() => {
    if (!deducibilitaCustom) {
      const importo = parseFloat(importoTotale) || 0;
      const perc = parseFloat(percentualeDeducibilita) || 0;
      const deduc = calcolaDeducibilita(importo, perc);
      setImportoDeducibile(String(deduc));
    }
  }, [importoTotale, percentualeDeducibilita, deducibilitaCustom]);

  // Calculate custom ripartizioni amounts
  const customRipartizioniCalcolate = useMemo(() => {
    const importo = parseFloat(importoTotale) || 0;
    return soci.map((s) => {
      const perc = parseFloat(customPercentuali[s.id] || "0") || 0;
      return {
        socioId: s.id,
        nome: s.nome,
        cognome: s.cognome,
        percentuale: perc,
        importo: Math.round(((importo * perc) / 100) * 100) / 100,
      };
    });
  }, [soci, customPercentuali, importoTotale]);

  const sommaPercentualiCustom = useMemo(() => {
    return customRipartizioniCalcolate.reduce(
      (sum, r) => sum + r.percentuale,
      0
    );
  }, [customRipartizioniCalcolate]);

  const handleSave = async () => {
    // Client-side validations
    if (!tipoOperazione) {
      toast.error("Selezionare il tipo di operazione");
      return;
    }
    if (!dataOperazione) {
      toast.error("Inserire la data dell'operazione");
      return;
    }
    if (!descrizione.trim()) {
      toast.error("Inserire una descrizione");
      return;
    }
    const importo = parseFloat(importoTotale);
    if (isNaN(importo) || importo <= 0) {
      toast.error("L'importo totale deve essere maggiore di zero");
      return;
    }
    if (!categoriaId) {
      toast.error("Selezionare una categoria");
      return;
    }
    if (tipoRipartizione === "SINGOLO" && !socioSingoloId) {
      toast.error(
        "Per la ripartizione Singolo, selezionare un socio"
      );
      return;
    }
    if (tipoRipartizione === "CUSTOM") {
      if (Math.abs(sommaPercentualiCustom - 100) > 0.01) {
        toast.error(
          `La somma delle percentuali custom deve essere 100% (attuale: ${sommaPercentualiCustom.toFixed(2)}%)`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        tipoOperazione,
        dataOperazione,
        numeroDocumento: numeroDocumento || null,
        descrizione: descrizione.trim(),
        importoTotale: importo,
        categoriaId: parseInt(categoriaId, 10),
        importoDeducibile: parseFloat(importoDeducibile) || 0,
        percentualeDeducibilita: parseFloat(percentualeDeducibilita) || 0,
        deducibilitaCustom,
        tipoRipartizione,
        note: note.trim() || null,
      };

      if (tipoRipartizione === "SINGOLO") {
        payload.socioSingoloId = parseInt(socioSingoloId, 10);
      }

      if (tipoRipartizione === "CUSTOM") {
        payload.ripartizioniCustom = soci.map((s) => ({
          socioId: s.id,
          percentuale: parseFloat(customPercentuali[s.id] || "0") || 0,
        }));
      }

      const url = isEditing
        ? `/api/operazioni/${operazione.id}`
        : "/api/operazioni";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }

      toast.success(
        isEditing
          ? "Operazione aggiornata con successo"
          : "Operazione creata con successo"
      );
      router.push("/operazioni");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Errore nel salvataggio dell'operazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Section 1: Tipo, Data, Documento, Descrizione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dati Operazione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo Operazione */}
          <div className="space-y-2">
            <Label>Tipo Operazione *</Label>
            <RadioGroup
              value={tipoOperazione}
              onValueChange={setTipoOperazione}
              disabled={readOnly}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { value: "FATTURA_ATTIVA", label: "Fattura Attiva" },
                { value: "COSTO", label: "Costo" },
                { value: "SPESA", label: "Spesa" },
                { value: "CESPITE", label: "Cespite" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label
                    htmlFor={`tipo-${opt.value}`}
                    className="cursor-pointer font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data Operazione */}
            <div className="space-y-2">
              <Label htmlFor="dataOperazione">Data Operazione *</Label>
              <Input
                id="dataOperazione"
                type="date"
                value={dataOperazione}
                onChange={(e) => setDataOperazione(e.target.value)}
                disabled={readOnly}
              />
            </div>

            {/* Numero Documento */}
            <div className="space-y-2">
              <Label htmlFor="numeroDocumento">Numero Documento</Label>
              <Input
                id="numeroDocumento"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Es. FT-2026/001"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Descrizione */}
          <div className="space-y-2">
            <Label htmlFor="descrizione">Descrizione *</Label>
            <Textarea
              id="descrizione"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Descrizione dell'operazione..."
              rows={3}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Importo, Categoria, Deducibilita */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importo e Deducibilita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Importo Totale */}
            <div className="space-y-2">
              <Label htmlFor="importoTotale">Importo Totale (EUR) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  &euro;
                </span>
                <Input
                  id="importoTotale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={importoTotale}
                  onChange={(e) => setImportoTotale(e.target.value)}
                  className="pl-8"
                  placeholder="0,00"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={categoriaId}
                onValueChange={setCategoriaId}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categorie.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.nome} ({formatPercentuale(cat.percentualeDeducibilita)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Deducibilita */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="deducibilitaCustom"
                checked={deducibilitaCustom}
                onCheckedChange={(checked) =>
                  setDeducibilitaCustom(checked === true)
                }
                disabled={readOnly}
              />
              <Label
                htmlFor="deducibilitaCustom"
                className="cursor-pointer font-normal"
              >
                Deducibilita personalizzata
              </Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Percentuale Deducibilita */}
              <div className="space-y-2">
                <Label htmlFor="percentualeDeducibilita">
                  % Deducibilita
                </Label>
                <div className="relative">
                  <Input
                    id="percentualeDeducibilita"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentualeDeducibilita}
                    onChange={(e) => {
                      setPercentualeDeducibilita(e.target.value);
                      if (deducibilitaCustom) {
                        const importo = parseFloat(importoTotale) || 0;
                        const perc = parseFloat(e.target.value) || 0;
                        setImportoDeducibile(
                          String(calcolaDeducibilita(importo, perc))
                        );
                      }
                    }}
                    disabled={readOnly || !deducibilitaCustom}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                </div>
              </div>

              {/* Importo Deducibile */}
              <div className="space-y-2">
                <Label htmlFor="importoDeducibile">Importo Deducibile</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    &euro;
                  </span>
                  <Input
                    id="importoDeducibile"
                    type="number"
                    step="0.01"
                    min="0"
                    value={importoDeducibile}
                    onChange={(e) => {
                      setImportoDeducibile(e.target.value);
                      if (deducibilitaCustom) {
                        const importo = parseFloat(importoTotale) || 0;
                        const deduc = parseFloat(e.target.value) || 0;
                        if (importo > 0) {
                          setPercentualeDeducibilita(
                            String(
                              Math.round((deduc / importo) * 100 * 100) / 100
                            )
                          );
                        }
                      }
                    }}
                    className="pl-8"
                    disabled={readOnly || !deducibilitaCustom}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Ripartizione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ripartizione tra Soci</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={tipoRipartizione}
            onValueChange={(val) => {
              setTipoRipartizione(val);
              if (val === "CUSTOM") {
                // Initialize custom percentuali from soci quotas if empty
                const map: Record<number, string> = {};
                soci.forEach((s) => {
                  map[s.id] = customPercentuali[s.id] || String(s.quotaPercentuale);
                });
                setCustomPercentuali(map);
              }
            }}
            disabled={readOnly}
            className="grid grid-cols-3 gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="COMUNE" id="rip-comune" />
              <Label htmlFor="rip-comune" className="cursor-pointer font-normal">
                Comune (quote societarie)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="SINGOLO" id="rip-singolo" />
              <Label
                htmlFor="rip-singolo"
                className="cursor-pointer font-normal"
              >
                Singolo socio
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="CUSTOM" id="rip-custom" />
              <Label
                htmlFor="rip-custom"
                className="cursor-pointer font-normal"
              >
                Personalizzata
              </Label>
            </div>
          </RadioGroup>

          <Separator />

          {/* COMUNE preview */}
          {tipoRipartizione === "COMUNE" && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead className="text-right">Quota %</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soci.map((s) => {
                    const importo = parseFloat(importoTotale) || 0;
                    const amount =
                      Math.round(
                        ((importo * s.quotaPercentuale) / 100) * 100
                      ) / 100;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          {s.cognome} {s.nome}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercentuale(s.quotaPercentuale)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* SINGOLO */}
          {tipoRipartizione === "SINGOLO" && (
            <div className="space-y-3">
              <Label>Seleziona il socio *</Label>
              <Select
                value={socioSingoloId}
                onValueChange={setSocioSingoloId}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Seleziona socio..." />
                </SelectTrigger>
                <SelectContent>
                  {soci.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.cognome} {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {socioSingoloId && (
                <p className="text-sm text-muted-foreground">
                  L&apos;intero importo di{" "}
                  <strong>
                    {formatCurrency(parseFloat(importoTotale) || 0)}
                  </strong>{" "}
                  sara assegnato a questo socio.
                </p>
              )}
            </div>
          )}

          {/* CUSTOM */}
          {tipoRipartizione === "CUSTOM" && (
            <div className="space-y-3">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Socio</TableHead>
                      <TableHead className="w-[150px] text-right">
                        Percentuale %
                      </TableHead>
                      <TableHead className="text-right">
                        Importo Calcolato
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customRipartizioniCalcolate.map((r) => (
                      <TableRow key={r.socioId}>
                        <TableCell>
                          {r.cognome} {r.nome}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={customPercentuali[r.socioId] || "0"}
                            onChange={(e) => {
                              setCustomPercentuali((prev) => ({
                                ...prev,
                                [r.socioId]: e.target.value,
                              }));
                            }}
                            className="w-[100px] ml-auto text-right"
                            disabled={readOnly}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(r.importo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell>Totale</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            Math.abs(sommaPercentualiCustom - 100) > 0.01
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-green-100 text-green-800 border-green-200"
                          }
                        >
                          {formatPercentuale(sommaPercentualiCustom)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          customRipartizioniCalcolate.reduce(
                            (sum, r) => sum + r.importo,
                            0
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {Math.abs(sommaPercentualiCustom - 100) > 0.01 && (
                <p className="text-sm text-destructive">
                  La somma delle percentuali deve essere esattamente 100%.
                  Attuale: {sommaPercentualiCustom.toFixed(2)}%
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Eventuali note aggiuntive..."
            rows={3}
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {/* Buttons */}
      {!readOnly && (
        <div className="flex justify-end gap-3 pb-6">
          <Button
            variant="outline"
            onClick={() => router.push("/operazioni")}
            disabled={saving}
          >
            <X className="mr-2 h-4 w-4" />
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving
              ? "Salvataggio..."
              : isEditing
                ? "Aggiorna"
                : "Salva"}
          </Button>
        </div>
      )}

      {/* Read-only back button */}
      {readOnly && (
        <div className="flex justify-end pb-6">
          <Button
            variant="outline"
            onClick={() => router.push("/operazioni")}
          >
            Torna all&apos;elenco
          </Button>
        </div>
      )}
    </div>
  );
}
