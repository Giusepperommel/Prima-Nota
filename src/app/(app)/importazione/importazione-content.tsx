"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SourceSelector } from "@/components/import/source-selector";
import { FieldMapper } from "@/components/import/field-mapper";
import { ImportPreview } from "@/components/import/import-preview";
import { Upload, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

type Step = "source" | "upload" | "mapping" | "preview" | "confirm";

const STEPS: { key: Step; label: string }[] = [
  { key: "source", label: "Sorgente" },
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Mapping" },
  { key: "preview", label: "Anteprima" },
  { key: "confirm", label: "Conferma" },
];

const TARGET_FIELDS = [
  "denominazione", "partitaIva", "codiceFiscale", "indirizzo", "email",
  "codice", "descrizione", "tipo", "dataOperazione", "importoTotale",
  "importoImponibile", "importoIva", "numeroDocumento", "tipoOperazione",
];

interface MappingRow {
  sourceKey: string;
  targetKey: string;
  required?: boolean;
  sampleValue?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: { rowNumber: number; field: string; message: string }[];
  validRows: number;
  totalRows: number;
}

interface ImportResult {
  success: boolean;
  righeImportate: number;
  righeErrore: number;
}

export function ImportazioneContent() {
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<{ rowNumber: number; data: Record<string, string> }[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [mappedPreview, setMappedPreview] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const text = await f.text();
    // Simple CSV parsing for preview (semicolon-separated, first line = headers)
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;

    const headers = lines[0].split(";").map((h) => h.trim().replace(/^"|"$/g, ""));

    const rows = lines.slice(1, 101).map((line, i) => {
      const values = line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] || ""; });
      return { rowNumber: i + 1, data: row };
    });

    setParsedRows(rows);

    // Auto-map fields
    const autoMappings: MappingRow[] = headers.map((h) => ({
      sourceKey: h,
      targetKey: findBestMatch(h),
      sampleValue: rows[0]?.data[h] || "",
    }));
    setMappings(autoMappings);
    setStep("mapping");
  }, []);

  const handleMapping = useCallback(() => {
    // Apply mappings to parsed rows for preview
    const mapped = parsedRows.map((row) => {
      const result: Record<string, unknown> = {};
      mappings.forEach((m) => {
        if (m.targetKey && m.targetKey !== "__skip__") {
          result[m.targetKey] = row.data[m.sourceKey];
        }
      });
      return result;
    });
    setMappedPreview(mapped);

    // Simple validation
    const errors: { rowNumber: number; field: string; message: string }[] = [];
    const requiredFields = mappings.filter((m) => m.required).map((m) => m.targetKey);
    mapped.forEach((row, i) => {
      requiredFields.forEach((f) => {
        if (!row[f]) errors.push({ rowNumber: i + 1, field: f, message: "Campo obbligatorio vuoto" });
      });
    });

    setValidationResult({
      valid: errors.length === 0,
      errors,
      validRows: mapped.length - new Set(errors.map((e) => e.rowNumber)).size,
      totalRows: mapped.length,
    });
    setStep("preview");
  }, [parsedRows, mappings]);

  const handleConfirm = useCallback(async () => {
    setImporting(true);
    try {
      // In a real implementation, this would POST to /api/importazione
      // For now, simulate success
      await new Promise((r) => setTimeout(r, 1500));
      setImportResult({
        success: true,
        righeImportate: validationResult?.validRows || 0,
        righeErrore: (validationResult?.totalRows || 0) - (validationResult?.validRows || 0),
      });
      setStep("confirm");
    } catch (err) {
      console.error("[Import] Error:", err);
    } finally {
      setImporting(false);
    }
  }, [validationResult]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`flex items-center gap-1 text-xs ${i <= stepIndex ? "text-blue-600 font-medium" : "text-muted-foreground"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${i <= stepIndex ? "bg-blue-600 text-white" : "bg-muted"}`}>
                {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {step === "source" && (
        <Card>
          <CardHeader><CardTitle>1. Seleziona Sorgente</CardTitle></CardHeader>
          <CardContent>
            <SourceSelector selected={source} onSelect={setSource} />
            <div className="flex justify-end mt-4">
              <Button onClick={() => setStep("upload")} disabled={!source}>
                Avanti <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>2. Carica File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Trascina il file qui o clicca per selezionare</p>
              <input type="file" accept=".csv,.txt,.xml" onChange={handleFileUpload} className="block mx-auto text-sm" />
              {file && <Badge variant="secondary" className="mt-2">{file.name} ({(file.size / 1024).toFixed(1)} KB)</Badge>}
            </div>
            <Button variant="outline" onClick={() => setStep("source")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card>
          <CardHeader><CardTitle>3. Mapping Campi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Associa i campi del file sorgente ai campi di Prima Nota. I campi non mappati verranno ignorati.</p>
            <FieldMapper
              mappings={mappings}
              availableTargets={TARGET_FIELDS}
              onMappingChange={(i, target) => {
                const updated = [...mappings];
                updated[i] = { ...updated[i], targetKey: target };
                setMappings(updated);
              }}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={handleMapping}>
                Anteprima <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader><CardTitle>4. Anteprima</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ImportPreview
              rows={mappedPreview}
              fields={mappings.filter((m) => m.targetKey && m.targetKey !== "__skip__").map((m) => m.targetKey)}
              errors={validationResult?.errors || []}
              totalRows={validationResult?.totalRows || 0}
              validRows={validationResult?.validRows || 0}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={handleConfirm} disabled={importing || (validationResult?.validRows === 0)}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Conferma Importazione
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && importResult && (
        <Card>
          <CardHeader><CardTitle>5. Risultato</CardTitle></CardHeader>
          <CardContent className="text-center space-y-3 py-8">
            <Check className="h-12 w-12 mx-auto text-emerald-600" />
            <h3 className="text-lg font-semibold">Importazione completata</h3>
            <p className="text-sm text-muted-foreground">
              {importResult.righeImportate} righe importate, {importResult.righeErrore} errori
            </p>
            <Button onClick={() => { setStep("source"); setFile(null); setParsedRows([]); setImportResult(null); }}>
              Nuova Importazione
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function findBestMatch(sourceKey: string): string {
  const lower = sourceKey.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    ragionesociale: "denominazione", denominazione: "denominazione", nome: "denominazione",
    customername: "denominazione", partitaiva: "partitaIva", piva: "partitaIva",
    codicefiscale: "codiceFiscale", indirizzo: "indirizzo", email: "email",
    codice: "codice", descrizione: "descrizione", tipo: "tipo",
    data: "dataOperazione", date: "dataOperazione", importo: "importoTotale",
    total: "importoTotale", numero: "numeroDocumento", number: "numeroDocumento",
  };
  return map[lower] || "__skip__";
}
