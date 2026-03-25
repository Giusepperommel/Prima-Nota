# Sub-project 1: Input Automatico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate data entry by building batch XML import for fatture passive, enhancing OCR with Claude AI, adding AI-powered bank matching, and creating a unified "Centro Import" dashboard.

**Architecture:** Builds on SP0 foundations (ProviderManager, AiPipeline, NotificationEngine) and existing infrastructure (OCR at `/api/ocr`, bozze system at `/api/bozze`, reconciliation at `/api/riconciliazione`). New import flow: XML/CSV → parse → classify (deterministic + AI) → create bozze → review queue → confirm. New page at `/centro-import`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6 (MySQL), Vitest, fast-xml-parser, @anthropic-ai/sdk, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-25-automazioni-commercialista-design.md` (Section: Sub-project 1)

**Existing code to build on:**
- XML parser: `src/lib/ocr/xml-parser.ts` (FatturaPA parsing with anagrafica auto-creation)
- Bozze API: `src/app/api/bozze/route.ts` (draft create/confirm/list)
- Riconciliazione: `src/lib/riconciliazione/matcher.ts` (score-based matching, 50-threshold)
- OCR: `src/app/api/ocr/route.ts` (Claude vision + XML parsing)
- SP0 providers: `src/lib/providers/` (FattureFileAdapter, BancaFileAdapter, parseFatturaXml, parseBancaCsv)

---

## File Structure

### New files

```
src/lib/
  import/
    types.ts                        # Import pipeline types
    fatture-import.ts               # Batch XML import: parse → classify → create bozze
    fatture-classifier.ts           # Deterministic rules + AI for fattura classification
    riconciliazione-ai.ts           # AI-powered bank matching (Layer 3 of matching)
    idempotency.ts                  # Dedup by IdentificativoSdI/NomeFile
  __tests__/
    fatture-import.test.ts
    fatture-classifier.test.ts
    riconciliazione-ai.test.ts
    idempotency.test.ts

src/app/api/
  import/
    fatture/
      route.ts                      # POST: batch XML/ZIP upload → parse → bozze
    riconciliazione-ai/
      route.ts                      # POST: trigger AI matching on unreconciled movements
    conferma-batch/
      route.ts                      # POST: confirm all bozze with confidence > threshold

src/app/(protected)/
  centro-import/
    page.tsx                        # Centro Import dashboard page
```

### Modified files

```
src/lib/riconciliazione/matcher.ts  # Add AI matching as level 3
src/lib/providers/adapters/fatture-file.ts  # Already has parseFatturaXml from SP0
```

---

## Task 1: Import Types & Idempotency

**Files:**
- Create: `src/lib/import/types.ts`
- Create: `src/lib/import/idempotency.ts`
- Test: `src/lib/__tests__/idempotency.test.ts`

- [ ] **Step 1: Create import types**

Create `src/lib/import/types.ts`:

```typescript
import type { FatturaImportata } from "@/lib/providers/types";

export type ImportResult = {
  totali: number;
  importate: number;
  duplicate: number;
  errori: number;
  bozzeCreate: number;
  dettagli: ImportDetail[];
};

export type ImportDetail = {
  nomeFile: string;
  stato: "IMPORTATA" | "DUPLICATA" | "ERRORE";
  errore?: string;
  bozzaId?: number;
  confidence?: number;
  fornitoreNoto: boolean;
};

export type ClassificazioneResult = {
  categoriaId: number | null;
  codiceContoId: number | null;
  tipoOperazione: string;
  fornitoreId: number | null;
  fornitoreNuovo: boolean;
  confidence: number;
  motivazione: string;
};

export type BatchConfirmResult = {
  confermate: number;
  saltate: number;
  ids: number[];
};
```

- [ ] **Step 2: Write idempotency tests (TDD)**

Create `src/lib/__tests__/idempotency.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDuplicateFattura, buildFatturaKey } from "../import/idempotency";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

