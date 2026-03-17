"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  calcolaDeducibilita,
  calcolaPianoAmmortamento,
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
import { Switch } from "@/components/ui/switch";
import {
  calcolaCoeffLeasing,
  calcolaCapNltMensile,
  LIMITI_LEASING_AUTO,
  LIMITI_NLT_ANNUO,
} from "@/lib/calcoli-ricorrenze";
import { Save, X, Loader2, AlertTriangle, RepeatIcon, Car, Info } from "lucide-react";
import {
  getLimiteFiscale,
  getPercentualiUso,
  calcolaBaseFiscale,
  calcolaTotaleInteressi,
  PERCENTUALI_USO,
  TIPO_VEICOLO_LABELS,
  USO_VEICOLO_LABELS,
  MODALITA_ACQUISTO_LABELS,
} from "@/lib/calcoli-veicoli";
import type { TipoVeicolo, UsoVeicolo } from "@/lib/calcoli-veicoli";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlobalDropZone } from "@/components/ocr/global-drop-zone";
import { PasteField } from "@/components/ocr/paste-field";
import { OcrOverlay } from "@/components/ocr/ocr-overlay";
import { useOcr } from "@/hooks/use-ocr";
import type { ParsedDocument, ParsedTransaction, OcrParseResult } from "@/lib/ocr/types";

const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"] as const;
const SOTTOTIPI_IMPOSTE = [
  { value: "IVA", label: "Liquidazione IVA" },
  { value: "IRES_ACCONTO", label: "Acconto IRES" },
  { value: "IRES_SALDO", label: "Saldo IRES" },
  { value: "IRAP_ACCONTO", label: "Acconto IRAP" },
  { value: "IRAP_SALDO", label: "Saldo IRAP" },
  { value: "INPS", label: "Contributi INPS" },
];

