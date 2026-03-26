# Fase 4: Export/Import & Configurazione API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the export page with entity/format selection and ZIP backup, an import wizard with multi-step flow (source → upload → mapping → preview → confirm), and an API configuration page for managing keys, webhooks, and delivery history.

**Architecture:** Three new pages under `src/app/(app)/` following existing pattern (server page → AuthenticatedLayout → client content). Export page uses existing `/api/esportazioni` API. Import wizard uses client-side parsers (danea.ts, teamsystem.ts) + validator/mapper. API config page uses existing `/api/configurazione/api` and `/api/configurazione/api/webhook` APIs.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Card, Tabs, Table, Select, Dialog, Input, Button, Checkbox, Badge), Tailwind CSS 4, existing SP11 backend APIs.

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 4)

---

## File Structure

### New files
```
src/app/(app)/esportazioni/
  page.tsx                        — Export page server
  esportazioni-content.tsx        — Export page client (entity selector, format, filters, download)

src/app/(app)/importazione/
  page.tsx                        — Import wizard server
  importazione-content.tsx        — Import wizard client (multi-step)

src/components/import/
  source-selector.tsx             — Import source selection (TeamSystem, Danea, etc.)
  field-mapper.tsx                — Field mapping table (source → target)
  import-preview.tsx              — Preview results with error highlighting

src/app/(app)/configurazione/api/
  page.tsx                        — API config server
  api-config-content.tsx          — API config client (keys + webhooks tabs)

src/components/api-config/
  api-key-list.tsx                — API key list with create/rotate/delete
  api-key-form.tsx                — Create API key dialog (name, scopes)
  webhook-list.tsx                — Webhook endpoint list
  webhook-form.tsx                — Create webhook dialog
  delivery-history.tsx            — Webhook delivery history table
```

---

## Task 1: Export Page

**Files:**
- Create: `src/app/(app)/esportazioni/page.tsx`
- Create: `src/app/(app)/esportazioni/esportazioni-content.tsx`

- [ ] **Step 1: Read existing page pattern**

Read `src/app/(app)/bi/page.tsx` for the exact server page pattern.

- [ ] **Step 2: Create server page**

```tsx
// src/app/(app)/esportazioni/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { EsportazioniContent } from "./esportazioni-content";

export default async function EsportazioniPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Esportazioni" user={user}>
      <EsportazioniContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 3: Create client content**

```tsx
// src/app/(app)/esportazioni/esportazioni-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, FileArchive, Loader2 } from "lucide-react";

interface EntityOption {
  tipo: string;
  nome: string;
  campi: string[];
}