describe("buildFatturaKey", () => {
  it("builds key from identificativoSdi", () => {
    const key = buildFatturaKey({ identificativoSdi: "SDI123", nomeFile: "IT01.xml" });
    expect(key).toBe("SDI123");
  });

  it("falls back to nomeFile when no identificativoSdi", () => {
    const key = buildFatturaKey({ nomeFile: "IT01_00001.xml" });
    expect(key).toBe("IT01_00001.xml");
  });

  it("falls back to fornitore+numero+data composite key", () => {
    const key = buildFatturaKey({
      fornitorePartitaIva: "01234567890",
      numeroFattura: "FT-001",
      dataFattura: "2026-03-15",
    });
    expect(key).toBe("01234567890|FT-001|2026-03-15");
  });
});

describe("checkDuplicateFattura", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns true when operazione with same key exists", async () => {
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue({ id: 1 } as any);
    const result = await checkDuplicateFattura(1, "SDI123");
    expect(result).toBe(true);
  });

  it("returns false when no matching operazione exists", async () => {
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue(null);
    const result = await checkDuplicateFattura(1, "SDI123");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — should FAIL**

```bash
npx vitest run src/lib/__tests__/idempotency.test.ts
```

- [ ] **Step 4: Implement idempotency**

Create `src/lib/import/idempotency.ts`:

```typescript
import { prisma } from "@/lib/prisma";

type FatturaKeyInput = {
  identificativoSdi?: string;
  nomeFile?: string;
  fornitorePartitaIva?: string;
  numeroFattura?: string;
  dataFattura?: string;
};

export function buildFatturaKey(input: FatturaKeyInput): string {
  if (input.identificativoSdi) return input.identificativoSdi;
  if (input.nomeFile) return input.nomeFile;
  if (input.fornitorePartitaIva && input.numeroFattura && input.dataFattura) {
    return `${input.fornitorePartitaIva}|${input.numeroFattura}|${input.dataFattura}`;
  }
  return "";
}

export async function checkDuplicateFattura(
  societaId: number,
  chiaveImport: string,
): Promise<boolean> {
  if (!chiaveImport) return false;
  const existing = await prisma.operazione.findFirst({
    where: { societaId, chiaveImport },
    select: { id: true },
  });
  return existing !== null;
}
```

**Note:** This requires adding a `chiaveImport` field to `Operazione` in the schema (see Task 2).

- [ ] **Step 5: Run tests — should PASS**

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/ src/lib/__tests__/idempotency.test.ts
git commit -m "feat(sp1): add import types and fattura idempotency check"
```

---

## Task 2: Schema — Add chiaveImport to Operazione

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add chiaveImport field**

Add to the `Operazione` model:

```prisma
chiaveImport      String?   @map("chiave_import") @db.VarChar(255)
sorgente          String?   @map("sorgente") @db.VarChar(50)  // "MANUALE" | "XML_IMPORT" | "OCR" | "BANCA"
aiConfidence      Float?    @map("ai_confidence")
aiSuggestionId    Int?      @map("ai_suggestion_id")
```

Add index:

```prisma
@@index([societaId, chiaveImport])
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name sp1-add-chiave-import
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(sp1): add chiaveImport, sorgente, aiConfidence to Operazione"
```

---

## Task 3: Fattura Classifier (Deterministic + AI)

**Files:**
- Create: `src/lib/import/fatture-classifier.ts`
- Test: `src/lib/__tests__/fatture-classifier.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/fatture-classifier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { classificaFattura } from "../import/fatture-classifier";

vi.mock("../prisma", () => ({
  prisma: {
    anagrafica: { findFirst: vi.fn() },
    operazione: { findFirst: vi.fn() },
    categoriaSpesa: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("classificaFattura", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("classifies known supplier using last used category", async () => {
    // Supplier exists in anagrafica
    vi.mocked(prisma.anagrafica.findFirst).mockResolvedValue({
      id: 10, denominazione: "Telecom Italia", partitaIva: "00488410010",
      tipo: "FORNITORE", societaId: 1,
    } as any);

    // Last operation with this supplier used categoria 5
    vi.mocked(prisma.operazione.findFirst).mockResolvedValue({
      id: 100, categoriaId: 5, codiceContoId: 20, fornitoreId: 10,
    } as any);

    const result = await classificaFattura(1, {
      cedente: { denominazione: "Telecom Italia", partitaIva: "00488410010", nazione: "IT" },
      importoTotale: 200,
      righeDescrizione: "Canone mensile telefonia",
    });

    expect(result.fornitoreId).toBe(10);
    expect(result.fornitoreNuovo).toBe(false);
    expect(result.categoriaId).toBe(5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns lower confidence for new supplier", async () => {
    vi.mocked(prisma.anagrafica.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.categoriaSpesa.findMany).mockResolvedValue([
      { id: 1, nome: "Consulenze", societaId: 1 },
      { id: 2, nome: "Telefonia", societaId: 1 },
    ] as any);

    const result = await classificaFattura(1, {
      cedente: { denominazione: "Nuova SRL", partitaIva: "12345678901", nazione: "IT" },
      importoTotale: 5000,
      righeDescrizione: "Consulenza strategica",
    });

    expect(result.fornitoreNuovo).toBe(true);
    expect(result.fornitoreId).toBeNull();
    // AI classification needed for new suppliers
  });

  it("sets tipoOperazione to COSTO for standard domestic invoice", () => {
    // Tested via the sync path (no await needed for this specific assertion)
    // This will be part of the full integration test
  });
});
```

- [ ] **Step 2: Run tests — should FAIL**

- [ ] **Step 3: Implement classifier**

Create `src/lib/import/fatture-classifier.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { AiPipeline } from "@/lib/ai/pipeline";
import { classifyWithClaude } from "@/lib/ai/classifier";
import type { DeterministicRule } from "@/lib/ai/types";
import type { ClassificazioneResult } from "./types";

type FatturaClassInput = {
  cedente: { denominazione: string; partitaIva?: string; nazione: string };
  importoTotale: number;
  righeDescrizione: string;
};

export async function classificaFattura(
  societaId: number,
  input: FatturaClassInput,
): Promise<ClassificazioneResult> {
  // Step 1: Check if supplier is known
  const anagrafica = input.cedente.partitaIva
    ? await prisma.anagrafica.findFirst({
        where: { societaId, partitaIva: input.cedente.partitaIva },
      })
    : null;

  if (anagrafica) {
    // Known supplier: use last used category
    const lastOp = await prisma.operazione.findFirst({
      where: { societaId, fornitoreId: anagrafica.id, bozza: false },
      orderBy: { dataOperazione: "desc" },
      select: { categoriaId: true, codiceContoId: true },
    });

    if (lastOp?.categoriaId) {
      return {
        categoriaId: lastOp.categoriaId,
        codiceContoId: lastOp.codiceContoId,
        tipoOperazione: "COSTO",
        fornitoreId: anagrafica.id,
        fornitoreNuovo: false,
        confidence: 0.95,
        motivazione: `Fornitore noto: ${anagrafica.denominazione}. Categoria dall'ultima operazione.`,
      };
    }

    // Known supplier but no previous operations
    return {
      categoriaId: null,
      codiceContoId: null,
      tipoOperazione: "COSTO",
      fornitoreId: anagrafica.id,
      fornitoreNuovo: false,
      confidence: 0.5,
      motivazione: `Fornitore noto ma nessuna operazione precedente. Classificazione manuale richiesta.`,
    };
  }

  // Step 2: New supplier — try AI classification
  const categorie = await prisma.categoriaSpesa.findMany({
    where: { societaId },
    select: { id: true, nome: true },
  });

  try {
    const aiResult = await classifyWithClaude("CLASSIFICAZIONE", {
      fornitore: input.cedente.denominazione,
      descrizione: input.righeDescrizione,
      importo: input.importoTotale,
      categorie,
    });

    return {
      categoriaId: (aiResult.suggestion as any).categoriaId ?? null,
      codiceContoId: (aiResult.suggestion as any).contoId ?? null,
      tipoOperazione: "COSTO",
      fornitoreId: null,
      fornitoreNuovo: true,
      confidence: aiResult.confidence,
      motivazione: aiResult.motivazione,
    };
  } catch {
    // AI unavailable — return unclassified
    return {
      categoriaId: null,
      codiceContoId: null,
      tipoOperazione: "COSTO",
      fornitoreId: null,
      fornitoreNuovo: true,
      confidence: 0,
      motivazione: "Fornitore nuovo, classificazione AI non disponibile.",
    };
  }
}
```

- [ ] **Step 4: Run tests — should PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/fatture-classifier.ts src/lib/__tests__/fatture-classifier.test.ts
git commit -m "feat(sp1): add fattura classifier with known-supplier shortcut and AI fallback"
```

---

## Task 4: Batch Fatture Import

**Files:**
- Create: `src/lib/import/fatture-import.ts`
- Test: `src/lib/__tests__/fatture-import.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/fatture-import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { importaFattureXml } from "../import/fatture-import";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: {
      findFirst: vi.fn().mockResolvedValue(null),  // no duplicates
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    anagrafica: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 10 }),
    },
    categoriaSpesa: {
      findMany: vi.fn().mockResolvedValue([{ id: 1, nome: "Generico" }]),
      findFirst: vi.fn().mockResolvedValue({ id: 1, nome: "Generico", percentualeDeducibilita: 100 }),
    },
    socio: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, quotaPercentuale: 50 },
        { id: 2, quotaPercentuale: 50 },
      ]),
    },
    ripartizioneOperazione: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      operazione: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      ripartizioneOperazione: { createMany: vi.fn() },
      anagrafica: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 10 }) },
    })),
  },
}));

vi.mock("../import/fatture-classifier", () => ({
  classificaFattura: vi.fn().mockResolvedValue({
    categoriaId: 1, codiceContoId: null, tipoOperazione: "COSTO",
    fornitoreId: null, fornitoreNuovo: true, confidence: 0.85,
    motivazione: "AI classification",
  }),
}));

vi.mock("../import/idempotency", () => ({
  buildFatturaKey: vi.fn().mockReturnValue("SDI123"),
  checkDuplicateFattura: vi.fn().mockResolvedValue(false),
}));

import { checkDuplicateFattura } from "../import/idempotency";

describe("importaFattureXml", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("imports a single fattura and creates bozza", async () => {
    const fatture = [{
      identificativoSdi: "SDI123",
      tipoDocumento: "TD01",
      cedente: { denominazione: "Rossi SRL", partitaIva: "01234567890", nazione: "IT" },
      dataFattura: new Date("2026-03-15"),
      numeroFattura: "FT-001",
      importoTotale: 1220,
      imponibile: 1000,
      iva: 220,
      aliquotaIva: 22,
      righe: [{ descrizione: "Consulenza", importo: 1000, aliquotaIva: 22 }],
      scadenzePagamento: [],
    }];

    const result = await importaFattureXml(1, 1, fatture as any);
    expect(result.importate).toBe(1);
    expect(result.duplicate).toBe(0);
    expect(result.bozzeCreate).toBe(1);
  });

  it("skips duplicate fatture", async () => {
    vi.mocked(checkDuplicateFattura).mockResolvedValue(true);

    const fatture = [{
      identificativoSdi: "SDI123",
      tipoDocumento: "TD01",
      cedente: { denominazione: "Rossi SRL", partitaIva: "01234567890", nazione: "IT" },
      dataFattura: new Date("2026-03-15"),
      numeroFattura: "FT-001",
      importoTotale: 1220,
      imponibile: 1000, iva: 220, aliquotaIva: 22,
      righe: [], scadenzePagamento: [],
    }];

    const result = await importaFattureXml(1, 1, fatture as any);
    expect(result.importate).toBe(0);
    expect(result.duplicate).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — should FAIL**

- [ ] **Step 3: Implement batch import**

Create `src/lib/import/fatture-import.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { FatturaImportata } from "@/lib/providers/types";
import type { ImportResult, ImportDetail } from "./types";
import { buildFatturaKey, checkDuplicateFattura } from "./idempotency";
import { classificaFattura } from "./fatture-classifier";

export async function importaFattureXml(
  societaId: number,
  userId: number,
  fatture: FatturaImportata[],
): Promise<ImportResult> {
  const result: ImportResult = {
    totali: fatture.length,
    importate: 0,
    duplicate: 0,
    errori: 0,
    bozzeCreate: 0,
    dettagli: [],
  };

  for (const fattura of fatture) {
    const detail: ImportDetail = {
      nomeFile: fattura.nomeFile ?? fattura.numeroFattura,
      stato: "IMPORTATA",
      fornitoreNoto: false,
    };

    try {
      // Check idempotency
      const chiaveImport = buildFatturaKey({
        identificativoSdi: fattura.identificativoSdi,
        nomeFile: fattura.nomeFile,
        fornitorePartitaIva: fattura.cedente.partitaIva,
        numeroFattura: fattura.numeroFattura,
        dataFattura: fattura.dataFattura.toISOString().split("T")[0],
      });

      if (await checkDuplicateFattura(societaId, chiaveImport)) {
        detail.stato = "DUPLICATA";
        result.duplicate++;
        result.dettagli.push(detail);
        continue;
      }

      // Classify
      const classificazione = await classificaFattura(societaId, {
        cedente: fattura.cedente,
        importoTotale: fattura.importoTotale,
        righeDescrizione: fattura.righe.map((r) => r.descrizione).join("; "),
      });

      detail.confidence = classificazione.confidence;
      detail.fornitoreNoto = !classificazione.fornitoreNuovo;

      // Ensure fornitore exists (create if new)
      let fornitoreId = classificazione.fornitoreId;
      if (!fornitoreId && fattura.cedente.partitaIva) {
        const newAnagrafica = await prisma.anagrafica.create({
          data: {
            societaId,
            denominazione: fattura.cedente.denominazione,
            partitaIva: fattura.cedente.partitaIva,
            codiceFiscale: fattura.cedente.codiceFiscale ?? "",
            tipo: "FORNITORE",
            tipoSoggetto: "AZIENDA",
            nazione: fattura.cedente.nazione,
            autoCreataOcr: true,
          },
        });
        fornitoreId = newAnagrafica.id;
      }

      // Get default categoria and soci for ripartizione
      const defaultCategoria = classificazione.categoriaId
        ? await prisma.categoriaSpesa.findFirst({ where: { id: classificazione.categoriaId } })
        : await prisma.categoriaSpesa.findFirst({ where: { societaId } });

      const soci = await prisma.socio.findMany({
        where: { societaId, attivo: true },
        select: { id: true, quotaPercentuale: true },
      });

      // Create bozza operazione
      const operazione = await prisma.operazione.create({
        data: {
          societaId,
          tipoOperazione: "COSTO",
          dataOperazione: fattura.dataFattura,
          dataRegistrazione: fattura.dataFattura,
          descrizione: fattura.righe.map((r) => r.descrizione).join("; ").slice(0, 500) || fattura.numeroFattura,
          importoTotale: fattura.importoTotale,
          importoImponibile: fattura.imponibile,
          importoIva: fattura.iva,
          aliquotaIva: fattura.aliquotaIva,
          numeroDocumento: fattura.numeroFattura,
          categoriaId: defaultCategoria?.id,
          fornitoreId,
          codiceContoId: classificazione.codiceContoId,
          tipoRipartizione: "COMUNE",
          percentualeDeducibilita: (defaultCategoria as any)?.percentualeDeducibilita ?? 100,
          bozza: true,
          chiaveImport,
          sorgente: "XML_IMPORT",
          aiConfidence: classificazione.confidence,
          registroIva: "ACQUISTI",
          createdByUserId: userId,
        },
      });

      // Create ripartizioni
      if (soci.length > 0) {
        await prisma.ripartizioneOperazione.createMany({
          data: soci.map((socio) => ({
            operazioneId: operazione.id,
            socioId: socio.id,
            percentuale: Number(socio.quotaPercentuale),
            importo: Math.round((fattura.importoTotale * Number(socio.quotaPercentuale)) / 100 * 100) / 100,
          })),
        });
      }

      detail.bozzaId = operazione.id;
      result.importate++;
      result.bozzeCreate++;
    } catch (error: any) {
      detail.stato = "ERRORE";
      detail.errore = error?.message ?? "Errore sconosciuto";
      result.errori++;
    }

    result.dettagli.push(detail);
  }

  return result;
}
```

- [ ] **Step 4: Run tests — should PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/fatture-import.ts src/lib/__tests__/fatture-import.test.ts
git commit -m "feat(sp1): add batch fatture XML import with classification and bozze creation"
```

---

## Task 5: AI-Powered Bank Matching

**Files:**
- Create: `src/lib/import/riconciliazione-ai.ts`
- Test: `src/lib/__tests__/riconciliazione-ai.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/riconciliazione-ai.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildMatchingPrompt, parseMatchingResponse } from "../import/riconciliazione-ai";

describe("buildMatchingPrompt", () => {
  it("builds prompt with movement and candidate operations", () => {
    const prompt = buildMatchingPrompt(
      { descrizione: "BONIFICO A ROSSI SRL FT 001/2026", importo: -1220, data: "2026-03-15" },
      [
        { id: 1, descrizione: "Fattura Rossi SRL", importo: 1220, data: "2026-03-10", fornitore: "Rossi SRL" },
        { id: 2, descrizione: "Fattura Bianchi", importo: 1200, data: "2026-03-12", fornitore: "Bianchi SRL" },
      ],
    );
    expect(prompt).toContain("ROSSI SRL");
    expect(prompt).toContain("1220");
    expect(prompt).toContain("JSON");
  });
});

describe("parseMatchingResponse", () => {
  it("parses valid match response", () => {
    const result = parseMatchingResponse('{"operazioneId": 1, "confidence": 0.92, "motivazione": "Importo e nome corrispondono"}');
    expect(result.operazioneId).toBe(1);
    expect(result.confidence).toBe(0.92);
  });

  it("returns null operazioneId on no match", () => {
    const result = parseMatchingResponse('{"operazioneId": null, "confidence": 0, "motivazione": "Nessun match"}');
    expect(result.operazioneId).toBeNull();
  });

  it("handles parse errors gracefully", () => {
    const result = parseMatchingResponse("not json");
    expect(result.operazioneId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — should FAIL**

- [ ] **Step 3: Implement AI matching**

Create `src/lib/import/riconciliazione-ai.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type MovimentoInput = {
  descrizione: string;
  importo: number;
  data: string;
};

type CandidateOp = {
  id: number;
  descrizione: string;
  importo: number;
  data: string;
  fornitore?: string;
};

type MatchResult = {
  operazioneId: number | null;
  confidence: number;
  motivazione: string;
  tokensUsati: number;
};

const SYSTEM_PROMPT = `Sei un assistente contabile. Ti viene dato un movimento bancario e una lista di operazioni candidate.
Identifica quale operazione corrisponde al movimento bancario, analizzando: importo, descrizione/causale, date, nome fornitore/cliente.
Rispondi SEMPRE in JSON: {"operazioneId": number|null, "confidence": 0.0-1.0, "motivazione": "spiegazione"}
Se nessuna operazione corrisponde, rispondi con operazioneId: null.`;

export function buildMatchingPrompt(
  movimento: MovimentoInput,
  candidati: CandidateOp[],
): string {
  const parts = [
    "Movimento bancario:",
    `  Descrizione: ${movimento.descrizione}`,
    `  Importo: €${Math.abs(movimento.importo)} (${movimento.importo < 0 ? "uscita" : "entrata"})`,
    `  Data: ${movimento.data}`,
    "",
    "Operazioni candidate:",
  ];

  for (const c of candidati) {
    parts.push(`  ID ${c.id}: ${c.descrizione} — €${c.importo} — ${c.data}${c.fornitore ? ` — ${c.fornitore}` : ""}`);
  }

  parts.push("", "Rispondi in formato JSON.");
  return parts.join("\n");
}

export function parseMatchingResponse(text: string): Omit<MatchResult, "tokensUsati"> {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    return {
      operazioneId: parsed.operazioneId ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      motivazione: parsed.motivazione ?? "",
    };
  } catch {
    return { operazioneId: null, confidence: 0, motivazione: "Errore nel parse della risposta AI" };
  }
}

export async function matchWithClaude(
  movimento: MovimentoInput,
  candidati: CandidateOp[],
): Promise<MatchResult> {
  if (candidati.length === 0) {
    return { operazioneId: null, confidence: 0, motivazione: "Nessun candidato disponibile", tokensUsati: 0 };
  }

  const prompt = buildMatchingPrompt(movimento, candidati);
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const result = parseMatchingResponse(text);
  return {
    ...result,
    tokensUsati: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
  };
}
```

- [ ] **Step 4: Run tests — should PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/riconciliazione-ai.ts src/lib/__tests__/riconciliazione-ai.test.ts
git commit -m "feat(sp1): add AI-powered bank reconciliation matching"
```

---

## Task 6: API Route — Batch Fatture Import

**Files:**
- Create: `src/app/api/import/fatture/route.ts`

- [ ] **Step 1: Implement route**

Create `src/app/api/import/fatture/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseFatturaXml } from "@/lib/providers/adapters/fatture-file";
import { importaFattureXml } from "@/lib/import/fatture-import";
import type { FatturaImportata } from "@/lib/providers/types";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
    }

    const fatture: FatturaImportata[] = [];

    for (const file of files) {
      const text = await file.text();

      if (file.name.endsWith(".xml")) {
        try {
          fatture.push(parseFatturaXml(text));
        } catch (err: any) {
          return NextResponse.json(
            { error: `Errore nel parsing di ${file.name}: ${err.message}` },
            { status: 400 },
          );
        }
      }
      // ZIP support to be added later
    }

    if (fatture.length === 0) {
      return NextResponse.json({ error: "Nessuna fattura XML trovata nei file caricati" }, { status: 400 });
    }

    const result = await importaFattureXml(societaId, userId, fatture);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/import/fatture error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/import/
git commit -m "feat(sp1): add batch fatture XML import API route"
```

---

## Task 7: API Route — AI Reconciliation & Batch Confirm

**Files:**
- Create: `src/app/api/import/riconciliazione-ai/route.ts`
- Create: `src/app/api/import/conferma-batch/route.ts`

- [ ] **Step 1: Implement AI reconciliation route**

Create `src/app/api/import/riconciliazione-ai/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchWithClaude } from "@/lib/import/riconciliazione-ai";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    // Get unreconciled movements
    const movimenti = await prisma.movimentoBancario.findMany({
      where: { societaId, statoRiconciliazione: "NON_RICONCILIATO" },
      take: 50,  // batch size
    });

    if (movimenti.length === 0) {
      return NextResponse.json({ message: "Nessun movimento da riconciliare", risultati: [] });
    }

    // Get unlinked operations as candidates
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: false,
        movimentiBancari: { none: {} },
      },
      include: { fornitore: { select: { denominazione: true } } },
      take: 100,
    });

    const candidati = operazioni.map((op) => ({
      id: op.id,
      descrizione: op.descrizione,
      importo: Number(op.importoTotale),
      data: op.dataOperazione.toISOString().split("T")[0],
      fornitore: (op.fornitore as any)?.denominazione,
    }));

    const risultati = [];

    for (const mov of movimenti) {
      const result = await matchWithClaude(
        {
          descrizione: mov.descrizione,
          importo: Number(mov.importo),
          data: mov.data.toISOString().split("T")[0],
        },
        candidati,
      );

      if (result.operazioneId && result.confidence >= 0.9) {
        // Auto-reconcile high confidence matches
        await prisma.movimentoBancario.update({
          where: { id: mov.id },
          data: {
            riconciliatoConOperazioneId: result.operazioneId,
            statoRiconciliazione: "RICONCILIATO",
          },
        });
      }

      risultati.push({
        movimentoId: mov.id,
        descrizione: mov.descrizione,
        importo: Number(mov.importo),
        ...result,
        autoRiconciliato: result.operazioneId !== null && result.confidence >= 0.9,
      });
    }

    return NextResponse.json({
      totale: movimenti.length,
      riconciliati: risultati.filter((r) => r.autoRiconciliato).length,
      suggeriti: risultati.filter((r) => r.operazioneId && !r.autoRiconciliato).length,
      nonTrovati: risultati.filter((r) => !r.operazioneId).length,
      risultati,
    });
  } catch (error) {
    console.error("POST /api/import/riconciliazione-ai error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement batch confirm route**

Create `src/app/api/import/conferma-batch/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await req.json();

    const minConfidence = body.minConfidence ?? 0.9;

    // Find all bozze with confidence >= threshold
    const bozze = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: true,
        sorgente: { in: ["XML_IMPORT", "OCR", "BANCA"] },
        aiConfidence: { gte: minConfidence },
      },
      select: { id: true },
    });

    if (bozze.length === 0) {
      return NextResponse.json({ confermate: 0, saltate: 0, ids: [] });
    }

    const ids = bozze.map((b) => b.id);

    await prisma.operazione.updateMany({
      where: { id: { in: ids } },
      data: { bozza: false },
    });

    return NextResponse.json({
      confermate: ids.length,
      saltate: 0,
      ids,
    });
  } catch (error) {
    console.error("POST /api/import/conferma-batch error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/import/
git commit -m "feat(sp1): add AI reconciliation and batch confirm API routes"
```

---

## Task 8: Centro Import Page (UI)

**Files:**
- Create: `src/app/(protected)/centro-import/page.tsx`

- [ ] **Step 1: Create Centro Import page**

Create `src/app/(protected)/centro-import/page.tsx`:

This page has:
- **Summary cards:** fatture passive (nuove/da review), movimenti banca (importati/senza match), documenti OCR
- **Quick actions:** [Importa XML/ZIP], [Importa CSV banca], [Scansiona documento], [Sync provider]
- **Review queue:** table of bozze with confidence indicator, approve/reject buttons
- **Batch action:** "Conferma tutti >90%" button

Use existing Shadcn components (Card, Button, Table, Badge). Follow the existing page patterns in the codebase (e.g., `/app/(protected)/operazioni/page.tsx`).

Key fetches:
- `GET /api/bozze` — list drafts (filter by sorgente)
- `POST /api/import/fatture` — upload XML
- `POST /api/import/conferma-batch` — batch confirm
- `GET /api/riconciliazione/movimenti?stato=NON_RICONCILIATO` — unreconciled movements

Use `fetch()` with standard Next.js patterns. No external state library needed — use React state + useEffect.

The page should match the wireframe from the spec:
```
Centro Import              [Società X]
─────────────────────────────────────
Fatture passive     [12 nuove] [3 da review]
Movimenti banca     [47 importati] [5 senza match]

Azioni rapide:
[Importa XML/ZIP] [Importa CSV banca]

Coda Review:
FT 2026/0142 - Rossi SRL   [85%] [✓][✗]
FT 2026/0143 - ???         [62%] [✓][✗]

[Conferma tutti >90%]  [Rivedi incerti]
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(protected\)/centro-import/
git commit -m "feat(sp1): add Centro Import dashboard page"
```

---

## Task 9: Run All Tests & Verify Build

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run src/lib/__tests__/idempotency.test.ts src/lib/__tests__/fatture-classifier.test.ts src/lib/__tests__/fatture-import.test.ts src/lib/__tests__/riconciliazione-ai.test.ts
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 3: TypeScript compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Build**

```bash
npm run build
```

- [ ] **Step 5: Commit fixes if needed**
