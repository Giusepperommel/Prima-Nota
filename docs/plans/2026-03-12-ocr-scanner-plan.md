# OCR Document Scanner - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere drag & drop e paste di documenti (immagini/PDF) nella sezione "Nuova Operazione" per pre-compilare il form tramite OCR con Tesseract.js.

**Architecture:** L'intera sezione "Nuova Operazione" diventa una drop zone invisibile. Al drop/paste, Tesseract.js esegue OCR lato browser, un parser con regex italiani estrae i dati, e i campi del form vengono pre-compilati con highlight visivo. L'utente modifica e salva normalmente.

**Tech Stack:** Tesseract.js v5 (OCR browser), pdfjs-dist (PDF→immagine), Next.js App Router, React, TypeScript, shadcn/ui, Tailwind CSS

---

### Task 1: Tipi e Interfacce OCR

**Files:**
- Create: `src/lib/ocr/types.ts`

**Step 1: Creare il file dei tipi**

```typescript
// src/lib/ocr/types.ts

export type OcrResult = {
  rawText: string;
  confidence: number;
};

export type ParsedDocument = {
  dataOperazione: string | null;       // ISO date string YYYY-MM-DD
  numeroDocumento: string | null;
  descrizione: string | null;
  importoTotale: number | null;
  imponibile: number | null;
  aliquotaIva: string | null;          // "22", "10", "4"
  importoIva: number | null;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA" | null;
  fornitore: string | null;
};

export type OcrStatus = "idle" | "loading" | "processing" | "parsing" | "done" | "error";

export type OcrFieldsSet = Set<keyof ParsedDocument>;
```

**Step 2: Commit**

```bash
git add src/lib/ocr/types.ts
git commit -m "feat(ocr): add OCR types and interfaces"
```

---

### Task 2: Parser Documenti Italiani

**Files:**
- Create: `src/lib/ocr/parser.ts`
- Create: `src/lib/ocr/__tests__/parser.test.ts`

**Step 1: Scrivere i test per il parser**

```typescript
// src/lib/ocr/__tests__/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseDocumentText } from "../parser";

describe("parseDocumentText", () => {
  it("estrae data in formato DD/MM/YYYY", () => {
    const result = parseDocumentText("Fattura del 15/03/2026");
    expect(result.dataOperazione).toBe("2026-03-15");
  });

  it("estrae numero fattura", () => {
    const result = parseDocumentText("Fattura n. 123/2026");
    expect(result.numeroDocumento).toBe("123/2026");
  });

  it("estrae importo totale con simbolo euro", () => {
    const result = parseDocumentText("Totale € 1.234,56");
    expect(result.importoTotale).toBe(1234.56);
  });

  it("estrae importo totale senza simbolo", () => {
    const result = parseDocumentText("Totale: 500,00");
    expect(result.importoTotale).toBe(500.0);
  });

  it("estrae imponibile", () => {
    const result = parseDocumentText("Imponibile € 1.000,00\nIVA 22% € 220,00\nTotale € 1.220,00");
    expect(result.imponibile).toBe(1000.0);
    expect(result.aliquotaIva).toBe("22");
    expect(result.importoIva).toBe(220.0);
    expect(result.importoTotale).toBe(1220.0);
  });

  it("estrae aliquota IVA dal testo", () => {
    const result = parseDocumentText("IVA 10%");
    expect(result.aliquotaIva).toBe("10");
  });

  it("riconosce aliquota IVA 4%", () => {
    const result = parseDocumentText("IVA al 4%");
    expect(result.aliquotaIva).toBe("4");
  });

  it("estrae fornitore da ragione sociale", () => {
    const result = parseDocumentText("Mario Rossi S.r.l.\nVia Roma 1\nFattura n. 42");
    expect(result.fornitore).not.toBeNull();
  });

  it("costruisce descrizione da fornitore e numero documento", () => {
    const text = "ACME S.r.l.\nFattura n. 99/2026\nTotale € 100,00";
    const result = parseDocumentText(text);
    expect(result.descrizione).toContain("99/2026");
  });

  it("imposta tipoOperazione COSTO di default", () => {
    const result = parseDocumentText("Totale € 100,00");
    expect(result.tipoOperazione).toBe("COSTO");
  });

  it("restituisce null per campi non trovati", () => {
    const result = parseDocumentText("testo casuale senza dati");
    expect(result.importoTotale).toBeNull();
    expect(result.numeroDocumento).toBeNull();
    expect(result.dataOperazione).toBeNull();
  });

  it("gestisce importi con punto come separatore migliaia", () => {
    const result = parseDocumentText("Totale € 12.500,00");
    expect(result.importoTotale).toBe(12500.0);
  });

  it("gestisce importi senza centesimi", () => {
    const result = parseDocumentText("Totale € 500");
    expect(result.importoTotale).toBe(500);
  });
});
```