type Socio = {
  id: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type OpzioneUso = {
  label: string;
  codice: string;
  detraibilitaIva: number;
  deducibilitaCosto: number;
};

type Categoria = {
  id: number;
  nome: string;
  percentualeDeducibilita: number;
  aliquotaIvaDefault: number;
  percentualeDetraibilitaIva: number;
  haOpzioniUso: boolean;
  opzioniUso: OpzioneUso[] | null;
};

type PresetRipartizione = {
  id: number;
  nome: string;
  tipiOperazione: string[];
  ordinamento: number;
  soci: {
    socioId: number;
    percentuale: number;
    socio: { id: number; nome: string; cognome: string; attivo: boolean };
  }[];
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
  aliquotaIva: number | null;
  importoImponibile: number | null;
  importoIva: number | null;
  percentualeDetraibilitaIva: number | null;
  ivaDetraibile: number | null;
  ivaIndetraibile: number | null;
  opzioneUso: string | null;
  categoriaId: number | null;
  sottotipoOperazione?: string | null;
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
  cespite?: {
    id: number;
    aliquotaAmmortamento: number;
    valoreIniziale: number;
    stato: string;
    fondoAmmortamento: number;
    annoInizio: number;
  } | null;
};

type PreferenzaUso = {
  categoriaId: number;
  opzioneUso: string;
};

type Props = {
  soci: Socio[];
  categorie: Categoria[];
  operazione?: OperazioneData;
  readOnly?: boolean;
  preferenzeUso?: PreferenzaUso[];
  regimeFiscale?: string;
  tipoAttivita?: string;
  presets?: PresetRipartizione[];
};

export function OperazioneForm({
  soci,
  categorie,
  operazione,
  readOnly = false,
  preferenzeUso = [],
  regimeFiscale = "ORDINARIO",
  tipoAttivita = "SRL",
  presets = [],
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
    operazione?.categoriaId != null ? String(operazione.categoriaId) : ""
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
  const [aliquotaIva, setAliquotaIva] = useState(
    operazione?.aliquotaIva != null ? String(operazione.aliquotaIva) : "22"
  );
  const [note, setNote] = useState(operazione?.note || "");
  const [aliquotaAmmortamento, setAliquotaAmmortamento] = useState(
    operazione?.cespite?.aliquotaAmmortamento
      ? String(operazione.cespite.aliquotaAmmortamento)
      : "20"
  );

  // New state variables for IVA detraibilita and usage options
  const [opzioneUso, setOpzioneUso] = useState<string | null>(
    operazione?.opzioneUso || null
  );
  const [percentualeDetraibilitaIva, setPercentualeDetraibilitaIva] = useState(
    operazione?.percentualeDetraibilitaIva != null
      ? String(operazione.percentualeDetraibilitaIva)
      : "100"
  );
  const [ivaCustom, setIvaCustom] = useState(false);

  // Vehicle state
  const [isVeicolo, setIsVeicolo] = useState(false);
  const [tipoVeicolo, setTipoVeicolo] = useState<TipoVeicolo>("AUTOVETTURA");
  const [usoVeicolo, setUsoVeicolo] = useState<UsoVeicolo>("PROMISCUO");
  const [modalitaAcquisto, setModalitaAcquisto] = useState<"CONTANTI" | "FINANZIAMENTO">("CONTANTI");
  const [marca, setMarca] = useState("");
  const [modelloVeicolo, setModelloVeicolo] = useState("");
  const [targa, setTarga] = useState("");
  // Financing state
  const [anticipoFinanziamento, setAnticipoFinanziamento] = useState("");
  const [importoFinanziato, setImportoFinanziato] = useState("");
  const [numeroRate, setNumeroRate] = useState("");
  const [importoRata, setImportoRata] = useState("");
  const [tan, setTan] = useState("");
  const [dataPrimaRata, setDataPrimaRata] = useState("");

  // Ricorrenza
  const [isRicorrente, setIsRicorrente] = useState(false);
  const [sottotipoOperazione, setSottotipoOperazione] = useState(
    operazione?.sottotipoOperazione ?? ""
  );
  const [giornoDelMese, setGiornoDelMese] = useState(() => {
    const d = operazione?.dataOperazione ? new Date(operazione.dataOperazione) : new Date();
    return d.getDate();
  });
  const [dataFineRicorrenza, setDataFineRicorrenza] = useState("");

  // Leasing/NLT
  const [tipoContratto, setTipoContratto] = useState<string>("");
  const [valoreBene, setValoreBene] = useState("");
  const [maxicanoneImporto, setMaxicanoneImporto] = useState("");
  const [durataContrattoMesi, setDurataContrattoMesi] = useState("");
  const [quotaServiziImporto, setQuotaServiziImporto] = useState("");

  // OCR
  const { status: ocrStatus, result: ocrResult, error: ocrError, isProcessing: ocrProcessing, processFile: ocrProcessFile, processImage: ocrProcessImage, reset: ocrReset } = useOcr();
  const [ocrFields, setOcrFields] = useState<Set<string>>(new Set());
  const [ocrQueue, setOcrQueue] = useState<ParsedTransaction[]>([]);
  const [ocrQueueIndex, setOcrQueueIndex] = useState(0);
  const [ocrSelected, setOcrSelected] = useState<Set<number>>(new Set());

  const isForfettario = regimeFiscale === "FORFETTARIO";

  // IVA calculation (for all operation types in regime ordinario)
  const ivaApplicabile = !isForfettario && (tipoOperazione === "COSTO" || tipoOperazione === "CESPITE" || tipoOperazione === "FATTURA_ATTIVA");
  // Detraibilità IVA applies only to purchases (COSTO/CESPITE), not to sales
  const isAcquisto = tipoOperazione === "COSTO" || tipoOperazione === "CESPITE";

  const isTipoFinanziario = (TIPI_FINANZIARI as readonly string[]).includes(tipoOperazione);

  useEffect(() => {
    if (isTipoFinanziario) {
      setIsRicorrente(false);
    }
    if (tipoOperazione !== "PAGAMENTO_IMPOSTE") {
      setSottotipoOperazione("");
    }
  }, [tipoOperazione, isTipoFinanziario]);

  const calcoloIvaCompleto = useMemo(() => {
    if (!ivaApplicabile) return null;
    const totale = parseFloat(importoTotale) || 0;
    const aliquota = parseFloat(aliquotaIva) || 0;
    if (totale <= 0) return null;

    const imponibile = aliquota > 0
      ? Math.round((totale / (1 + aliquota / 100)) * 100) / 100
      : totale;
    const ivaTotale = Math.round((totale - imponibile) * 100) / 100;

    const percDetraibilita = parseFloat(percentualeDetraibilitaIva) || 0;
    const ivaDetr = Math.round((ivaTotale * percDetraibilita / 100) * 100) / 100;
    const ivaIndetr = Math.round((ivaTotale - ivaDetr) * 100) / 100;

    return { imponibile, ivaTotale, ivaDetraibile: ivaDetr, ivaIndetraibile: ivaIndetr };
  }, [importoTotale, aliquotaIva, percentualeDetraibilitaIva, ivaApplicabile]);

  // Base amount for deducibility: imponibile + IVA indetraibile if IVA applies, otherwise total
  const baseDeducibilita = useMemo(() => {
    if (!isAcquisto || !ivaApplicabile || !calcoloIvaCompleto) return parseFloat(importoTotale) || 0;
    // Costo fiscale = imponibile + IVA indetraibile
    return calcoloIvaCompleto.imponibile + calcoloIvaCompleto.ivaIndetraibile;
  }, [isAcquisto, ivaApplicabile, calcoloIvaCompleto, importoTotale]);

  // Selected category
  const selectedCategoria = useMemo(() => {
    if (!categoriaId) return null;
    return categorie.find((c) => c.id === parseInt(categoriaId, 10)) || null;
  }, [categoriaId, categorie]);

  // Auto-set IVA fields when category changes (and not in manual IVA mode)
  useEffect(() => {
    if (!ivaCustom && !isVeicolo && selectedCategoria && ivaApplicabile) {
      setAliquotaIva(String(selectedCategoria.aliquotaIvaDefault));
      if (isAcquisto) {
        setPercentualeDetraibilitaIva(String(selectedCategoria.percentualeDetraibilitaIva));
      }

      // Check for usage options and auto-select from preferences (only for purchases)
      if (isAcquisto && selectedCategoria.haOpzioniUso && selectedCategoria.opzioniUso) {
        const pref = preferenzeUso.find((p) => p.categoriaId === selectedCategoria.id);
        const defaultOption = pref?.opzioneUso || selectedCategoria.opzioniUso[0]?.codice || null;
        setOpzioneUso(defaultOption);

        // Apply usage option overrides
        if (defaultOption) {
          const opt = (selectedCategoria.opzioniUso as OpzioneUso[]).find((o) => o.codice === defaultOption);
          if (opt) {
            if (opt.aliquotaIva !== undefined) {
              setAliquotaIva(String(opt.aliquotaIva));
            }
            setPercentualeDetraibilitaIva(String(opt.detraibilitaIva));
            if (!deducibilitaCustom) {
              setPercentualeDeducibilita(String(opt.deducibilitaCosto));
            }
          }
        }
      } else {
        setOpzioneUso(null);
      }
    }
  }, [selectedCategoria, ivaCustom, ivaApplicabile, isAcquisto]);

  // Sync giorno del mese when dataOperazione changes
  useEffect(() => {
    if (dataOperazione && isRicorrente) {
      const giorno = new Date(dataOperazione).getDate();
      setGiornoDelMese(giorno);
    }
  }, [dataOperazione, isRicorrente]);

  // Determine if category is leasing/NLT auto
  const isLeasingNltCategory = useMemo(() => {
    if (!selectedCategoria) return false;
    const nome = selectedCategoria.nome.toLowerCase();
    return nome.includes("leasing") || nome.includes("noleggio");
  }, [selectedCategoria]);

  // Leasing warning calculations
  const leasingWarning = useMemo(() => {
    if (tipoContratto !== "LEASING" || !valoreBene) return null;
    const valore = parseFloat(valoreBene) || 0;
    const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
    const limite = isAgente ? LIMITI_LEASING_AUTO.AGENTE : LIMITI_LEASING_AUTO.STANDARD;
    if (valore <= limite) return null;
    const coeff = calcolaCoeffLeasing(valore, tipoAttivita as any);
    return {
      limite,
      coefficiente: Math.round(coeff * 10000) / 100,
    };
  }, [tipoContratto, valoreBene, tipoAttivita]);

  // NLT warning calculations
  const nltWarning = useMemo(() => {
    if (tipoContratto !== "NOLEGGIO_LUNGO_TERMINE") return null;
    const canone = parseFloat(importoTotale) || 0;
    const servizi = parseFloat(quotaServiziImporto) || 0;
    const quotaLocazione = canone - servizi;
    const capMensile = calcolaCapNltMensile(tipoAttivita as any);
    if (quotaLocazione <= capMensile) return null;
    const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
    const limiteAnnuo = isAgente ? LIMITI_NLT_ANNUO.AGENTE : LIMITI_NLT_ANNUO.STANDARD;
    return {
      quotaLocazione: Math.round(quotaLocazione * 100) / 100,
      capMensile,
      limiteAnnuo,
    };
  }, [tipoContratto, importoTotale, quotaServiziImporto, tipoAttivita]);

  // Handler for usage option change
  const handleOpzioneUsoChange = (codice: string) => {
    setOpzioneUso(codice);
    if (selectedCategoria?.opzioniUso) {
      const opt = (selectedCategoria.opzioniUso as OpzioneUso[]).find((o) => o.codice === codice);
      if (opt) {
        if (opt.aliquotaIva !== undefined) {
          setAliquotaIva(String(opt.aliquotaIva));
        }
        setPercentualeDetraibilitaIva(String(opt.detraibilitaIva));
        if (!deducibilitaCustom) {
          setPercentualeDeducibilita(String(opt.deducibilitaCosto));
        }
      }
    }
    // Save preference
    if (selectedCategoria) {
      fetch("/api/preferenze-uso", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoriaId: selectedCategoria.id, opzioneUso: codice }),
      }).catch(() => {}); // fire and forget
    }
  };

  // Auto-fill deducibilita when category changes (and not custom)
  useEffect(() => {
    if (!deducibilitaCustom && selectedCategoria) {
      // If there's a usage option selected, use its deducibilitaCosto
      if (opzioneUso && selectedCategoria.opzioniUso) {
        const opt = (selectedCategoria.opzioniUso as OpzioneUso[]).find((o) => o.codice === opzioneUso);
        if (opt) {
          setPercentualeDeducibilita(String(opt.deducibilitaCosto));
          const deduc = calcolaDeducibilita(baseDeducibilita, opt.deducibilitaCosto);
          setImportoDeducibile(String(deduc));
          return;
        }
      }
      // Default: use category's percentualeDeducibilita
      setPercentualeDeducibilita(String(selectedCategoria.percentualeDeducibilita));
      const deduc = calcolaDeducibilita(baseDeducibilita, selectedCategoria.percentualeDeducibilita);
      setImportoDeducibile(String(deduc));
    }
  }, [selectedCategoria, deducibilitaCustom, baseDeducibilita, opzioneUso]);

  // Auto-calculate importo deducibile when percentuale or base amount changes (and not custom)
  useEffect(() => {
    if (!deducibilitaCustom) {
      const perc = parseFloat(percentualeDeducibilita) || 0;
      const deduc = calcolaDeducibilita(baseDeducibilita, perc);
      setImportoDeducibile(String(deduc));
    }
  }, [baseDeducibilita, percentualeDeducibilita, deducibilitaCustom]);

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

  // Depreciation schedule preview
  const pianoAmmortamento = useMemo(() => {
    if (tipoOperazione !== "CESPITE") return [];
    const importo = parseFloat(importoTotale) || 0;
    const aliquota = parseFloat(aliquotaAmmortamento) || 0;
    if (importo <= 0 || aliquota <= 0) return [];
    const annoInizio = dataOperazione
      ? new Date(dataOperazione).getFullYear()
      : new Date().getFullYear();
    return calcolaPianoAmmortamento(importo, aliquota, annoInizio);
  }, [tipoOperazione, importoTotale, aliquotaAmmortamento, dataOperazione]);

  const veicoloFiscale = useMemo(() => {
    if (!isVeicolo || tipoOperazione !== "CESPITE") return null;
    const limiteFiscale = getLimiteFiscale(tipoVeicolo, usoVeicolo);
    const percentuali = getPercentualiUso(usoVeicolo);
    const importoNum = parseFloat(importoTotale) || 0;
    const ivaIndetNum = calcoloIvaCompleto?.ivaIndetraibile || 0;
    const baseFiscale = calcolaBaseFiscale(importoNum, ivaIndetNum, limiteFiscale);
    const superaLimite = (importoNum + ivaIndetNum) > limiteFiscale && limiteFiscale !== Infinity;

    return {
      limiteFiscale,
      baseFiscale,
      superaLimite,
      ...percentuali,
    };
  }, [isVeicolo, tipoOperazione, tipoVeicolo, usoVeicolo, importoTotale, calcoloIvaCompleto]);

  const finanziamentoPreview = useMemo(() => {
    if (!isVeicolo || modalitaAcquisto !== "FINANZIAMENTO") return null;
    const impFin = parseFloat(importoFinanziato) || 0;
    const nRate = parseInt(numeroRate) || 0;
    const impRata = parseFloat(importoRata) || 0;
    const tanVal = tan ? parseFloat(tan) : null;

    if (impFin <= 0 || nRate <= 0 || impRata <= 0) return null;

    const totInteressi = calcolaTotaleInteressi(impFin, nRate, impRata, tanVal);
    const percDeduc = veicoloFiscale?.deducibilita || 20;
    const interessiDeducibili = Math.round((totInteressi * percDeduc / 100) * 100) / 100;

    return {
      totaleInteressi: Math.round(totInteressi * 100) / 100,
      interessiDeducibili,
      totalePagato: Math.round((impRata * nRate + (parseFloat(anticipoFinanziamento) || 0)) * 100) / 100,
    };
  }, [isVeicolo, modalitaAcquisto, importoFinanziato, numeroRate, importoRata, tan, anticipoFinanziamento, veicoloFiscale]);

  useEffect(() => {
    if (isVeicolo && modalitaAcquisto === "FINANZIAMENTO") {
      const importoNum = parseFloat(importoTotale) || 0;
      const anticipoNum = parseFloat(anticipoFinanziamento) || 0;
      setImportoFinanziato(String(Math.max(0, importoNum - anticipoNum)));
    }
  }, [importoTotale, anticipoFinanziamento, isVeicolo, modalitaAcquisto]);

  // Auto-override IVA detraibilita, deducibilita, and ammortamento when vehicle is toggled
  useEffect(() => {
    if (isVeicolo && usoVeicolo) {
      const percentuali = PERCENTUALI_USO[usoVeicolo];
      setPercentualeDetraibilitaIva(String(percentuali.detraibilitaIva));
      setPercentualeDeducibilita(String(percentuali.deducibilita));
      setDeducibilitaCustom(true);
      setAliquotaAmmortamento("25");
    } else if (!isVeicolo) {
      // Restore category defaults
      setDeducibilitaCustom(false);
      if (selectedCategoria) {
        setPercentualeDetraibilitaIva(String(selectedCategoria.percentualeDetraibilitaIva));
        setPercentualeDeducibilita(String(selectedCategoria.percentualeDeducibilita));
      } else {
        setPercentualeDetraibilitaIva("100");
        setPercentualeDeducibilita("100");
      }
    }
  }, [isVeicolo, usoVeicolo, selectedCategoria]);

  // OCR: load a transaction into the form fields
  const loadTransactionIntoForm = useCallback((tx: ParsedTransaction) => {
    const filledFields = new Set<string>();

    setTipoOperazione(tx.tipoOperazione || "COSTO");
    filledFields.add("tipoOperazione");

    if (tx.dataOperazione) {
      setDataOperazione(tx.dataOperazione);
      filledFields.add("dataOperazione");
    }
    if (tx.descrizione) {
      setDescrizione(tx.descrizione);
      filledFields.add("descrizione");
    }
    if (tx.importoTotale != null) {
      setImportoTotale(String(tx.importoTotale));
      filledFields.add("importoTotale");
    }
    if (tx.categoriaId) {
      setCategoriaId(String(tx.categoriaId));
      filledFields.add("categoriaId");
    }

    // Reset fields not set by OCR
    setNumeroDocumento("");
    setNote("");
    setOcrFields(filledFields);
  }, []);

  // OCR: apply results to form fields
  useEffect(() => {
    if (!ocrResult) return;

    // Multi-transaction: load first into form, queue the rest
    if (ocrResult.type === "multi") {
      const txs = ocrResult.transactions;
      setOcrQueue(txs);
      setOcrQueueIndex(0);
      loadTransactionIntoForm(txs[0]);
      toast.success(`${txs.length} operazioni trovate - Salva e passa alla successiva`);
      return;
    }

    // Single document: pre-fill form fields
    const document = ocrResult.document;
    const hasExistingData = descrizione || importoTotale || numeroDocumento;

    const applyOcrResult = (result: ParsedDocument) => {
      const filledFields = new Set<string>();

      if (result.tipoOperazione) {
        setTipoOperazione(result.tipoOperazione);
        filledFields.add("tipoOperazione");
      }
      if (result.dataOperazione) {
        setDataOperazione(result.dataOperazione);
        filledFields.add("dataOperazione");
      }
      if (result.numeroDocumento) {
        setNumeroDocumento(result.numeroDocumento);
        filledFields.add("numeroDocumento");
      }
      if (result.descrizione) {
        setDescrizione(result.descrizione);
        filledFields.add("descrizione");
      }
      if (result.importoTotale !== null) {
        setImportoTotale(String(result.importoTotale));
        filledFields.add("importoTotale");
      }
      if (result.aliquotaIva) {
        setAliquotaIva(result.aliquotaIva);
        filledFields.add("aliquotaIva");
      }

      setOcrFields(filledFields);

      const count = filledFields.size;
      if (count > 0) {
        toast.success(`Scansione completata - ${count} camp${count === 1 ? "o compilato" : "i compilati"}`);
      } else {
        toast.warning("Nessun dato riconosciuto dal documento");
      }
    };

    if (hasExistingData) {
      setTimeout(() => {
        const conferma = window.confirm(
          "Alcuni campi sono già compilati. Vuoi sovrascriverli con i dati estratti?"
        );
        if (conferma) {
          applyOcrResult(document);
        }
      }, 0);
    } else {
      applyOcrResult(document);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrResult]);

  // OCR: show error toast
  useEffect(() => {
    if (ocrError) {
      toast.error(ocrError);
      ocrReset();
    }
  }, [ocrError, ocrReset]);

  // OCR: helper for field highlight
  const ocrHighlight = (fieldName: string) =>
    ocrFields.has(fieldName) ? "ring-2 ring-amber-500/50 border-amber-500/50" : "";

  const clearOcrField = (fieldName: string) => {
    setOcrFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  };

  const sommaPercentualiCustom = useMemo(() => {
    return customRipartizioniCalcolate.reduce(
      (sum, r) => sum + r.percentuale,
      0
    );
  }, [customRipartizioniCalcolate]);

  const presetsDisponibili = useMemo(() => {
    return presets
      .filter((p) => (p.tipiOperazione as string[]).includes(tipoOperazione))
      .sort((a, b) => a.ordinamento - b.ordinamento);
  }, [presets, tipoOperazione]);

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
    if (!isTipoFinanziario && !categoriaId) {
      toast.error("Selezionare una categoria");
      return;
    }
    if (tipoOperazione === "PAGAMENTO_IMPOSTE" && !sottotipoOperazione) {
      toast.error("Selezionare il tipo di imposta");
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

    if (tipoOperazione === "CESPITE") {
      const aliquota = parseFloat(aliquotaAmmortamento);
      if (isNaN(aliquota) || aliquota <= 0 || aliquota > 100) {
        toast.error("L'aliquota di ammortamento deve essere tra 1% e 100%");
        return;
      }
    }

    setSaving(true);
    try {
      // Normalize preset to CUSTOM for API submission
      let effectiveTipoRipartizione = tipoRipartizione;
      let effectiveRipartizioniCustom: { socioId: number; percentuale: number }[] | undefined;

      if (tipoRipartizione.startsWith("PRESET_")) {
        const presetId = parseInt(tipoRipartizione.replace("PRESET_", ""), 10);
        const preset = presetsDisponibili.find((p) => p.id === presetId);
        if (preset) {
          effectiveTipoRipartizione = "CUSTOM";
          effectiveRipartizioniCustom = preset.soci.map((s) => ({
            socioId: s.socioId,
            percentuale: s.percentuale,
          }));
        }
      }

      const payload: any = {
        tipoOperazione,
        dataOperazione,
        numeroDocumento: numeroDocumento || null,
        descrizione: descrizione.trim(),
        importoTotale: importo,
        aliquotaIva: ivaApplicabile ? parseFloat(aliquotaIva) || 0 : null,
        importoImponibile: ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.imponibile : null,
        importoIva: ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaTotale : null,
        percentualeDetraibilitaIva: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? parseFloat(percentualeDetraibilitaIva) || 0 : null,
        ivaDetraibile: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaDetraibile : null,
        ivaIndetraibile: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaIndetraibile : null,
        opzioneUso: isAcquisto ? (opzioneUso || null) : null,
        ...(isTipoFinanziario
          ? { categoriaId: null, importoDeducibile: 0, percentualeDeducibilita: 0, deducibilitaCustom: false }
          : { categoriaId: parseInt(categoriaId, 10), importoDeducibile: parseFloat(importoDeducibile) || 0, percentualeDeducibilita: parseFloat(percentualeDeducibilita) || 0, deducibilitaCustom }),
        sottotipoOperazione: tipoOperazione === "PAGAMENTO_IMPOSTE" ? sottotipoOperazione : null,
        tipoRipartizione: effectiveTipoRipartizione,
        note: note.trim() || null,
      };

      if (effectiveTipoRipartizione === "SINGOLO") {
        payload.socioSingoloId = parseInt(socioSingoloId, 10);
      }

      if (effectiveTipoRipartizione === "CUSTOM") {
        payload.ripartizioniCustom = effectiveRipartizioniCustom || soci.map((s) => ({
          socioId: s.id,
          percentuale: parseFloat(customPercentuali[s.id] || "0") || 0,
        }));
      }

      if (tipoOperazione === "CESPITE") {
        payload.aliquotaAmmortamento = parseFloat(aliquotaAmmortamento);
      }

      // Add vehicle data if applicable
      if (tipoOperazione === "CESPITE" && isVeicolo) {
        Object.assign(payload, {
          isVeicolo: true,
          tipoVeicolo,
          usoVeicolo,
          modalitaAcquisto,
          marca,
          modelloVeicolo,
          targa,
        });

        if (modalitaAcquisto === "FINANZIAMENTO") {
          Object.assign(payload, {
            importoFinanziato: parseFloat(importoFinanziato),
            anticipoFinanziamento: parseFloat(anticipoFinanziamento) || 0,
            numeroRate: parseInt(numeroRate),
            importoRata: parseFloat(importoRata),
            tan: tan ? parseFloat(tan) : null,
            dataPrimaRata,
          });
        }
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

      const result = await res.json();

      // If recurring, also create the recurring template
      if (isRicorrente && !isEditing) {
        const ricorrenzaPayload: any = {
          tipoOperazione,
          categoriaId: parseInt(categoriaId, 10),
          descrizione: descrizione.trim(),
          importoTotale: importo,
          aliquotaIva: ivaApplicabile ? parseFloat(aliquotaIva) || 0 : null,
          importoImponibile: ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.imponibile : null,
          importoIva: ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaTotale : null,
          percentualeDetraibilitaIva: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? parseFloat(percentualeDetraibilitaIva) || 0 : null,
          ivaDetraibile: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaDetraibile : null,
          ivaIndetraibile: isAcquisto && ivaApplicabile && calcoloIvaCompleto ? calcoloIvaCompleto.ivaIndetraibile : null,
          opzioneUso: isAcquisto ? (opzioneUso || null) : null,
          percentualeDeducibilita: parseFloat(percentualeDeducibilita) || 0,
          importoDeducibile: parseFloat(importoDeducibile) || 0,
          deducibilitaCustom,
          tipoRipartizione: effectiveTipoRipartizione,
          socioSingoloId: effectiveTipoRipartizione === "SINGOLO" ? parseInt(socioSingoloId, 10) : null,
          note: note.trim() || null,
          giornoDelMese,
          dataInizio: dataOperazione,
          dataFine: dataFineRicorrenza || null,
        };

        // Add leasing/NLT fields if applicable
        if (tipoContratto) {
          ricorrenzaPayload.tipoContratto = tipoContratto;
          ricorrenzaPayload.valoreBene = valoreBene ? parseFloat(valoreBene) : null;
          ricorrenzaPayload.maxicanone = maxicanoneImporto ? parseFloat(maxicanoneImporto) : null;
          ricorrenzaPayload.durataContratto = durataContrattoMesi ? parseInt(durataContrattoMesi) : null;
          ricorrenzaPayload.quotaServizi = quotaServiziImporto ? parseFloat(quotaServiziImporto) : null;
          if (durataContrattoMesi) {
            ricorrenzaPayload.rateRimanenti = parseInt(durataContrattoMesi) - 1;
          }
        }

        await fetch("/api/operazioni-ricorrenti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ricorrenzaPayload),
        });
      }

      // If we have queued OCR transactions, load next instead of navigating away
      if (!isEditing && ocrQueue.length > 0 && ocrQueueIndex < ocrQueue.length - 1) {
        const nextIndex = ocrQueueIndex + 1;
        setOcrQueueIndex(nextIndex);
        loadTransactionIntoForm(ocrQueue[nextIndex]);
        toast.success(`Operazione ${ocrQueueIndex + 1}/${ocrQueue.length} salvata - Caricata la successiva`);
      } else {
        if (ocrQueue.length > 0) {
          setOcrQueue([]);
          setOcrQueueIndex(0);
        }
        toast.success(
          isEditing
            ? "Operazione aggiornata con successo"
            : isRicorrente
              ? "Operazione creata e ricorrenza impostata"
              : "Operazione creata con successo"
        );
        router.push("/operazioni");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || "Errore nel salvataggio dell'operazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlobalDropZone onFileDrop={ocrProcessFile} disabled={ocrProcessing || readOnly}>
      <div className="relative max-w-4xl mx-auto space-y-6">
        <OcrOverlay status={ocrStatus} />

        {/* OCR Queue Progress Banner */}
        {ocrQueue.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                    {ocrQueueIndex + 1} / {ocrQueue.length}
                  </Badge>
                  <span className="text-sm font-medium">
                    Operazioni da screenshot
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ocrSelected.size > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        const newQueue = ocrQueue.filter((_, i) => !ocrSelected.has(i));
                        setOcrSelected(new Set());
                        if (newQueue.length === 0) {
                          setOcrQueue([]);
                          setOcrQueueIndex(0);
                          setDescrizione("");
                          setImportoTotale("");
                          setDataOperazione(new Date().toISOString().split("T")[0]);
                          toast.info("Tutte le operazioni eliminate");
                        } else {
                          const nextIndex = Math.min(ocrQueueIndex, newQueue.length - 1);
                          setOcrQueue(newQueue);
                          setOcrQueueIndex(nextIndex);
                          loadTransactionIntoForm(newQueue[nextIndex]);
                          toast.info(`${ocrSelected.size} operazion${ocrSelected.size === 1 ? "e eliminata" : "i eliminate"}`);
                        }
                      }}
                    >
                      Elimina selezionate ({ocrSelected.size})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOcrQueue([]);
                      setOcrQueueIndex(0);
                      setOcrSelected(new Set());
                      toast.info("Coda operazioni annullata");
                    }}
                  >
                    Annulla coda
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {ocrQueue.map((tx, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-1.5 px-2 rounded text-sm cursor-pointer transition-colors ${
                      i === ocrQueueIndex
                        ? "bg-amber-500/15 font-medium"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setOcrQueueIndex(i);
                      loadTransactionIntoForm(ocrQueue[i]);
                    }}
                  >
                    <Checkbox
                      checked={ocrSelected.has(i)}
                      onCheckedChange={(checked) => {
                        setOcrSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(i);
                          else next.delete(i);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-muted-foreground w-20 shrink-0">
                      {tx.dataOperazione?.split("-").reverse().join("/") ?? "—"}
                    </span>
                    <span className="truncate flex-1">{tx.descrizione}</span>
                    <span className={`shrink-0 font-mono ${tx.tipoOperazione === "FATTURA_ATTIVA" ? "text-green-600" : "text-destructive"}`}>
                      {tx.tipoOperazione === "FATTURA_ATTIVA" ? "+" : "-"} {formatCurrency(tx.importoTotale)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((ocrQueueIndex + 1) / ocrQueue.length) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* OCR Paste Field */}
        {!readOnly && !isEditing && (
          <PasteField onImagePaste={ocrProcessImage} disabled={ocrProcessing} />
        )}

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
                { value: "CESPITE", label: "Cespite" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label htmlFor={`tipo-${opt.value}`} className="cursor-pointer font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-4 pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Movimenti Finanziari</p>
              </div>
              {[
                { value: "PAGAMENTO_IMPOSTE", label: "Pag. Imposte" },
                { value: "DISTRIBUZIONE_DIVIDENDI", label: "Dividendi" },
                { value: "COMPENSO_AMMINISTRATORE", label: "Comp. Amm." },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label htmlFor={`tipo-${opt.value}`} className="cursor-pointer font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {tipoOperazione === "PAGAMENTO_IMPOSTE" && (
            <div className="space-y-2">
              <Label>Tipo Imposta *</Label>
              <Select value={sottotipoOperazione} onValueChange={setSottotipoOperazione} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo imposta..." />
                </SelectTrigger>
                <SelectContent>
                  {SOTTOTIPI_IMPOSTE.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                className={ocrHighlight("dataOperazione")}
                onFocus={() => clearOcrField("dataOperazione")}
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
                className={ocrHighlight("numeroDocumento")}
                onFocus={() => clearOcrField("numeroDocumento")}
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
              className={ocrHighlight("descrizione")}
              onFocus={() => clearOcrField("descrizione")}
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
            {/* Categoria (full width, before importo) */}
            {!isTipoFinanziario && (
            <div className="space-y-2 sm:col-span-2">
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
            )}

            {/* Usage toggle (only if category has usage options) */}
            {isAcquisto && ivaApplicabile && selectedCategoria?.haOpzioniUso && selectedCategoria.opzioniUso && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Tipo di utilizzo</Label>
                <div className="flex gap-2">
                  {(selectedCategoria.opzioniUso as OpzioneUso[]).map((opt) => (
                    <Button
                      key={opt.codice}
                      type="button"
                      size="sm"
                      variant={opzioneUso === opt.codice ? "default" : "outline"}
                      onClick={() => handleOpzioneUsoChange(opt.codice)}
                      disabled={readOnly}
                      className="flex-1"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
                  className={`pl-8 ${ocrHighlight("importoTotale")}`}
                  placeholder="0,00"
                  disabled={readOnly}
                  onFocus={() => clearOcrField("importoTotale")}
                />
              </div>
            </div>
          </div>

          {/* IVA Summary Card */}
          {ivaApplicabile && calcoloIvaCompleto && parseFloat(importoTotale) > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 sm:col-span-2">
              <h4 className="text-sm font-semibold">
                {isAcquisto ? "Riepilogo fiscale" : "Scorporo IVA"}
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Totale fattura</span>
                <span className="text-right font-mono">{formatCurrency(parseFloat(importoTotale) || 0)}</span>

                <span className="text-muted-foreground">Imponibile (netto IVA {aliquotaIva}%)</span>
                <span className="text-right font-mono">{formatCurrency(calcoloIvaCompleto.imponibile)}</span>

                <span className="text-muted-foreground">
                  {isAcquisto ? "IVA totale" : "IVA a debito"}
                </span>
                <span className="text-right font-mono">{formatCurrency(calcoloIvaCompleto.ivaTotale)}</span>

                {isAcquisto && parseFloat(percentualeDetraibilitaIva) < 100 && parseFloat(percentualeDetraibilitaIva) > 0 && (
                  <>
                    <span className="text-muted-foreground pl-4">- IVA detraibile ({percentualeDetraibilitaIva}%)</span>
                    <span className="text-right font-mono text-green-600">{formatCurrency(calcoloIvaCompleto.ivaDetraibile)}</span>
                    <span className="text-muted-foreground pl-4">- IVA indetraibile</span>
                    <span className="text-right font-mono text-amber-600">{formatCurrency(calcoloIvaCompleto.ivaIndetraibile)}</span>
                  </>
                )}

                {isAcquisto && parseFloat(percentualeDetraibilitaIva) === 0 && (
                  <>
                    <span className="text-muted-foreground pl-4">- IVA interamente indetraibile</span>
                    <span className="text-right font-mono text-amber-600">{formatCurrency(calcoloIvaCompleto.ivaTotale)}</span>
                  </>
                )}
              </div>

              {isAcquisto && (
                <>
                  <Separator className="my-2" />

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Costo fiscale (imponibile + IVA indetr.)</span>
                    <span className="text-right font-mono font-semibold">{formatCurrency(baseDeducibilita)}</span>
                    <span className="text-muted-foreground">Deducibile ({percentualeDeducibilita}%)</span>
                    <span className="text-right font-mono font-semibold">{formatCurrency(parseFloat(importoDeducibile) || 0)}</span>
                  </div>
                </>
              )}

              {!ivaCustom && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-foreground mt-1"
                  onClick={() => setIvaCustom(true)}
                >
                  Modifica IVA manualmente
                </button>
              )}
            </div>
          )}

          {/* Manual IVA override (only if ivaCustom is true) */}
          {ivaApplicabile && ivaCustom && (
            <div className={`grid grid-cols-1 ${isAcquisto ? "sm:grid-cols-2" : ""} gap-4 sm:col-span-2 border rounded-lg p-3 bg-muted/20`}>
              <div className="space-y-2">
                <Label>Aliquota IVA</Label>
                <Select value={aliquotaIva} onValueChange={(v) => { setAliquotaIva(v); clearOcrField("aliquotaIva"); }} disabled={readOnly}>
                  <SelectTrigger className={ocrHighlight("aliquotaIva")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="22">22%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="4">4%</SelectItem>
                    <SelectItem value="0">Esente IVA (0%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAcquisto && (
                <div className="space-y-2">
                  <Label>% Detraibilita IVA</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={percentualeDetraibilitaIva}
                      onChange={(e) => setPercentualeDetraibilitaIva(e.target.value)}
                      disabled={readOnly}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => setIvaCustom(false)}
              >
                Ripristina IVA automatica
              </button>
            </div>
          )}

          {!isTipoFinanziario && (
            <>
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
                        const perc = parseFloat(e.target.value) || 0;
                        setImportoDeducibile(
                          String(calcolaDeducibilita(baseDeducibilita, perc))
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
                        const deduc = parseFloat(e.target.value) || 0;
                        if (baseDeducibilita > 0) {
                          setPercentualeDeducibilita(
                            String(
                              Math.round((deduc / baseDeducibilita) * 100 * 100) / 100
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2b: Dati Cespite (only when CESPITE) */}
      {tipoOperazione === "CESPITE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dati Cespite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aliquotaAmmortamento">
                  Aliquota Ammortamento (%) *
                </Label>
                <div className="relative">
                  <Input
                    id="aliquotaAmmortamento"
                    type="number"
                    step="0.01"
                    min="1"
                    max="100"
                    value={aliquotaAmmortamento}
                    onChange={(e) => setAliquotaAmmortamento(e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Il primo anno l&apos;aliquota sara dimezzata (
                  {formatPercentuale((parseFloat(aliquotaAmmortamento) || 0) / 2)}
                  )
                </p>
              </div>
              <div className="space-y-2">
                <Label>Anteprima Piano Ammortamento</Label>
                {pianoAmmortamento.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inserisci importo e aliquota
                  </p>
                ) : (
                  <div className="rounded-lg border max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anno</TableHead>
                          <TableHead className="text-right">Aliq.</TableHead>
                          <TableHead className="text-right">Quota</TableHead>
                          <TableHead className="text-right">Fondo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pianoAmmortamento.map((q) => (
                          <TableRow key={q.anno}>
                            <TableCell className="font-mono text-sm">
                              {q.anno}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatPercentuale(q.aliquotaApplicata)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(q.importoQuota)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(q.fondoProgressivo)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2c: Veicolo (only when CESPITE) */}
              {tipoOperazione === "CESPITE" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Veicolo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="isVeicolo"
                        checked={isVeicolo}
                        onCheckedChange={setIsVeicolo}
                      />
                      <Label htmlFor="isVeicolo">E&apos; un veicolo?</Label>
                    </div>

                    {isVeicolo && (
                      <div className="space-y-4 pt-2">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Marca *</Label>
                            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="es. Fiat" />
                          </div>
                          <div className="space-y-2">
                            <Label>Modello *</Label>
                            <Input value={modelloVeicolo} onChange={(e) => setModelloVeicolo(e.target.value)} placeholder="es. Panda" />
                          </div>
                          <div className="space-y-2">
                            <Label>Targa *</Label>
                            <Input value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} placeholder="es. AB123CD" />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Tipo Veicolo</Label>
                            <Select value={tipoVeicolo} onValueChange={(v) => setTipoVeicolo(v as TipoVeicolo)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(TIPO_VEICOLO_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Uso Veicolo</Label>
                            <Select value={usoVeicolo} onValueChange={(v) => setUsoVeicolo(v as UsoVeicolo)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(USO_VEICOLO_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {veicoloFiscale && (
                          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                            <p className="text-sm font-medium">Dati Fiscali (automatici)</p>
                            <div className="grid gap-2 sm:grid-cols-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Limite fiscale: </span>
                                <span className="font-mono font-medium">
                                  {veicoloFiscale.limiteFiscale === Infinity ? "Nessun limite" : formatCurrency(veicoloFiscale.limiteFiscale)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Deducibilita: </span>
                                <span className="font-mono font-medium">{veicoloFiscale.deducibilita}%</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">IVA detraibile: </span>
                                <span className="font-mono font-medium">{veicoloFiscale.detraibilitaIva}%</span>
                              </div>
                            </div>
                            {veicoloFiscale.superaLimite && (
                              <div className="flex items-center gap-2 text-amber-500 text-sm mt-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Il valore del bene supera il limite fiscale. L&apos;ammortamento sara calcolato su {formatCurrency(veicoloFiscale.baseFiscale)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Modalita Acquisto</Label>
                          <Select value={modalitaAcquisto} onValueChange={(v) => setModalitaAcquisto(v as "CONTANTI" | "FINANZIAMENTO")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(MODALITA_ACQUISTO_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {modalitaAcquisto === "FINANZIAMENTO" && (
                          <div className="space-y-4 rounded-lg border p-4">
                            <p className="text-sm font-medium">Dati Finanziamento</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Anticipo versato</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={anticipoFinanziamento}
                                  onChange={(e) => setAnticipoFinanziamento(e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Importo finanziato *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={importoFinanziato}
                                  onChange={(e) => setImportoFinanziato(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Numero rate *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={numeroRate}
                                  onChange={(e) => setNumeroRate(e.target.value)}
                                  placeholder="es. 48"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Importo rata mensile *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={importoRata}
                                  onChange={(e) => setImportoRata(e.target.value)}
                                  placeholder="es. 350.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                  TAN %
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Tasso Annuo Nominale - lo trovi nel contratto.<br/>Se non lo inserisci, gli interessi saranno stimati linearmente.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={tan}
                                  onChange={(e) => setTan(e.target.value)}
                                  placeholder="es. 5.50 (opzionale)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Data prima rata *</Label>
                                <Input
                                  type="date"
                                  value={dataPrimaRata}
                                  onChange={(e) => setDataPrimaRata(e.target.value)}
                                />
                              </div>
                            </div>

                            {finanziamentoPreview && (
                              <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Totale interessi:</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.totaleInteressi)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Interessi deducibili ({veicoloFiscale?.deducibilita}%):</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.interessiDeducibili)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span className="text-muted-foreground">Totale pagato (anticipo + rate):</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.totalePagato)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
            className="flex flex-wrap gap-3"
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
            {presetsDisponibili.map((preset) => {
              const hasInactiveSocio = preset.soci.some((s) => !s.socio.attivo);
              return (
                <div key={preset.id} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={`PRESET_${preset.id}`}
                    id={`rip-preset-${preset.id}`}
                  />
                  <Label
                    htmlFor={`rip-preset-${preset.id}`}
                    className="cursor-pointer font-normal flex items-center gap-1.5"
                  >
                    {preset.nome}
                    {hasInactiveSocio && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Contiene soci inattivi
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {presets.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <a href="/configurazione/ripartizioni" className="text-primary hover:underline">
                Gestisci preset di ripartizione →
              </a>
            </p>
          )}

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
                              ? "bg-red-500/15 text-red-400 border-red-500/25"
                              : "bg-green-500/15 text-green-400 border-green-500/25"
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

          {tipoRipartizione.startsWith("PRESET_") && (() => {
            const presetId = parseInt(tipoRipartizione.replace("PRESET_", ""), 10);
            const preset = presetsDisponibili.find((p) => p.id === presetId);
            if (!preset) return null;
            const importo = parseFloat(importoTotale) || 0;
            return (
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
                    {preset.soci.map((s) => {
                      const amount = Math.round(((importo * s.percentuale) / 100) * 100) / 100;
                      return (
                        <TableRow key={s.socioId}>
                          <TableCell className="flex items-center gap-1.5">
                            {s.socio.cognome} {s.socio.nome}
                            {!s.socio.attivo && (
                              <Badge variant="outline" className="text-orange-500 border-orange-500/25 text-xs">
                                Inattivo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPercentuale(s.percentuale)}
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
            );
          })()}
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

      {/* Section 5: Ricorrenza (solo per nuova operazione, non per editing, non per tipi finanziari) */}
      {!isEditing && !readOnly && !isTipoFinanziario && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RepeatIcon className="h-5 w-5" />
              Spesa Ricorrente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ricorrente">Rendi ricorrente</Label>
                <p className="text-xs text-muted-foreground">
                  La spesa verra generata automaticamente ogni mese
                </p>
              </div>
              <Switch
                id="ricorrente"
                checked={isRicorrente}
                onCheckedChange={setIsRicorrente}
              />
            </div>

            {isRicorrente && (
              <>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="giornoDelMese">Giorno del mese (1-31)</Label>
                    <Input
                      id="giornoDelMese"
                      type="number"
                      min="1"
                      max="31"
                      value={giornoDelMese}
                      onChange={(e) => setGiornoDelMese(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se il mese ha meno giorni, verra usato l&apos;ultimo giorno
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataFineRicorrenza">Data fine (opzionale)</Label>
                    <Input
                      id="dataFineRicorrenza"
                      type="date"
                      value={dataFineRicorrenza}
                      onChange={(e) => setDataFineRicorrenza(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se vuota, si rinnova fino a cancellazione manuale
                    </p>
                  </div>
                </div>

                {/* Leasing/NLT fields - only if category matches */}
                {isLeasingNltCategory && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <Label>Tipo di contratto</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={tipoContratto === "LEASING" ? "default" : "outline"}
                          onClick={() => setTipoContratto("LEASING")}
                          className="flex-1"
                        >
                          Leasing
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={tipoContratto === "NOLEGGIO_LUNGO_TERMINE" ? "default" : "outline"}
                          onClick={() => setTipoContratto("NOLEGGIO_LUNGO_TERMINE")}
                          className="flex-1"
                        >
                          Noleggio Lungo Termine
                        </Button>
                      </div>

                      {tipoContratto === "LEASING" && (
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                          <h4 className="font-medium text-sm">Dettagli Leasing</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Valore del veicolo</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={valoreBene}
                                  onChange={(e) => setValoreBene(e.target.value)}
                                  className="pl-8"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Anticipo / Maxicanone</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={maxicanoneImporto}
                                  onChange={(e) => setMaxicanoneImporto(e.target.value)}
                                  className="pl-8"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Durata contratto (mesi)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={durataContrattoMesi}
                                onChange={(e) => setDurataContrattoMesi(e.target.value)}
                                placeholder="48"
                              />
                            </div>
                          </div>
                          {leasingWarning && (
                            <div className="flex items-start gap-2 text-amber-600 text-sm bg-amber-500/10 rounded-lg p-3">
                              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium">Valore veicolo supera il limite di {formatCurrency(leasingWarning.limite)}</p>
                                <p>La deducibilita del canone sara ridotta proporzionalmente al {leasingWarning.coefficiente}%</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {tipoContratto === "NOLEGGIO_LUNGO_TERMINE" && (
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                          <h4 className="font-medium text-sm">Dettagli Noleggio Lungo Termine</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Di cui quota servizi</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={quotaServiziImporto}
                                  onChange={(e) => setQuotaServiziImporto(e.target.value)}
                                  className="pl-8"
                                  placeholder="0,00"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Manutenzione, assicurazione, bollo, ecc.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Anticipo (opzionale)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={maxicanoneImporto}
                                  onChange={(e) => setMaxicanoneImporto(e.target.value)}
                                  className="pl-8"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Durata contratto (mesi, opz.)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={durataContrattoMesi}
                                onChange={(e) => setDurataContrattoMesi(e.target.value)}
                                placeholder="Opzionale"
                              />
                            </div>
                          </div>
                          {nltWarning && (
                            <div className="flex items-start gap-2 text-amber-600 text-sm bg-amber-500/10 rounded-lg p-3">
                              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-medium">Quota locazione ({formatCurrency(nltWarning.quotaLocazione)}/mese) supera il limite</p>
                                <p>Limite annuo: {formatCurrency(nltWarning.limiteAnnuo)} ({formatCurrency(nltWarning.capMensile)}/mese). La deducibilita sara limitata.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

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
    </GlobalDropZone>
  );
}