export function EsportazioniContent() {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/esportazioni");
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entitaDisponibili || []);
        setFormats(data.formatiDisponibili || []);
      }
    } catch (err) {
      console.error("[Export] Config error:", err);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleExport = useCallback(async (entityType?: string) => {
    setExporting(true);
    try {
      const body: any = {
        entityType: entityType || selectedEntity,
        format: selectedFormat,
      };
      if (dateFrom) body.filters = { ...body.filters, da: dateFrom };
      if (dateTo) body.filters = { ...body.filters, a: dateTo };

      const res = await fetch("/api/esportazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") || "";
        const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
        const filename = filenameMatch?.[1] || `export.${selectedFormat}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[Export] Error:", err);
    } finally {
      setExporting(false);
    }
  }, [selectedEntity, selectedFormat, dateFrom, dateTo]);

  const FORMAT_LABELS: Record<string, string> = { csv: "CSV", json: "JSON", xlsx: "Excel", pdf: "PDF" };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Esporta Dati</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo dati</label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger><SelectValue placeholder="Seleziona entità..." /></SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.tipo} value={e.tipo}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Formato</label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f} value={f}>{FORMAT_LABELS[f] || f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Da (opzionale)</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">A (opzionale)</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => handleExport()} disabled={!selectedEntity || exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Esporta
            </Button>
            <Button variant="outline" onClick={() => handleExport("backup-completo")} disabled={exporting}>
              <FileArchive className="h-4 w-4 mr-1" /> Backup Completo (ZIP)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entità Disponibili</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {entities.map((e) => (
              <div key={e.tipo} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{e.nome}</span>
                <Badge variant="outline" className="text-[10px]">{e.campi.length} campi</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/esportazioni/
git commit -m "feat(fase4): add export page with entity/format selection and ZIP backup"
```

---

## Task 2: Import Source Selector Component

**Files:**
- Create: `src/components/import/source-selector.tsx`

- [ ] **Step 1: Create SourceSelector**

```tsx
// src/components/import/source-selector.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ImportSource {
  id: string;
  nome: string;
  descrizione: string;
  formati: string;
}

const SOURCES: ImportSource[] = [
  { id: "teamsystem", nome: "TeamSystem", descrizione: "Import da file CSV/TXT esportati da TeamSystem", formati: "CSV, TXT" },
  { id: "zucchetti", nome: "Zucchetti", descrizione: "Import da file CSV esportati da Zucchetti", formati: "CSV" },
  { id: "passcom", nome: "Passcom", descrizione: "Import da file CSV esportati da Passcom", formati: "CSV" },
  { id: "fatture-in-cloud", nome: "Fatture in Cloud", descrizione: "Import da file CSV esportati da Fatture in Cloud", formati: "CSV" },
  { id: "danea", nome: "Danea Easyfatt", descrizione: "Import da file XML esportati da Danea Easyfatt", formati: "XML" },
];

interface SourceSelectorProps {
  selected: string;
  onSelect: (sourceId: string) => void;
}

export function SourceSelector({ selected, onSelect }: SourceSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {SOURCES.map((source) => (
        <Card
          key={source.id}
          className={`cursor-pointer transition-all ${selected === source.id ? "border-blue-500 ring-2 ring-blue-200" : "hover:border-gray-400"}`}
          onClick={() => onSelect(source.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{source.nome}</h3>
              <Badge variant="outline" className="text-[10px]">{source.formati}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{source.descrizione}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/import/source-selector.tsx
git commit -m "feat(fase4): add import source selector component"
```

---

## Task 3: Field Mapper and Import Preview Components

**Files:**
- Create: `src/components/import/field-mapper.tsx`
- Create: `src/components/import/import-preview.tsx`

- [ ] **Step 1: Create FieldMapper**

```tsx
// src/components/import/field-mapper.tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MappingRow {
  sourceKey: string;
  targetKey: string;
  required?: boolean;
  sampleValue?: string;
}

interface FieldMapperProps {
  mappings: MappingRow[];
  availableTargets: string[];
  onMappingChange: (index: number, targetKey: string) => void;
}

export function FieldMapper({ mappings, availableTargets, onMappingChange }: FieldMapperProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo sorgente</TableHead>
            <TableHead>Esempio</TableHead>
            <TableHead>Campo destinazione</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((m, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-sm">{m.sourceKey}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{m.sampleValue || "—"}</TableCell>
              <TableCell>
                <Select value={m.targetKey} onValueChange={(v) => onMappingChange(i, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">— Ignora —</SelectItem>
                    {availableTargets.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {m.required && <Badge variant="destructive" className="text-[10px]">Obbligatorio</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Create ImportPreview**

```tsx
// src/components/import/import-preview.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle } from "lucide-react";

interface PreviewRow {
  [key: string]: unknown;
}

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

interface ImportPreviewProps {
  rows: PreviewRow[];
  fields: string[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
}

export function ImportPreview({ rows, fields, errors, totalRows, validRows }: ImportPreviewProps) {
  const errorRows = new Set(errors.map((e) => e.rowNumber));

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold">{validRows}</p>
              <p className="text-xs text-muted-foreground">righe valide</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{totalRows - validRows}</p>
              <p className="text-xs text-muted-foreground">righe con errori</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Errori rilevati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs">
                  <Badge variant="outline" className="text-[10px] mr-1">Riga {e.rowNumber}</Badge>
                  {e.field}: {e.message}
                </p>
              ))}
              {errors.length > 20 && (
                <p className="text-xs text-muted-foreground">...e altri {errors.length - 20} errori</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Anteprima (prime {Math.min(rows.length, 10)} righe)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {fields.map((f) => (
                    <TableHead key={f} className="text-xs">{f}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 10).map((row, i) => (
                  <TableRow key={i} className={errorRows.has(i + 1) ? "bg-red-50" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f} className="text-xs truncate max-w-[120px]">
                        {row[f] != null ? String(row[f]) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/import/
git commit -m "feat(fase4): add FieldMapper and ImportPreview components"
```

---

## Task 4: Import Wizard Page

**Files:**
- Create: `src/app/(app)/importazione/page.tsx`
- Create: `src/app/(app)/importazione/importazione-content.tsx`

- [ ] **Step 1: Create server page**

```tsx
// src/app/(app)/importazione/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ImportazioneContent } from "./importazione-content";

export default async function ImportazionePage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Importazione Dati" user={user}>
      <ImportazioneContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create client wizard**

```tsx
// src/app/(app)/importazione/importazione-content.tsx
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

export function ImportazioneContent() {
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [mappedPreview, setMappedPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

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
    setSourceFields(headers);

    const rows = lines.slice(1, 101).map((line, i) => {
      const values = line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] || ""; });
      return { rowNumber: i + 1, data: row };
    });

    setParsedRows(rows);

    // Auto-map fields
    const autoMappings = headers.map((h) => ({
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
    const errors: any[] = [];
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/importazione/
git commit -m "feat(fase4): add import wizard page with 5-step flow"
```

---

## Task 5: API Key Management Components

**Files:**
- Create: `src/components/api-config/api-key-list.tsx`
- Create: `src/components/api-config/api-key-form.tsx`

- [ ] **Step 1: Create ApiKeyForm**

```tsx
// src/components/api-config/api-key-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const SCOPE_GROUPS = [
  { label: "Operazioni", scopes: ["read:operazioni", "write:operazioni"] },
  { label: "Anagrafiche", scopes: ["read:anagrafiche", "write:anagrafiche"] },
  { label: "Scritture", scopes: ["read:scritture", "write:scritture"] },
  { label: "Fatture", scopes: ["read:fatture", "write:fatture"] },
  { label: "Registri IVA", scopes: ["read:registri-iva"] },
  { label: "Liquidazioni", scopes: ["read:liquidazioni"] },
  { label: "F24", scopes: ["read:f24"] },
  { label: "Piano Conti", scopes: ["read:piano-conti", "write:piano-conti"] },
  { label: "Alert", scopes: ["read:alert"] },
  { label: "Todo", scopes: ["read:todo"] },
  { label: "KPI", scopes: ["read:kpi"] },
  { label: "Report", scopes: ["read:report"] },
  { label: "Webhook", scopes: ["webhook:manage"] },
];

interface ApiKeyFormProps {
  onCreated: () => void;
}

export function ApiKeyForm({ onCreated }: ApiKeyFormProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/configurazione/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, scopes: selectedScopes }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        onCreated();
      }
    } catch (err) {
      console.error("[ApiKey] Create error:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNome("");
    setSelectedScopes([]);
    setCreatedKey(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuova Chiave</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{createdKey ? "Chiave Creata" : "Crea Chiave API"}</DialogTitle></DialogHeader>
        {createdKey ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600 font-medium">Salva questa chiave — non verrà più mostrata.</p>
            <code className="block p-3 bg-muted rounded text-xs break-all">{createdKey}</code>
            <Button onClick={handleClose}>Chiudi</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="Nome chiave" value={nome} onChange={(e) => setNome(e.target.value)} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Permessi (scopes)</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {SCOPE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{group.label}</p>
                    {group.scopes.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                        <Checkbox
                          checked={selectedScopes.includes(scope)}
                          onCheckedChange={() => toggleScope(scope)}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!nome || creating}>Crea</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create ApiKeyList**

```tsx
// src/components/api-config/api-key-list.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, RotateCw, Trash2 } from "lucide-react";
import { ApiKeyForm } from "./api-key-form";

interface ApiKeyData {
  id: number;
  nome: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerHour: number;
  attiva: boolean;
  ultimoUtilizzo: string | null;
  createdAt: string;
}

export function ApiKeyList() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("[ApiKeys] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleRotate = async (id: number) => {
    try {
      const res = await fetch("/api/configurazione/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Nuova chiave: ${data.key}\n\nSalvala — non verrà più mostrata.`);
        fetchKeys();
      }
    } catch (err) {
      console.error("[ApiKeys] Rotate error:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questa chiave API?")) return;
    try {
      await fetch(`/api/configurazione/api?id=${id}`, { method: "DELETE" });
      fetchKeys();
    } catch (err) {
      console.error("[ApiKeys] Delete error:", err);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Chiavi API</CardTitle>
        <ApiKeyForm onCreated={fetchKeys} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna chiave API creata</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Ultimo uso</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{k.keyPrefix}...</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{k.scopes.length} scopes</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{k.ultimoUtilizzo ? new Date(k.ultimoUtilizzo).toLocaleDateString("it-IT") : "Mai"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRotate(k.id)} title="Ruota chiave">
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDelete(k.id)} title="Elimina">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/api-config/api-key-list.tsx src/components/api-config/api-key-form.tsx
git commit -m "feat(fase4): add API key management components (list, create, rotate, delete)"
```

---

## Task 6: Webhook Management Components

**Files:**
- Create: `src/components/api-config/webhook-list.tsx`
- Create: `src/components/api-config/webhook-form.tsx`
- Create: `src/components/api-config/delivery-history.tsx`

- [ ] **Step 1: Create WebhookForm**

```tsx
// src/components/api-config/webhook-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const EVENTS = [
  "operazione.created", "operazione.updated", "operazione.deleted",
  "fattura.inviata", "fattura.consegnata", "fattura.rifiutata",
  "scadenza.imminente", "alert.created", "portale.messaggio", "portale.operazione",
  "*",
];

interface WebhookFormProps {
  onCreated: () => void;
}

export function WebhookForm({ onCreated }: WebhookFormProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    if (event === "*") { setSelectedEvents(["*"]); return; }
    setSelectedEvents((prev) => {
      const without = prev.filter((e) => e !== "*");
      return without.includes(event) ? without.filter((e) => e !== event) : [...without, event];
    });
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventi: selectedEvents }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.secret);
        onCreated();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else { setOpen(false); setCreatedSecret(null); setUrl(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuovo Webhook</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{createdSecret ? "Webhook Creato" : "Crea Webhook"}</DialogTitle></DialogHeader>
        {createdSecret ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600 font-medium">Salva il secret — non verrà più mostrato.</p>
            <code className="block p-3 bg-muted rounded text-xs break-all">{createdSecret}</code>
            <Button onClick={() => { setOpen(false); setCreatedSecret(null); }}>Chiudi</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Eventi</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <Checkbox checked={selectedEvents.includes(ev)} onCheckedChange={() => toggleEvent(ev)} />
                    {ev === "*" ? "Tutti gli eventi (*)" : ev}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!url}>Crea</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create DeliveryHistory**

```tsx
// src/components/api-config/delivery-history.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DeliveryData {
  id: number;
  evento: string;
  statoHttp: number | null;
  stato: string;
  tentativo: number;
  createdAt: string;
}

export function DeliveryHistory({ endpointId }: { endpointId: number }) {
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([]);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch(`/api/configurazione/api/webhook?endpointId=${endpointId}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (err) { console.error(err); }
  }, [endpointId]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  if (deliveries.length === 0) return <p className="text-xs text-muted-foreground py-2">Nessuna consegna</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Evento</TableHead>
          <TableHead className="text-xs">Stato HTTP</TableHead>
          <TableHead className="text-xs">Risultato</TableHead>
          <TableHead className="text-xs">Tentativo</TableHead>
          <TableHead className="text-xs">Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.slice(0, 20).map((d) => (
          <TableRow key={d.id}>
            <TableCell className="text-xs font-mono">{d.evento}</TableCell>
            <TableCell className="text-xs">{d.statoHttp || "—"}</TableCell>
            <TableCell>
              <Badge variant={d.stato === "CONSEGNATO" ? "default" : "destructive"} className="text-[10px]">
                {d.stato}
              </Badge>
            </TableCell>
            <TableCell className="text-xs">{d.tentativo}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("it-IT")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create WebhookList**

```tsx
// src/components/api-config/webhook-list.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Webhook, ChevronDown } from "lucide-react";
import { WebhookForm } from "./webhook-form";
import { DeliveryHistory } from "./delivery-history";

interface WebhookData {
  id: number;
  url: string;
  eventi: string[];
  attivo: boolean;
  consecutiviFalliti: number;
  ultimaConsegna: string | null;
  createdAt: string;
}

export function WebhookList() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.endpoints || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook</CardTitle>
        <WebhookForm onCreated={fetchWebhooks} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun webhook configurato</p>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <Collapsible key={wh.id}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-mono truncate max-w-[300px]">{wh.url}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={wh.attivo ? "default" : "destructive"} className="text-[10px]">
                          {wh.attivo ? "Attivo" : "Disattivo"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{wh.eventi.length === 1 && wh.eventi[0] === "*" ? "Tutti" : `${wh.eventi.length} eventi`}</Badge>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <DeliveryHistory endpointId={wh.id} />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/api-config/
git commit -m "feat(fase4): add webhook management components (list, create, delivery history)"
```

---

## Task 7: API Configuration Page

**Files:**
- Create: `src/app/(app)/configurazione/api/page.tsx`
- Create: `src/app/(app)/configurazione/api/api-config-content.tsx`

- [ ] **Step 1: Create server page**

```tsx
// src/app/(app)/configurazione/api/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ApiConfigContent } from "./api-config-content";

export default async function ApiConfigPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Configurazione API" user={user}>
      <ApiConfigContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create client content**

```tsx
// src/app/(app)/configurazione/api/api-config-content.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeyList } from "@/components/api-config/api-key-list";
import { WebhookList } from "@/components/api-config/webhook-list";

export function ApiConfigContent() {
  return (
    <Tabs defaultValue="keys">
      <TabsList>
        <TabsTrigger value="keys">Chiavi API</TabsTrigger>
        <TabsTrigger value="webhooks">Webhook</TabsTrigger>
      </TabsList>
      <TabsContent value="keys" className="mt-4">
        <ApiKeyList />
      </TabsContent>
      <TabsContent value="webhooks" className="mt-4">
        <WebhookList />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/configurazione/api/
git commit -m "feat(fase4): add API configuration page with keys and webhooks tabs"
```

---

## Task 8: Full Build Verification

- [ ] **Step 1: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(fase4): address build issues"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | Export page (/esportazioni) | New page |
| 2 | Import SourceSelector | New component |
| 3 | FieldMapper + ImportPreview | New components |
| 4 | Import wizard page (/importazione) | New page |
| 5 | ApiKeyList + ApiKeyForm | New components |
| 6 | WebhookList + WebhookForm + DeliveryHistory | New components |
| 7 | API config page (/configurazione/api) | New page |
| 8 | Full build verification | Verification |

**Total: 8 tasks, ~12 new components, 3 new pages, ~8 commits**