**Step 2: Verificare che i test falliscano**

Run: `npx vitest run src/lib/ocr/__tests__/parser.test.ts`
Expected: FAIL - module not found

**Step 3: Implementare il parser**

```typescript
// src/lib/ocr/parser.ts
import type { ParsedDocument } from "./types";

/**
 * Parse un importo in formato italiano (1.234,56) in numero
 */
function parseImportoItaliano(raw: string): number | null {
  // Rimuove spazi e simbolo €
  const cleaned = raw.replace(/[€\s]/g, "").trim();
  if (!cleaned) return null;

  // Formato italiano: 1.234,56 → 1234.56
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Parse una data italiana DD/MM/YYYY in ISO YYYY-MM-DD
 */
function parseDataItaliana(raw: string): string | null {
  const match = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = day.padStart(2, "0");
  const m = month.padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function parseDocumentText(text: string): ParsedDocument {
  const result: ParsedDocument = {
    dataOperazione: null,
    numeroDocumento: null,
    descrizione: null,
    importoTotale: null,
    imponibile: null,
    aliquotaIva: null,
    importoIva: null,
    tipoOperazione: null,
    fornitore: null,
  };

  // --- Data ---
  // Cerca pattern: "data" / "del" / "Data fattura" seguito da DD/MM/YYYY
  const dataPatterns = [
    /(?:data|del|in data|emessa il|data fattura)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,  // fallback: prima data trovata
  ];
  for (const pattern of dataPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.dataOperazione = parseDataItaliana(match[1]);
      if (result.dataOperazione) break;
    }
  }

  // --- Numero documento ---
  const numDocPatterns = [
    /(?:fattura|fatt\.|documento|doc\.|ricevuta|nota)\s*(?:n\.|n°|nr\.?|numero)?\s*[:\s]*([A-Za-z0-9\/\-]+)/i,
    /(?:n\.|n°|nr\.?)\s*([A-Za-z0-9\/\-]+)/i,
  ];
  for (const pattern of numDocPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.numeroDocumento = match[1].trim();
      break;
    }
  }

  // --- Importi ---
  // Totale (cerca l'ultimo "Totale" nel documento, che è di solito il totale finale)
  const totaleMatches = text.matchAll(
    /(?:totale\s*(?:documento|fattura|da pagare|generale|complessivo)?)[:\s]*€?\s*([\d.,]+)/gi
  );
  const totali = [...totaleMatches];
  if (totali.length > 0) {
    const lastTotale = totali[totali.length - 1];
    result.importoTotale = parseImportoItaliano(lastTotale[1]);
  }

  // Imponibile
  const imponibileMatch = text.match(
    /(?:imponibile|base imponibile|totale imponibile)[:\s]*€?\s*([\d.,]+)/i
  );
  if (imponibileMatch) {
    result.imponibile = parseImportoItaliano(imponibileMatch[1]);
  }

  // Importo IVA
  const importoIvaMatch = text.match(
    /(?:iva|imposta)[:\s]*(?:\d+%?\s*)?€?\s*([\d.,]+)/i
  );
  if (importoIvaMatch) {
    result.importoIva = parseImportoItaliano(importoIvaMatch[1]);
  }

  // --- Aliquota IVA ---
  const aliquotaMatch = text.match(/(?:iva|aliquota)[:\s]*(?:al\s*)?(\d{1,2})\s*%/i);
  if (aliquotaMatch) {
    const aliquota = aliquotaMatch[1];
    if (["4", "5", "10", "22"].includes(aliquota)) {
      result.aliquotaIva = aliquota;
    }
  }

  // --- Fornitore ---
  // Prima riga non vuota che non è una data o un numero
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    // Salta righe che sono solo date, numeri, o parole chiave
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(line)) continue;
    if (/^(fattura|ricevuta|nota|documento|data|totale|iva)/i.test(line)) continue;
    if (/^\d+[,.]?\d*$/.test(line)) continue;
    if (line.length < 3) continue;
    result.fornitore = line;
    break;
  }

  // --- Descrizione ---
  if (result.fornitore || result.numeroDocumento) {
    const parts: string[] = [];
    if (result.numeroDocumento) parts.push(`Fatt. ${result.numeroDocumento}`);
    if (result.fornitore) parts.push(result.fornitore);
    result.descrizione = parts.join(" - ");
  }

  // --- Tipo operazione ---
  // Default COSTO, potrebbe essere FATTURA_ATTIVA se troviamo pattern specifici
  if (result.importoTotale !== null || result.descrizione) {
    result.tipoOperazione = "COSTO";
  }

  // Se non abbiamo trovato un totale ma abbiamo un importo generico
  if (result.importoTotale === null) {
    const importoGenerico = text.match(/€\s*([\d.,]+)/);
    if (importoGenerico) {
      result.importoTotale = parseImportoItaliano(importoGenerico[1]);
    }
  }

  return result;
}
```

**Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/lib/ocr/__tests__/parser.test.ts`
Expected: PASS (tutti i test)

**Step 5: Commit**

```bash
git add src/lib/ocr/parser.ts src/lib/ocr/__tests__/parser.test.ts
git commit -m "feat(ocr): add Italian document parser with tests"
```

---

### Task 3: Tesseract.js Worker Wrapper

**Files:**
- Create: `src/lib/ocr/tesseract-worker.ts`

**Step 1: Installare Tesseract.js**

Run: `npm install tesseract.js`

**Step 2: Creare il wrapper**

```typescript
// src/lib/ocr/tesseract-worker.ts
import { createWorker, Worker } from "tesseract.js";
import type { OcrResult } from "./types";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("ita", undefined, {
      logger: () => {}, // silent
    });
  }
  return worker;
}

export async function recognizeImage(image: File | Blob | string): Promise<OcrResult> {
  const w = await getWorker();
  const { data } = await w.recognize(image);
  return {
    rawText: data.text,
    confidence: data.confidence,
  };
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ocr/tesseract-worker.ts package.json package-lock.json
git commit -m "feat(ocr): add Tesseract.js worker wrapper"
```

---

### Task 4: PDF Extractor

**Files:**
- Create: `src/lib/ocr/pdf-extractor.ts`

**Step 1: Installare pdfjs-dist**

Run: `npm install pdfjs-dist`

**Step 2: Creare il PDF extractor**

```typescript
// src/lib/ocr/pdf-extractor.ts

export async function pdfToImage(file: File): Promise<Blob> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Solo prima pagina

  const scale = 2; // Alta risoluzione per OCR
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d")!;
  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Errore conversione PDF in immagine"));
      },
      "image/png"
    );
  });
}
```

**Step 3: Commit**

```bash
git add src/lib/ocr/pdf-extractor.ts package.json package-lock.json
git commit -m "feat(ocr): add PDF to image extractor"
```

---

### Task 5: Hook useOcr

**Files:**
- Create: `src/hooks/use-ocr.ts`

**Step 1: Creare l'hook**

```typescript
// src/hooks/use-ocr.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { OcrResult, OcrStatus, ParsedDocument } from "@/lib/ocr/types";
import { parseDocumentText } from "@/lib/ocr/parser";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES];

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [result, setResult] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const processFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato non supportato. Usa PNG, JPG, WEBP o PDF.");
      return;
    }

    processingRef.current = true;
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      let imageInput: File | Blob = file;

      // Se è un PDF, convertilo in immagine
      if (ACCEPTED_PDF_TYPES.includes(file.type)) {
        setStatus("processing");
        const { pdfToImage } = await import("@/lib/ocr/pdf-extractor");
        imageInput = await pdfToImage(file);
      }

      // OCR con Tesseract
      setStatus("processing");
      const { recognizeImage } = await import("@/lib/ocr/tesseract-worker");
      const ocrResult: OcrResult = await recognizeImage(imageInput);

      // Parsing del testo
      setStatus("parsing");
      const parsed = parseDocumentText(ocrResult.rawText);
      setResult(parsed);
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Errore durante la scansione OCR");
      setStatus("error");
    } finally {
      processingRef.current = false;
    }
  }, []);

  const processImage = useCallback(async (blob: Blob) => {
    // Converte Blob in File per uniformità
    const file = new File([blob], "screenshot.png", { type: blob.type || "image/png" });
    await processFile(file);
  }, [processFile]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    result,
    error,
    isProcessing: status === "loading" || status === "processing" || status === "parsing",
    processFile,
    processImage,
    reset,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-ocr.ts
git commit -m "feat(ocr): add useOcr hook for OCR pipeline orchestration"
```

---

### Task 6: Componente GlobalDropZone

**Files:**
- Create: `src/components/ocr/global-drop-zone.tsx`

**Step 1: Creare il componente**

```tsx
// src/components/ocr/global-drop-zone.tsx
"use client";

import { useState, useCallback, useRef, type ReactNode, type DragEvent } from "react";
import { Upload } from "lucide-react";

type Props = {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function GlobalDropZone({ onFileDrop, disabled, children }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFileDrop(files[0]);
      }
    },
    [onFileDrop, disabled]
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-amber-500 bg-amber-500/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-amber-500">
            <Upload className="h-10 w-10" />
            <p className="text-lg font-medium">Rilascia per scansionare</p>
            <p className="text-sm text-amber-400">Immagine o PDF</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ocr/global-drop-zone.tsx
git commit -m "feat(ocr): add GlobalDropZone component with drag overlay"
```

---

### Task 7: Componente PasteField

**Files:**
- Create: `src/components/ocr/paste-field.tsx`

**Step 1: Creare il componente**

```tsx
// src/components/ocr/paste-field.tsx
"use client";

import { useCallback, useRef } from "react";
import { ClipboardPaste } from "lucide-react";

type Props = {
  onImagePaste: (blob: Blob) => void;
  disabled?: boolean;
};

export function PasteField({ onImagePaste, disabled }: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            onImagePaste(blob);
          }
          return;
        }
      }
    },
    [onImagePaste, disabled]
  );

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onPaste={handlePaste}
      className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-text"
    >
      <ClipboardPaste className="h-4 w-4 shrink-0" />
      <span>Clicca qui e incolla uno screenshot (Ctrl+V / Cmd+V)</span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ocr/paste-field.tsx
git commit -m "feat(ocr): add PasteField component for screenshot paste"
```

---

### Task 8: Componente OcrOverlay (spinner durante scansione)

**Files:**
- Create: `src/components/ocr/ocr-overlay.tsx`

**Step 1: Creare il componente**

```tsx
// src/components/ocr/ocr-overlay.tsx
"use client";

import { Loader2 } from "lucide-react";
import type { OcrStatus } from "@/lib/ocr/types";

type Props = {
  status: OcrStatus;
};

const STATUS_MESSAGES: Record<OcrStatus, string> = {
  idle: "",
  loading: "Caricamento motore OCR...",
  processing: "Scansione in corso...",
  parsing: "Estrazione dati...",
  done: "",
  error: "",
};

export function OcrOverlay({ status }: Props) {
  const message = STATUS_MESSAGES[status];
  if (!message) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ocr/ocr-overlay.tsx
git commit -m "feat(ocr): add OcrOverlay loading spinner component"
```

---

### Task 9: Integrazione OCR nel Form Operazione

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`

Questa è la task più complessa. Integriamo tutti i componenti OCR nel form esistente.

**Step 1: Aggiungere gli import OCR in operazione-form.tsx**

Aggiungere dopo gli import esistenti (dopo riga ~25):

```typescript
import { GlobalDropZone } from "@/components/ocr/global-drop-zone";
import { PasteField } from "@/components/ocr/paste-field";
import { OcrOverlay } from "@/components/ocr/ocr-overlay";
import { useOcr } from "@/hooks/use-ocr";
import type { ParsedDocument } from "@/lib/ocr/types";
```

**Step 2: Aggiungere state e hook OCR nel componente**

Dentro `OperazioneForm`, dopo la dichiarazione degli state esistenti (dopo riga ~278 circa), aggiungere:

```typescript
// OCR
const { status: ocrStatus, result: ocrResult, error: ocrError, isProcessing: ocrProcessing, processFile: ocrProcessFile, processImage: ocrProcessImage, reset: ocrReset } = useOcr();
const [ocrFields, setOcrFields] = useState<Set<string>>(new Set());
```

**Step 3: Aggiungere useEffect per applicare risultati OCR al form**

Dopo gli useEffect esistenti, aggiungere:

```typescript
// Applica risultati OCR ai campi del form
useEffect(() => {
  if (!ocrResult) return;

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
    // Mostra conferma prima di sovrascrivere
    const conferma = window.confirm(
      "Alcuni campi sono già compilati. Vuoi sovrascriverli con i dati estratti?"
    );
    if (conferma) {
      applyOcrResult(ocrResult);
    }
  } else {
    applyOcrResult(ocrResult);
  }
}, [ocrResult]);
```

**Step 4: Aggiungere funzione helper per classi OCR highlight**

```typescript
// Restituisce classe CSS aggiuntiva se il campo è stato compilato dall'OCR
const ocrHighlight = (fieldName: string) =>
  ocrFields.has(fieldName) ? "ring-2 ring-amber-500/50 border-amber-500/50" : "";
```

**Step 5: Gestire errore OCR con toast**

```typescript
useEffect(() => {
  if (ocrError) {
    toast.error(ocrError);
    ocrReset();
  }
}, [ocrError, ocrReset]);
```

**Step 6: Wrappare il JSX del form con GlobalDropZone e aggiungere PasteField**

Il JSX attuale inizia con (riga 727):
```tsx
<div className="max-w-4xl mx-auto space-y-6">
```

Modificare in:
```tsx
<GlobalDropZone onFileDrop={ocrProcessFile} disabled={ocrProcessing || readOnly}>
  <div className="relative max-w-4xl mx-auto space-y-6">
    <OcrOverlay status={ocrStatus} />

    {/* Paste field - solo in modalità creazione */}
    {!readOnly && !isEditing && (
      <PasteField onImagePaste={ocrProcessImage} disabled={ocrProcessing} />
    )}
```

E chiudere il `GlobalDropZone` alla fine del JSX (prima dell'ultimo `</div>` alla riga ~1797):
```tsx
  </div>
</GlobalDropZone>
```

Nota: `isEditing` è definito come `const isEditing = !!operazione;` (riga ~156 circa). Verifica la variabile esatta nel file.

**Step 7: Aggiungere highlight OCR ai campi del form**

Per ogni campo compilabile dall'OCR, aggiungere la classe `ocrHighlight("nomeCampo")` e rimuovere l'highlight al focus. I campi da modificare:

- **Data Operazione** (input date): aggiungere `className={... ocrHighlight("dataOperazione")}` e `onFocus={() => setOcrFields(prev => { const next = new Set(prev); next.delete("dataOperazione"); return next; })}`
- **Numero Documento** (input text): stessa cosa con `"numeroDocumento"`
- **Descrizione** (textarea): stessa cosa con `"descrizione"`
- **Importo Totale** (input number): stessa cosa con `"importoTotale"`
- **Aliquota IVA** (select): stessa cosa con `"aliquotaIva"`

Per evitare ripetizione, creare un helper:

```typescript
const ocrFieldProps = (fieldName: string) => ({
  className: ocrHighlight(fieldName),
  onFocus: () =>
    setOcrFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    }),
});
```

Poi usare spread: `{...ocrFieldProps("dataOperazione")}` nei componenti. Nota: per i campi che hanno già una className, concatenare le classi.

**Step 8: Verificare il build**

Run: `npm run build`
Expected: Build completato senza errori

**Step 9: Commit**

```bash
git add src/app/operazioni/operazione-form.tsx
git commit -m "feat(ocr): integrate OCR pipeline into operation form with drop zone, paste field, and field highlighting"
```

---

### Task 10: Test Manuale e Fix

**Step 1: Avviare il dev server**

Run: `npm run dev`

**Step 2: Test manuale**

Verificare:
1. Navigare a `/operazioni/nuova`
2. Il campo paste è visibile sopra il form
3. Trascinare un'immagine di una fattura → overlay "Rilascia per scansionare" appare
4. Rilasciare → spinner "Scansione in corso..."
5. Campi compilati con bordo ambra
6. Cliccare su un campo con bordo ambra → bordo scompare
7. Trascinare su form già compilato → dialog "Vuoi sovrascrivere?"
8. Incollare screenshot nel campo paste → stessa pipeline OCR
9. Trascinare un file non supportato → toast errore
10. In modalità read-only → paste field non visibile, drop zone disabilitata

**Step 3: Fix eventuali problemi e commit finale**

```bash
git add -A
git commit -m "fix(ocr): adjustments from manual testing"
```

---

### Task 11: Build Finale di Verifica

**Step 1: Eseguire il build di produzione**

Run: `npm run build`
Expected: Build completato senza errori TypeScript, nessun warning rilevante

**Step 2: Eseguire i test**

Run: `npx vitest run`
Expected: Tutti i test passano, inclusi i test del parser OCR
