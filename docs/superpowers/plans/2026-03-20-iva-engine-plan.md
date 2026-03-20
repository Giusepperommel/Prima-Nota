# IVA Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized IVA Engine that auto-classifies operations, generates autofatture for foreign invoices, handles double IVA register entries, and tracks plafond for habitual exporters.

**Architecture:** Centralized engine in `src/lib/iva/` with pure functions for classification, autofattura generation, doppia registrazione, and plafond tracking. Engine is invoked atomically inside existing API transaction boundaries. Two UI modes: semplice (auto, hidden) and avanzata (visible, overridable).

**Tech Stack:** Next.js 15, Prisma (MySQL), TypeScript, vitest for tests, React (shadcn/ui)

**Spec:** `docs/superpowers/specs/2026-03-20-iva-engine-design.md`

---

## File Structure

### New files to create

```
src/lib/iva/
  types.ts                    — shared TypeScript types (ClassifierInput, ClassifierOutput, etc.)
  countries.ts                — EU/extra-EU country lists, helpers (isEU, isExtraEU, isSanMarino)
  classifier.ts               — determines IVA treatment given supplier + operation
  validation.ts               — validates coherence of natura/aliquota/tipoDocumento/nazione
  autofattura.ts              — generates autofattura/integrazione Prisma data
  doppia-registrazione.ts     — handles protocollo assignment and dual register logic
  plafond.ts                  — plafond tracking, utilization, splafonamento detection
  engine.ts                   — orchestrator that ties all modules together

src/lib/iva/__tests__/
  countries.test.ts
  classifier.test.ts
  validation.test.ts
  autofattura.test.ts
  doppia-registrazione.test.ts
  plafond.test.ts
  engine.test.ts

src/app/api/iva/
  preview/route.ts            — POST /api/iva/preview endpoint
```

### Existing files to modify

```
prisma/schema.prisma                                    — add new fields, enums, models
src/app/api/operazioni/route.ts                         — integrate IVA engine in POST
src/app/api/operazioni/[id]/route.ts                    — integrate IVA engine in PUT
src/app/api/registri-iva/route.ts                       — handle doppiaRegistrazione
src/app/bilancio/anagrafiche/anagrafiche-content.tsx    — expose nazione field
src/components/operazioni/dati-contabili-tab.tsx         — add tipoMerce, autofattura badge, pre-fill
src/app/bilancio/registri-iva/registri-iva-content.tsx  — add columns and filters
src/lib/ocr/xml-parser.ts                               — extract CedentePrestatore/Sede/Nazione
src/lib/ocr/types.ts                                    — add nazione to ParsedDocument
src/app/api/ocr/route.ts                                — add tipoMerce to Haiku prompt
package.json                                            — add vitest test script
```

---

## Task 1: Setup vitest and test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Vitest is used in existing test files but may not be in package.json. Install it if missing.

```bash
cd "/Users/giuseppeantonacci/Desktop/Prima Nota"
npm ls vitest 2>/dev/null || npm install -D vitest
```

- [ ] **Step 2: Add test script to package.json**

In `package.json` scripts section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts if not exists**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Run existing tests to verify setup**

```bash
npm test
```

Expected: existing parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add vitest test script and config"
```

---

## Task 2: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma`

This task adds: `TipoMerce` enum, new fields on `Operazione`, `Plafond` and `MovimentoPlafond` models, relation fields on `Societa`.

- [ ] **Step 1: Add TipoMerce enum**

After the last enum in the schema (around line 727, after `NaturaSaldo`), add:

```prisma
enum TipoMerce {
  BENI
  SERVIZI
}

enum MetodoPlafond {
  FISSO
  MOBILE
}
```

- [ ] **Step 2: Add new fields to Operazione model**

Inside the Operazione model (after the existing `splitPayment` field ~line 160), add:

```prisma
  tipoMerce              TipoMerce?    @map("tipo_merce")
  doppiaRegistrazione    Boolean       @default(false) @map("doppia_registrazione")
  protocolloIvaVendite   String?       @map("protocollo_iva_vendite") @db.VarChar(20)
  operazioneOrigineId    Int?          @map("operazione_origine_id")
  operazioneOrigine      Operazione?   @relation("AutofatturaLink", fields: [operazioneOrigineId], references: [id], onDelete: SetNull)
  autofatture            Operazione[]  @relation("AutofatturaLink")
  movimentiPlafond       MovimentoPlafond[]
```

- [ ] **Step 3: Add Plafond and MovimentoPlafond models**

At the end of schema.prisma, add:

```prisma
model Plafond {
  id                 Int              @id @default(autoincrement())
  societaId          Int              @map("societa_id")
  anno               Int
  metodo             MetodoPlafond    @default(FISSO)
  importoDisponibile Decimal          @db.Decimal(12, 2)
  importoUtilizzato  Decimal          @db.Decimal(12, 2) @default(0)
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")
  societa            Societa          @relation(fields: [societaId], references: [id])
  movimenti          MovimentoPlafond[]

  @@unique([societaId, anno])
  @@map("plafond")
}

model MovimentoPlafond {
  id             Int        @id @default(autoincrement())
  plafondId      Int        @map("plafond_id")
  operazioneId   Int        @map("operazione_id")
  importo        Decimal    @db.Decimal(12, 2)
  dataOperazione DateTime   @db.Date @map("data_operazione")
  createdAt      DateTime   @default(now()) @map("created_at")
  plafond        Plafond    @relation(fields: [plafondId], references: [id])
  operazione     Operazione @relation(fields: [operazioneId], references: [id])

  @@map("movimento_plafond")
}
```

- [ ] **Step 4: Add plafond relation to Societa model**

In the Societa model (~line 10-39), add alongside the other relations:

```prisma
  plafond            Plafond[]
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add-iva-engine-fields
```

Expected: Migration created and applied successfully. DO NOT use `prisma migrate reset` or `db push --force-reset`.

- [ ] **Step 6: Verify Prisma client generation**

```bash
npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(db): add IVA engine schema — TipoMerce, Plafond, autofattura link"
```

---

## Task 3: Countries module

**Files:**
- Create: `src/lib/iva/countries.ts`
- Create: `src/lib/iva/__tests__/countries.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/countries.test.ts
import { describe, it, expect } from "vitest";
import { isEU, isExtraEU, isSanMarino, getCountryGroup } from "../countries";

describe("countries", () => {
  it("classifica IT come non-EU per scopi IVA engine (domestico)", () => {
    expect(isEU("IT")).toBe(false); // IT è domestico, non "EU" per reverse charge
    expect(getCountryGroup("IT")).toBe("IT");
  });

  it("classifica paesi UE correttamente", () => {
    expect(isEU("DE")).toBe(true);
    expect(isEU("FR")).toBe(true);
    expect(isEU("ES")).toBe(true);
    expect(getCountryGroup("DE")).toBe("UE");
  });

  it("classifica paesi extra-UE", () => {
    expect(isExtraEU("US")).toBe(true);
    expect(isExtraEU("CN")).toBe(true);
    expect(getCountryGroup("US")).toBe("EXTRA_UE");
  });

  it("classifica San Marino separatamente", () => {
    expect(isSanMarino("SM")).toBe(true);
    expect(getCountryGroup("SM")).toBe("SAN_MARINO");
  });

  it("gestisce codici lowercase", () => {
    expect(isEU("de")).toBe(true);
    expect(getCountryGroup("it")).toBe("IT");
  });

  it("gestisce codici nulli/vuoti come IT", () => {
    expect(getCountryGroup("")).toBe("IT");
    expect(getCountryGroup(null as any)).toBe("IT");
    expect(getCountryGroup(undefined as any)).toBe("IT");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/countries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement countries module**

```typescript
// src/lib/iva/countries.ts

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE",
]);

export type CountryGroup = "IT" | "UE" | "SAN_MARINO" | "EXTRA_UE";

export function getCountryGroup(nazione: string | null | undefined): CountryGroup {
  if (!nazione) return "IT";
  const code = nazione.toUpperCase().trim();
  if (!code || code === "IT") return "IT";
  if (code === "SM") return "SAN_MARINO";
  if (EU_COUNTRIES.has(code)) return "UE";
  return "EXTRA_UE";
}

export function isEU(nazione: string): boolean {
  return getCountryGroup(nazione) === "UE";
}

export function isExtraEU(nazione: string): boolean {
  return getCountryGroup(nazione) === "EXTRA_UE";
}

export function isSanMarino(nazione: string): boolean {
  return getCountryGroup(nazione) === "SAN_MARINO";
}

/** Full EU country list for UI select, sorted alphabetically by name */
export const EU_COUNTRY_LIST: { code: string; name: string }[] = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgio" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croazia" },
  { code: "CY", name: "Cipro" },
  { code: "CZ", name: "Repubblica Ceca" },
  { code: "DK", name: "Danimarca" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finlandia" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Germania" },
  { code: "GR", name: "Grecia" },
  { code: "HU", name: "Ungheria" },
  { code: "IE", name: "Irlanda" },
  { code: "LV", name: "Lettonia" },
  { code: "LT", name: "Lituania" },
  { code: "LU", name: "Lussemburgo" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Paesi Bassi" },
  { code: "PL", name: "Polonia" },
  { code: "PT", name: "Portogallo" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovacchia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spagna" },
  { code: "SE", name: "Svezia" },
];
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/countries.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/countries.ts src/lib/iva/__tests__/countries.test.ts
git commit -m "feat(iva): add countries module — EU/extra-EU/San Marino classification"
```

---

## Task 4: Types module

**Files:**
- Create: `src/lib/iva/types.ts`

- [ ] **Step 1: Create types**

```typescript
// src/lib/iva/types.ts
import type { NaturaIva, TipoDocumentoSdi, RegistroIva, TipoMerce } from "@prisma/client";
import type { CountryGroup } from "./countries";

export type ClassifierInput = {
  nazioneFornitore: string | null;
  tipoMerce: TipoMerce;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA";
  naturaIvaManuale?: NaturaIva | null;
  aliquotaIva?: number | null;
  isReverseChargeInterno?: boolean;
  sanMarinoConIva?: boolean;
};

export type ClassifierOutput = {
  naturaIva: NaturaIva | null;
  aliquotaIva: number;
  tipoDocumentoSdi: TipoDocumentoSdi;
  richiedeAutofattura: boolean;
  richiedeDoppiaRegistrazione: boolean;
  tipoDocumentoAutofattura: TipoDocumentoSdi | null;
  registroIva: RegistroIva;
  countryGroup: CountryGroup;
  warnings: string[];
};

export type AutofatturaData = {
  descrizione: string;
  importoImponibile: number;
  aliquotaIva: number;
  importoIva: number;
  tipoDocumentoSdi: TipoDocumentoSdi;
  tipoMerce: TipoMerce;
  doppiaRegistrazione: boolean;
  registroIva: RegistroIva;
  naturaOperazioneIva: NaturaIva | null;
};

export type ValidationWarning = {
  field: string;
  message: string;
  severity: "warning" | "error";
};

export type PlafondCheckResult = {
  plafondAttivo: boolean;
  importoDisponibile: number;
  importoUtilizzato: number;
  importoResiduo: number;
  sforamento: boolean;
  importoSforamento: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/iva/types.ts
git commit -m "feat(iva): add shared TypeScript types"
```

---

## Task 5: IVA Classifier

**Files:**
- Create: `src/lib/iva/classifier.ts`
- Create: `src/lib/iva/__tests__/classifier.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/classifier.test.ts
import { describe, it, expect } from "vitest";
import { classify } from "../classifier";

describe("IVA Classifier — Acquisti", () => {
  it("IT domestico senza natura → operazione ordinaria", () => {
    const result = classify({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      aliquotaIva: 22,
    });
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
    expect(result.aliquotaIva).toBe(22);
    expect(result.registroIva).toBe("ACQUISTI");
  });

  it("IT con reverse charge interno N6.3 → TD16, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      isReverseChargeInterno: true,
      naturaIvaManuale: "N6_3",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD16");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("UE + BENI → TD18, doppia registrazione, aliquota IT", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.aliquotaIva).toBe(22);
  });

  it("UE + SERVIZI → TD17, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("Extra-UE + SERVIZI → TD17, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("Extra-UE + BENI → TD19, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "CN",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD19");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("San Marino con IVA → TD28, NO doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "SM",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      sanMarinoConIva: true,
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD28");
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
  });

  it("San Marino senza IVA → TD19, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "SM",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      sanMarinoConIva: false,
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD19");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("override manuale con natura diversa → accetta + warning", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      naturaIvaManuale: "N4",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("N7 (OSS) → nessuna autofattura, nessuna doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      naturaIvaManuale: "N7",
    });
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
    expect(result.naturaIva).toBe("N7");
  });
});

describe("IVA Classifier — Vendite", () => {
  it("vendita a cliente UE B2B beni → N3.2 cessione intra", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N3_2");
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.registroIva).toBe("VENDITE");
  });

  it("vendita a cliente UE servizi → N2.1 fuori campo", () => {
    const result = classify({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N2_1");
    expect(result.registroIva).toBe("VENDITE");
  });

  it("vendita export extra-UE beni → N3.1 esportazione", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "BENI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N3_1");
  });

  it("vendita extra-UE servizi → N2.1 fuori campo", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N2_1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/classifier.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement classifier**

```typescript
// src/lib/iva/classifier.ts
import type { NaturaIva, TipoDocumentoSdi } from "@prisma/client";
import type { ClassifierInput, ClassifierOutput } from "./types";
import { getCountryGroup } from "./countries";

const ALIQUOTA_ORDINARIA = 22;

const REVERSE_CHARGE_NATURE = new Set<string>([
  "N6_1", "N6_2", "N6_3", "N6_4", "N6_5", "N6_6", "N6_7", "N6_8", "N6_9",
]);

export function classify(input: ClassifierInput): ClassifierOutput {
  const countryGroup = getCountryGroup(input.nazioneFornitore);
  const warnings: string[] = [];

  // Vendite (fatture attive)
  if (input.tipoOperazione === "FATTURA_ATTIVA") {
    return classifyVendita(input, countryGroup, warnings);
  }

  // Acquisti (costi)
  return classifyAcquisto(input, countryGroup, warnings);
}

function classifyVendita(
  input: ClassifierInput,
  countryGroup: string,
  warnings: string[]
): ClassifierOutput {
  const base: ClassifierOutput = {
    naturaIva: null,
    aliquotaIva: ALIQUOTA_ORDINARIA,
    tipoDocumentoSdi: "TD01",
    richiedeAutofattura: false,
    richiedeDoppiaRegistrazione: false,
    tipoDocumentoAutofattura: null,
    registroIva: "VENDITE",
    countryGroup: countryGroup as any,
    warnings,
  };

  if (countryGroup === "IT") {
    // Vendita domestica — usa natura manuale o aliquota fornita
    if (input.naturaIvaManuale) base.naturaIva = input.naturaIvaManuale;
    if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;
    return base;
  }

  if (countryGroup === "UE") {
    if (input.tipoMerce === "BENI") {
      base.naturaIva = "N3_2"; // cessione intracomunitaria
      base.aliquotaIva = 0;
    } else {
      base.naturaIva = "N2_1"; // fuori campo art. 7-ter
      base.aliquotaIva = 0;
    }
  } else if (countryGroup === "EXTRA_UE" || countryGroup === "SAN_MARINO") {
    if (input.tipoMerce === "BENI") {
      base.naturaIva = "N3_1"; // esportazione
      base.aliquotaIva = 0;
    } else {
      base.naturaIva = "N2_1"; // fuori campo
      base.aliquotaIva = 0;
    }
  }

  // Override manuale
  if (input.naturaIvaManuale && input.naturaIvaManuale !== base.naturaIva) {
    warnings.push(
      `Natura manuale ${input.naturaIvaManuale} diversa dalla classificazione automatica ${base.naturaIva}`
    );
    base.naturaIva = input.naturaIvaManuale;
  }

  return base;
}

function classifyAcquisto(
  input: ClassifierInput,
  countryGroup: string,
  warnings: string[]
): ClassifierOutput {
  const base: ClassifierOutput = {
    naturaIva: null,
    aliquotaIva: input.aliquotaIva ?? ALIQUOTA_ORDINARIA,
    tipoDocumentoSdi: "TD01",
    richiedeAutofattura: false,
    richiedeDoppiaRegistrazione: false,
    tipoDocumentoAutofattura: null,
    registroIva: "ACQUISTI",
    countryGroup: countryGroup as any,
    warnings,
  };

  // Caso 0: N7 (OSS) — IVA assolta in altro stato UE, nessuna azione
  if (input.naturaIvaManuale === "N7") {
    base.naturaIva = "N7";
    base.aliquotaIva = 0;
    return base;
  }

  // Caso 1: IT domestico
  if (countryGroup === "IT") {
    if (input.naturaIvaManuale) base.naturaIva = input.naturaIvaManuale;
    if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;

    // Reverse charge interno
    if (input.isReverseChargeInterno && input.naturaIvaManuale &&
        REVERSE_CHARGE_NATURE.has(input.naturaIvaManuale)) {
      base.richiedeAutofattura = true;
      base.richiedeDoppiaRegistrazione = true;
      base.tipoDocumentoAutofattura = "TD16";
    }
    return base;
  }

  // Caso 2: UE
  if (countryGroup === "UE") {
    base.aliquotaIva = ALIQUOTA_ORDINARIA;
    base.richiedeAutofattura = true;
    base.richiedeDoppiaRegistrazione = true;

    if (input.tipoMerce === "BENI") {
      base.tipoDocumentoAutofattura = "TD18";
    } else {
      base.tipoDocumentoAutofattura = "TD17";
    }
    return applyOverride(base, input, warnings);
  }

  // Caso 3: Extra-UE
  if (countryGroup === "EXTRA_UE") {
    base.aliquotaIva = ALIQUOTA_ORDINARIA;
    base.richiedeAutofattura = true;
    base.richiedeDoppiaRegistrazione = true;

    if (input.tipoMerce === "SERVIZI") {
      base.tipoDocumentoAutofattura = "TD17";
    } else {
      base.tipoDocumentoAutofattura = "TD19";
    }
    return applyOverride(base, input, warnings);
  }

  // Caso 4: San Marino
  if (countryGroup === "SAN_MARINO") {
    if (input.sanMarinoConIva) {
      base.richiedeAutofattura = true; // TD28 comunicazione
      base.richiedeDoppiaRegistrazione = false;
      base.tipoDocumentoAutofattura = "TD28";
      if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;
    } else {
      base.aliquotaIva = ALIQUOTA_ORDINARIA;
      base.richiedeAutofattura = true;
      base.richiedeDoppiaRegistrazione = true;
      base.tipoDocumentoAutofattura = "TD19";
    }
    return applyOverride(base, input, warnings);
  }

  return base;
}

function applyOverride(
  output: ClassifierOutput,
  input: ClassifierInput,
  warnings: string[]
): ClassifierOutput {
  if (input.naturaIvaManuale) {
    warnings.push(
      `Override manuale natura: ${input.naturaIvaManuale} (classificazione automatica: operazione imponibile con aliquota ${output.aliquotaIva}%)`
    );
    output.naturaIva = input.naturaIvaManuale;
  }
  return output;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/classifier.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/classifier.ts src/lib/iva/__tests__/classifier.test.ts
git commit -m "feat(iva): add IVA classifier — rules for IT/UE/extra-UE/San Marino"
```

---

## Task 6: Validation module

**Files:**
- Create: `src/lib/iva/validation.ts`
- Create: `src/lib/iva/__tests__/validation.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateIva } from "../validation";

describe("IVA Validation", () => {
  it("natura presente con aliquota > 0 → warning (escluso N6.x)", () => {
    const result = validateIva({
      naturaIva: "N4",
      aliquotaIva: 22,
      nazioneFornitore: "IT",
      tipoDocumentoSdi: "TD01",
      tipoMerce: "SERVIZI",
      isAutofattura: false,
    });
    expect(result.some(w => w.field === "aliquotaIva" && w.severity === "warning")).toBe(true);
  });

  it("N6.x con aliquota > 0 → nessun warning (è corretto per autofattura)", () => {
    const result = validateIva({
      naturaIva: "N6_3",
      aliquotaIva: 22,
      nazioneFornitore: "IT",
      tipoDocumentoSdi: "TD16",
      tipoMerce: "SERVIZI",
      isAutofattura: true,
    });
    expect(result.some(w => w.field === "aliquotaIva")).toBe(false);
  });

  it("N6.x con fornitore estero → warning", () => {
    const result = validateIva({
      naturaIva: "N6_3",
      aliquotaIva: 0,
      nazioneFornitore: "DE",
      tipoDocumentoSdi: "TD01",
      tipoMerce: "SERVIZI",
      isAutofattura: false,
    });
    expect(result.some(w => w.severity === "warning" && w.message.includes("interno"))).toBe(true);
  });

  it("TD18 con fornitore extra-UE → errore", () => {
    const result = validateIva({
      naturaIva: null,
      aliquotaIva: 22,
      nazioneFornitore: "US",
      tipoDocumentoSdi: "TD18",
      tipoMerce: "BENI",
      isAutofattura: false,
    });
    expect(result.some(w => w.severity === "error")).toBe(true);
  });

  it("TD18 con SERVIZI → warning", () => {
    const result = validateIva({
      naturaIva: null,
      aliquotaIva: 22,
      nazioneFornitore: "DE",
      tipoDocumentoSdi: "TD18",
      tipoMerce: "SERVIZI",
      isAutofattura: false,
    });
    expect(result.some(w => w.message.includes("TD17"))).toBe(true);
  });

  it("splitPayment + N6.x → warning priorità RC", () => {
    const result = validateIva({
      naturaIva: "N6_3",
      aliquotaIva: 0,
      nazioneFornitore: "IT",
      tipoDocumentoSdi: "TD01",
      tipoMerce: "SERVIZI",
      isAutofattura: false,
      splitPayment: true,
    });
    expect(result.some(w => w.message.includes("priorità"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/validation.test.ts
```

- [ ] **Step 3: Implement validation**

```typescript
// src/lib/iva/validation.ts
import type { NaturaIva, TipoDocumentoSdi, TipoMerce } from "@prisma/client";
import type { ValidationWarning } from "./types";
import { getCountryGroup } from "./countries";

const REVERSE_CHARGE_NATURE = new Set<string>([
  "N6_1", "N6_2", "N6_3", "N6_4", "N6_5", "N6_6", "N6_7", "N6_8", "N6_9",
]);

type ValidationInput = {
  naturaIva: NaturaIva | null;
  aliquotaIva: number;
  nazioneFornitore: string | null;
  tipoDocumentoSdi: TipoDocumentoSdi | null;
  tipoMerce: TipoMerce | null;
  isAutofattura: boolean;
  splitPayment?: boolean;
  plafondAttivo?: boolean;
};

export function validateIva(input: ValidationInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const countryGroup = getCountryGroup(input.nazioneFornitore);
  const isRcNatura = input.naturaIva && REVERSE_CHARGE_NATURE.has(input.naturaIva);

  // Natura presente con aliquota > 0 (escluso N6.x su autofatture)
  if (input.naturaIva && input.aliquotaIva > 0 && !isRcNatura && !input.isAutofattura) {
    warnings.push({
      field: "aliquotaIva",
      message: "Natura IVA implica aliquota 0%",
      severity: "warning",
    });
  }

  // N6.x con fornitore estero
  if (isRcNatura && countryGroup !== "IT") {
    warnings.push({
      field: "naturaIva",
      message: "Reverse charge interno (N6.x) non compatibile con fornitore estero",
      severity: "warning",
    });
  }

  // TD18 con fornitore extra-UE
  if (input.tipoDocumentoSdi === "TD18" && countryGroup === "EXTRA_UE") {
    warnings.push({
      field: "tipoDocumentoSdi",
      message: "TD18 è solo per beni intra-UE, usare TD19",
      severity: "error",
    });
  }

  // TD18 con SERVIZI
  if (input.tipoDocumentoSdi === "TD18" && input.tipoMerce === "SERVIZI") {
    warnings.push({
      field: "tipoDocumentoSdi",
      message: "TD18 è per beni, servizi usano TD17",
      severity: "warning",
    });
  }

  // N3.5 senza plafond attivo
  if (input.naturaIva === "N3_5" && !input.plafondAttivo) {
    warnings.push({
      field: "naturaIva",
      message: "Operazione N3.5 senza plafond configurato",
      severity: "warning",
    });
  }

  // Split payment + reverse charge
  if (input.splitPayment && isRcNatura) {
    warnings.push({
      field: "splitPayment",
      message: "Reverse charge ha priorità su split payment",
      severity: "warning",
    });
  }

  return warnings;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/validation.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/validation.ts src/lib/iva/__tests__/validation.test.ts
git commit -m "feat(iva): add validation module — natura/aliquota/TD/nazione coherence"
```

---

## Task 7: Autofattura generator

**Files:**
- Create: `src/lib/iva/autofattura.ts`
- Create: `src/lib/iva/__tests__/autofattura.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/autofattura.test.ts
import { describe, it, expect } from "vitest";
import { buildAutofatturaData } from "../autofattura";

describe("buildAutofatturaData", () => {
  it("genera integrazione TD18 per acquisto beni UE", () => {
    const result = buildAutofatturaData({
      descrizioneOriginale: "Acquisto componenti elettronici",
      importoImponibile: 1000,
      tipoDocumentoAutofattura: "TD18",
      aliquotaIva: 22,
      tipoMerce: "BENI",
      doppiaRegistrazione: true,
    });
    expect(result.descrizione).toBe("Integrazione TD18 - Acquisto componenti elettronici");
    expect(result.importoImponibile).toBe(1000);
    expect(result.importoIva).toBe(220);
    expect(result.tipoDocumentoSdi).toBe("TD18");
    expect(result.doppiaRegistrazione).toBe(true);
    expect(result.registroIva).toBe("ACQUISTI");
  });

  it("genera comunicazione TD28 per San Marino con IVA", () => {
    const result = buildAutofatturaData({
      descrizioneOriginale: "Acquisto da SM",
      importoImponibile: 500,
      tipoDocumentoAutofattura: "TD28",
      aliquotaIva: 22,
      tipoMerce: "BENI",
      doppiaRegistrazione: false,
    });
    expect(result.tipoDocumentoSdi).toBe("TD28");
    expect(result.doppiaRegistrazione).toBe(false);
  });

  it("calcola importo IVA corretto con aliquota ridotta", () => {
    const result = buildAutofatturaData({
      descrizioneOriginale: "Alimentari",
      importoImponibile: 1000,
      tipoDocumentoAutofattura: "TD18",
      aliquotaIva: 10,
      tipoMerce: "BENI",
      doppiaRegistrazione: true,
    });
    expect(result.importoIva).toBe(100);
  });

  it("tronca descrizione lunga", () => {
    const longDesc = "A".repeat(300);
    const result = buildAutofatturaData({
      descrizioneOriginale: longDesc,
      importoImponibile: 100,
      tipoDocumentoAutofattura: "TD17",
      aliquotaIva: 22,
      tipoMerce: "SERVIZI",
      doppiaRegistrazione: true,
    });
    expect(result.descrizione.length).toBeLessThanOrEqual(255);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/autofattura.test.ts
```

- [ ] **Step 3: Implement autofattura builder**

```typescript
// src/lib/iva/autofattura.ts
import type { TipoDocumentoSdi, TipoMerce } from "@prisma/client";
import type { AutofatturaData } from "./types";

type BuildAutofatturaInput = {
  descrizioneOriginale: string;
  importoImponibile: number;
  tipoDocumentoAutofattura: TipoDocumentoSdi;
  aliquotaIva: number;
  tipoMerce: TipoMerce;
  doppiaRegistrazione: boolean;
};

const MAX_DESC_LENGTH = 255;

export function buildAutofatturaData(input: BuildAutofatturaInput): AutofatturaData {
  const importoIva = Math.round(input.importoImponibile * input.aliquotaIva) / 100;

  const rawDescrizione = `Integrazione ${input.tipoDocumentoAutofattura} - ${input.descrizioneOriginale}`;
  const descrizione = rawDescrizione.length > MAX_DESC_LENGTH
    ? rawDescrizione.slice(0, MAX_DESC_LENGTH - 3) + "..."
    : rawDescrizione;

  return {
    descrizione,
    importoImponibile: input.importoImponibile,
    aliquotaIva: input.aliquotaIva,
    importoIva,
    tipoDocumentoSdi: input.tipoDocumentoAutofattura,
    tipoMerce: input.tipoMerce,
    doppiaRegistrazione: input.doppiaRegistrazione,
    registroIva: "ACQUISTI",
    naturaOperazioneIva: null,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/autofattura.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/autofattura.ts src/lib/iva/__tests__/autofattura.test.ts
git commit -m "feat(iva): add autofattura data builder"
```

---

## Task 8: Doppia registrazione — protocollo assignment

**Files:**
- Create: `src/lib/iva/doppia-registrazione.ts`
- Create: `src/lib/iva/__tests__/doppia-registrazione.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/doppia-registrazione.test.ts
import { describe, it, expect } from "vitest";
import { getNextProtocollo, formatProtocollo } from "../doppia-registrazione";

describe("doppia-registrazione", () => {
  it("formatProtocollo formatta con padding a 4 cifre", () => {
    expect(formatProtocollo(1, 2026)).toBe("0001/2026");
    expect(formatProtocollo(42, 2026)).toBe("0042/2026");
    expect(formatProtocollo(1234, 2026)).toBe("1234/2026");
  });

  it("getNextProtocollo con lista vuota ritorna 1", () => {
    expect(getNextProtocollo(null)).toBe(1);
    expect(getNextProtocollo(undefined as any)).toBe(1);
  });

  it("getNextProtocollo incrementa dal massimo esistente", () => {
    expect(getNextProtocollo("0005/2026")).toBe(6);
    expect(getNextProtocollo("0099/2026")).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/doppia-registrazione.test.ts
```

- [ ] **Step 3: Implement protocollo logic**

```typescript
// src/lib/iva/doppia-registrazione.ts

/**
 * Parses the numeric part from a protocollo string like "0042/2026"
 * and returns the next sequential number.
 */
export function getNextProtocollo(lastProtocollo: string | null | undefined): number {
  if (!lastProtocollo) return 1;
  const numPart = lastProtocollo.split("/")[0];
  const num = parseInt(numPart, 10);
  if (isNaN(num)) return 1;
  return num + 1;
}

/**
 * Formats a protocollo number with 4-digit padding and year.
 * e.g., formatProtocollo(42, 2026) → "0042/2026"
 */
export function formatProtocollo(num: number, anno: number): string {
  return `${String(num).padStart(4, "0")}/${anno}`;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/doppia-registrazione.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/doppia-registrazione.ts src/lib/iva/__tests__/doppia-registrazione.test.ts
git commit -m "feat(iva): add protocollo IVA assignment logic"
```

---

## Task 9: Plafond module

**Files:**
- Create: `src/lib/iva/plafond.ts`
- Create: `src/lib/iva/__tests__/plafond.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/plafond.test.ts
import { describe, it, expect } from "vitest";
import { checkPlafond, calculateSforamento } from "../plafond";

describe("plafond", () => {
  it("plafond non attivo → risultato neutro", () => {
    const result = checkPlafond({
      plafondAttivo: false,
      importoDisponibile: 0,
      importoUtilizzato: 0,
      importoOperazione: 1000,
    });
    expect(result.plafondAttivo).toBe(false);
    expect(result.sforamento).toBe(false);
  });

  it("operazione entro il plafond → OK", () => {
    const result = checkPlafond({
      plafondAttivo: true,
      importoDisponibile: 100000,
      importoUtilizzato: 50000,
      importoOperazione: 10000,
    });
    expect(result.plafondAttivo).toBe(true);
    expect(result.sforamento).toBe(false);
    expect(result.importoResiduo).toBe(40000);
  });

  it("operazione supera il plafond → sforamento", () => {
    const result = checkPlafond({
      plafondAttivo: true,
      importoDisponibile: 100000,
      importoUtilizzato: 95000,
      importoOperazione: 10000,
    });
    expect(result.sforamento).toBe(true);
    expect(result.importoSforamento).toBe(5000);
  });

  it("calculateSforamento calcola eccedenza corretta", () => {
    expect(calculateSforamento(100000, 95000, 10000)).toBe(5000);
    expect(calculateSforamento(100000, 50000, 10000)).toBe(0);
  });

  it("plafond esattamente esaurito → sforamento 0 ma segnalazione", () => {
    const result = checkPlafond({
      plafondAttivo: true,
      importoDisponibile: 100000,
      importoUtilizzato: 90000,
      importoOperazione: 10000,
    });
    expect(result.sforamento).toBe(false);
    expect(result.importoResiduo).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/plafond.test.ts
```

- [ ] **Step 3: Implement plafond logic**

```typescript
// src/lib/iva/plafond.ts
import type { PlafondCheckResult } from "./types";

type PlafondCheckInput = {
  plafondAttivo: boolean;
  importoDisponibile: number;
  importoUtilizzato: number;
  importoOperazione: number;
};

export function checkPlafond(input: PlafondCheckInput): PlafondCheckResult {
  if (!input.plafondAttivo) {
    return {
      plafondAttivo: false,
      importoDisponibile: 0,
      importoUtilizzato: 0,
      importoResiduo: 0,
      sforamento: false,
      importoSforamento: 0,
    };
  }

  const nuovoUtilizzato = input.importoUtilizzato + input.importoOperazione;
  const sforamento = nuovoUtilizzato > input.importoDisponibile;
  const importoSforamento = sforamento
    ? nuovoUtilizzato - input.importoDisponibile
    : 0;
  const importoResiduo = Math.max(0, input.importoDisponibile - nuovoUtilizzato);

  return {
    plafondAttivo: true,
    importoDisponibile: input.importoDisponibile,
    importoUtilizzato: nuovoUtilizzato,
    importoResiduo,
    sforamento,
    importoSforamento,
  };
}

export function calculateSforamento(
  disponibile: number,
  utilizzato: number,
  importoOperazione: number
): number {
  const eccedenza = (utilizzato + importoOperazione) - disponibile;
  return Math.max(0, eccedenza);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/plafond.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/plafond.ts src/lib/iva/__tests__/plafond.test.ts
git commit -m "feat(iva): add plafond module — tracking and sforamento detection"
```

---

## Task 10: IVA Engine orchestrator

**Files:**
- Create: `src/lib/iva/engine.ts`
- Create: `src/lib/iva/__tests__/engine.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/iva/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { processIva } from "../engine";

describe("IVA Engine — processIva", () => {
  it("acquisto domestico ordinario → nessuna autofattura", () => {
    const result = processIva({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      aliquotaIva: 22,
      descrizione: "Consulenza",
      importoImponibile: 1000,
    });
    expect(result.classification.richiedeAutofattura).toBe(false);
    expect(result.autofattura).toBeNull();
    expect(result.validationWarnings).toHaveLength(0);
    expect(result.plafondResult).toBeNull();
    expect(result.splafonamentoAutofattura).toBeNull();
  });

  it("acquisto beni da DE → autofattura TD18 + doppia reg", () => {
    const result = processIva({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      descrizione: "Componenti elettronici",
      importoImponibile: 1000,
    });
    expect(result.classification.richiedeAutofattura).toBe(true);
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.autofattura).not.toBeNull();
    expect(result.autofattura!.importoIva).toBe(220);
    expect(result.autofattura!.doppiaRegistrazione).toBe(true);
  });

  it("vendita a cliente FR servizi → N2.1, no autofattura", () => {
    const result = processIva({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
      descrizione: "Consulenza",
      importoImponibile: 5000,
    });
    expect(result.classification.naturaIva).toBe("N2_1");
    expect(result.classification.richiedeAutofattura).toBe(false);
    expect(result.autofattura).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/engine.test.ts
```

- [ ] **Step 3: Implement engine**

```typescript
// src/lib/iva/engine.ts
import type { NaturaIva, TipoMerce } from "@prisma/client";
import type { ClassifierOutput, AutofatturaData, ValidationWarning, PlafondCheckResult } from "./types";
import { classify } from "./classifier";
import { buildAutofatturaData } from "./autofattura";
import { validateIva } from "./validation";
import { checkPlafond } from "./plafond";

type ProcessIvaInput = {
  nazioneFornitore: string | null;
  tipoMerce: TipoMerce;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA";
  descrizione: string;
  importoImponibile: number;
  aliquotaIva?: number | null;
  naturaIvaManuale?: NaturaIva | null;
  isReverseChargeInterno?: boolean;
  sanMarinoConIva?: boolean;
  splitPayment?: boolean;
  // Plafond context (fetched from DB before calling)
  plafondAttivo?: boolean;
  plafondDisponibile?: number;
  plafondUtilizzato?: number;
};

type ProcessIvaResult = {
  classification: ClassifierOutput;
  autofattura: AutofatturaData | null;
  validationWarnings: ValidationWarning[];
  plafondResult: PlafondCheckResult | null;
  splafonamentoAutofattura: AutofatturaData | null;  // TD21 if splafonamento
};

export function processIva(input: ProcessIvaInput): ProcessIvaResult {
  // Step 1: Classify
  const classification = classify({
    nazioneFornitore: input.nazioneFornitore,
    tipoMerce: input.tipoMerce,
    tipoOperazione: input.tipoOperazione,
    naturaIvaManuale: input.naturaIvaManuale,
    aliquotaIva: input.aliquotaIva,
    isReverseChargeInterno: input.isReverseChargeInterno,
    sanMarinoConIva: input.sanMarinoConIva,
  });

  // Step 2: Build autofattura data if needed
  let autofattura: AutofatturaData | null = null;
  if (classification.richiedeAutofattura && classification.tipoDocumentoAutofattura) {
    autofattura = buildAutofatturaData({
      descrizioneOriginale: input.descrizione,
      importoImponibile: input.importoImponibile,
      tipoDocumentoAutofattura: classification.tipoDocumentoAutofattura,
      aliquotaIva: classification.aliquotaIva,
      tipoMerce: input.tipoMerce,
      doppiaRegistrazione: classification.richiedeDoppiaRegistrazione,
    });
  }

  // Step 3: Plafond check (for N3.5 purchases with dichiarazione d'intento)
  let plafondResult: PlafondCheckResult | null = null;
  let splafonamentoAutofattura: AutofatturaData | null = null;
  const isPlafondOperation = classification.naturaIva === "N3_5" ||
    input.naturaIvaManuale === "N3_5";

  if (isPlafondOperation && input.plafondAttivo) {
    plafondResult = checkPlafond({
      plafondAttivo: true,
      importoDisponibile: input.plafondDisponibile || 0,
      importoUtilizzato: input.plafondUtilizzato || 0,
      importoOperazione: input.importoImponibile,
    });

    // Generate TD21 autofattura for splafonamento
    if (plafondResult.sforamento) {
      splafonamentoAutofattura = buildAutofatturaData({
        descrizioneOriginale: `Splafonamento - ${input.descrizione}`,
        importoImponibile: plafondResult.importoSforamento,
        tipoDocumentoAutofattura: "TD21",
        aliquotaIva: 22, // aliquota ordinaria sull'eccedenza
        tipoMerce: input.tipoMerce,
        doppiaRegistrazione: false, // TD21 non richiede doppia registrazione
      });
    }
  }

  // Step 4: Validate
  const validationWarnings = validateIva({
    naturaIva: classification.naturaIva,
    aliquotaIva: classification.aliquotaIva,
    nazioneFornitore: input.nazioneFornitore,
    tipoDocumentoSdi: classification.tipoDocumentoSdi,
    tipoMerce: input.tipoMerce,
    isAutofattura: false,
    splitPayment: input.splitPayment,
    plafondAttivo: input.plafondAttivo,
  });

  return {
    classification,
    autofattura,
    validationWarnings,
    plafondResult,
    splafonamentoAutofattura,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/engine.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run ALL IVA tests together**

```bash
npx vitest run src/lib/iva/
```

Expected: all tests in all modules pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/iva/engine.ts src/lib/iva/__tests__/engine.test.ts
git commit -m "feat(iva): add IVA engine orchestrator"
```

---

## Task 11: IVA Preview API endpoint

**Files:**
- Create: `src/app/api/iva/preview/route.ts`

- [ ] **Step 1: Create preview endpoint**

```typescript
// src/app/api/iva/preview/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processIva } from "@/lib/iva/engine";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const {
      nazioneFornitore,
      tipoMerce,
      tipoOperazione,
      descrizione,
      importoImponibile,
      aliquotaIva,
      naturaIvaManuale,
      isReverseChargeInterno,
      sanMarinoConIva,
      splitPayment,
    } = body;

    if (!tipoMerce || !tipoOperazione) {
      return NextResponse.json(
        { error: "tipoMerce e tipoOperazione sono obbligatori" },
        { status: 400 }
      );
    }

    const result = processIva({
      nazioneFornitore: nazioneFornitore || "IT",
      tipoMerce,
      tipoOperazione,
      descrizione: descrizione || "",
      importoImponibile: importoImponibile || 0,
      aliquotaIva,
      naturaIvaManuale,
      isReverseChargeInterno,
      sanMarinoConIva,
      splitPayment,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore preview IVA:", error);
    return NextResponse.json(
      { error: "Errore nella preview IVA" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/iva/preview/route.ts
git commit -m "feat(api): add POST /api/iva/preview endpoint"
```

---

## Task 12: Integrate IVA Engine in POST /api/operazioni

**Files:**
- Modify: `src/app/api/operazioni/route.ts` (lines ~466-660, inside the transaction)

- [ ] **Step 1: Read the current POST handler carefully**

Read `src/app/api/operazioni/route.ts` lines 223-704 to understand the full transaction flow.

- [ ] **Step 2: Add IVA engine import and integration**

At the top of the file, add:
```typescript
import { processIva } from "@/lib/iva/engine";
import { buildAutofatturaData } from "@/lib/iva/autofattura";
import { getNextProtocollo, formatProtocollo } from "@/lib/iva/doppia-registrazione";
```

Inside the Prisma transaction (after the main operazione is created, before the transaction returns), add IVA engine processing:

1. Fetch the anagrafica's `nazione` if fornitoreId or clienteId is set
2. Call `processIva()` with the operation data
3. If `classification.richiedeAutofattura`, create the autofattura operazione inside the same transaction
4. If `doppiaRegistrazione`, fetch last protocolli for both ACQUISTI and VENDITE registers and assign both
5. Return the autofattura ID alongside the main operazione

The exact code depends on the current transaction structure — the implementor should read the file first and integrate accordingly. Key principle: the autofattura creation MUST be inside the same `prisma.$transaction()` as the main operazione.

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/operazioni/route.ts
git commit -m "feat(api): integrate IVA engine in POST /api/operazioni"
```

---

## Task 13: Integrate IVA Engine in PUT /api/operazioni/[id]

**Files:**
- Modify: `src/app/api/operazioni/[id]/route.ts` (PUT handler ~line 136+)

- [ ] **Step 1: Read the current PUT handler**

Read `src/app/api/operazioni/[id]/route.ts` lines 136+ to understand the update flow.

- [ ] **Step 2: Add IVA engine integration to PUT**

Same imports as Task 12. Inside the update transaction:

1. If the operazione has existing autofatture (`autofatture` relation), delete them first
2. Re-run `processIva()` with updated data
3. If autofattura needed, create new one inside the same transaction
4. Handle protocollo assignment for new autofattura

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/operazioni/[id]/route.ts
git commit -m "feat(api): integrate IVA engine in PUT /api/operazioni/[id]"
```

---

## Task 14: Update Registri IVA API for doppia registrazione

**Files:**
- Modify: `src/app/api/registri-iva/route.ts`

- [ ] **Step 1: Read the current registri-iva route**

Read `src/app/api/registri-iva/route.ts` fully.

- [ ] **Step 2: Update query to include doppia registrazione entries**

When filtering for VENDITE, also include operations where `doppiaRegistrazione: true` (regardless of their `registroIva` value). Use `protocolloIvaVendite` as the protocol for these entries in the vendite register.

Add to the response: `tipoDocumentoSdi`, `doppiaRegistrazione`, and fornitore/cliente `nazione`.

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/registri-iva/route.ts
git commit -m "feat(api): registri-iva handles doppia registrazione entries"
```

---

## Task 15: XML Parser — extract nazione cedente

**Files:**
- Modify: `src/lib/ocr/xml-parser.ts`
- Modify: `src/lib/ocr/types.ts`

- [ ] **Step 1: Add nazione to ParsedDocument type**

In `src/lib/ocr/types.ts`, add to `cedentePrestatore` inside `ParsedDocument`:

```typescript
cedentePrestatore?: {
  denominazione?: string;
  partitaIva?: string;
  codiceFiscale?: string;
  regimeFiscale?: string;
  nazione?: string;     // ← NEW
};
```

- [ ] **Step 2: Extract nazione in xml-parser.ts**

In `src/lib/ocr/xml-parser.ts`, the parser uses `fast-xml-parser` (object navigation, NOT DOM). In the cedentePrestatore extraction section where other fields are extracted, add:

```typescript
const sede = cedente?.Sede || {};
const nazione = sede?.Nazione || null;
```

Then include `nazione` in the returned `cedentePrestatore` object.

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ocr/xml-parser.ts src/lib/ocr/types.ts
git commit -m "feat(ocr): extract CedentePrestatore nazione from FatturaPA XML"
```

---

## Task 16: OCR Haiku prompt — add tipoMerce classification

**Files:**
- Modify: `src/app/api/ocr/route.ts` (~lines 10-59, the `buildSystemPrompt` function)

- [ ] **Step 1: Read the current Haiku prompt**

Read `src/app/api/ocr/route.ts` lines 10-59 to see the current system prompt.

- [ ] **Step 2: Add tipoMerce classification to prompt**

In the prompt's JSON output schema instructions, add:

```
"tipoMerce": "BENI" o "SERVIZI" - classifica in base alle righe del documento. Se il documento contiene sia beni che servizi, usa la componente prevalente per importo.
```

- [ ] **Step 3: Handle tipoMerce in the response parsing**

After the Haiku response is parsed, extract `tipoMerce` and include it in the returned data.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ocr/route.ts
git commit -m "feat(ocr): add tipoMerce BENI/SERVIZI classification to Haiku prompt"
```

---

## Task 17: Anagrafiche UI — expose nazione field

**Files:**
- Modify: `src/app/bilancio/anagrafiche/anagrafiche-content.tsx`

- [ ] **Step 1: Read the current anagrafiche form**

Read `src/app/bilancio/anagrafiche/anagrafiche-content.tsx` fully.

- [ ] **Step 2: Add nazione to FormData type and EMPTY_FORM**

```typescript
// Add to FormData type:
nazione: string;

// Add to EMPTY_FORM:
nazione: "IT",
```

- [ ] **Step 3: Add nazione select in the form**

Import `EU_COUNTRY_LIST` from `@/lib/iva/countries`. Add a grouped Select field for Nazione in the address section, after "Provincia":

- Group 1: "Italia" → `{ code: "IT", name: "Italia" }`
- Group 2: "Unione Europea" → all EU countries from `EU_COUNTRY_LIST`
- Group 3: "Extra-UE" → common extra-EU countries + free text option

When `nazione !== "IT"`, make "Provincia" optional.

- [ ] **Step 4: Ensure nazione is sent in API calls**

In the save handler, include `nazione` in the POST/PATCH body.

- [ ] **Step 5: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/bilancio/anagrafiche/anagrafiche-content.tsx
git commit -m "feat(ui): expose nazione field in anagrafiche form"
```

---

## Task 18: Dati Contabili Tab — tipoMerce + autofattura badge

**Files:**
- Modify: `src/components/operazioni/dati-contabili-tab.tsx`

- [ ] **Step 1: Read the current component**

Read `src/components/operazioni/dati-contabili-tab.tsx` to understand the form structure.

- [ ] **Step 2: Add tipoMerce field**

Add a BENI/SERVIZI select that appears when the fornitore is estero (nazione ≠ IT). In modalità semplice, this is the only extra field shown for foreign invoices.

- [ ] **Step 3: Add autofattura badge (modalità semplice)**

When an operazione has linked autofatture, show a badge: "Integrazione IVA generata automaticamente". In avanzata, show a "Vedi autofattura" link.

- [ ] **Step 4: Add IVA preview pre-fill (modalità avanzata)**

When fornitore changes and is estero, call `POST /api/iva/preview` and pre-fill naturaIva, tipoDocumentoSdi, registroIva with the suggested values.

- [ ] **Step 5: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/operazioni/dati-contabili-tab.tsx
git commit -m "feat(ui): add tipoMerce selector, autofattura badge, IVA preview pre-fill"
```

---

## Task 19: Registri IVA UI — new columns and filters

**Files:**
- Modify: `src/app/bilancio/registri-iva/registri-iva-content.tsx`

- [ ] **Step 1: Read the current registri-iva UI**

Read `src/app/bilancio/registri-iva/registri-iva-content.tsx` fully.

- [ ] **Step 2: Add columns**

Add to the table: "Tipo Doc." (tipoDocumentoSdi) and "Nazione" (fornitore/cliente nazione).

- [ ] **Step 3: Add filters**

Add filter buttons/toggles: "Solo operazioni estere", "Solo reverse charge" (filters by doppiaRegistrazione or TD16-TD19).

- [ ] **Step 4: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/bilancio/registri-iva/registri-iva-content.tsx
git commit -m "feat(ui): registri-iva — add tipo doc, nazione columns and filters"
```

---

## Task 20: Plafond API and UI

**Files:**
- Create: `src/app/api/plafond/route.ts`
- Modify: `src/app/bilancio/registri-iva/registri-iva-content.tsx` (or create separate plafond page)

- [ ] **Step 1: Create plafond API — GET and POST**

`GET /api/plafond?anno=2026` — returns plafond for the year (if exists)
`POST /api/plafond` — creates/updates plafond config (metodo, importoDisponibile)

- [ ] **Step 2: Add plafond widget in avanzata mode**

In the registri-iva or bilancio page, add a plafond progress bar widget (only visible in avanzata mode when plafond is configured). Shows: importoDisponibile, importoUtilizzato, percentuale, alert if >80%.

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/plafond/route.ts src/app/bilancio/registri-iva/registri-iva-content.tsx
git commit -m "feat: add plafond API and progress widget"
```

---

## Task 21: Integration test — full end-to-end flow

**Files:**
- Create: `src/lib/iva/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// src/lib/iva/__tests__/integration.test.ts
import { describe, it, expect } from "vitest";
import { processIva } from "../engine";

describe("IVA Engine — integration scenarios", () => {
  it("scenario completo: fattura acquisto beni da Germania", () => {
    const result = processIva({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      descrizione: "Componenti elettronici Siemens",
      importoImponibile: 5000,
    });

    // Classification
    expect(result.classification.countryGroup).toBe("UE");
    expect(result.classification.richiedeAutofattura).toBe(true);
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.classification.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.classification.aliquotaIva).toBe(22);

    // Autofattura
    expect(result.autofattura).not.toBeNull();
    expect(result.autofattura!.descrizione).toContain("TD18");
    expect(result.autofattura!.importoImponibile).toBe(5000);
    expect(result.autofattura!.importoIva).toBe(1100);
    expect(result.autofattura!.doppiaRegistrazione).toBe(true);

    // No validation warnings
    expect(result.validationWarnings).toHaveLength(0);
  });

  it("scenario completo: fattura servizi da USA", () => {
    const result = processIva({
      nazioneFornitore: "US",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      descrizione: "Licenza software annuale",
      importoImponibile: 12000,
    });

    expect(result.classification.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.autofattura!.importoIva).toBe(2640);
  });

  it("scenario completo: vendita servizi a cliente francese", () => {
    const result = processIva({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
      descrizione: "Consulenza strategica",
      importoImponibile: 20000,
    });

    expect(result.classification.naturaIva).toBe("N2_1");
    expect(result.classification.aliquotaIva).toBe(0);
    expect(result.autofattura).toBeNull();
  });

  it("scenario completo: reverse charge interno subappalto", () => {
    const result = processIva({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      descrizione: "Lavori edili subappalto",
      importoImponibile: 30000,
      isReverseChargeInterno: true,
      naturaIvaManuale: "N6_3",
    });

    expect(result.classification.tipoDocumentoAutofattura).toBe("TD16");
    expect(result.classification.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.autofattura!.importoIva).toBe(6600);
  });
});
```

- [ ] **Step 2: Run ALL tests**

```bash
npx vitest run src/lib/iva/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/iva/__tests__/integration.test.ts
git commit -m "test(iva): add integration test scenarios for full IVA engine flow"
```

---

## Task 22: Handle deletion of operations with linked autofatture

**Files:**
- Modify: `src/app/api/operazioni/[id]/route.ts` (DELETE handler)

- [ ] **Step 1: Read the current DELETE handler**

Read `src/app/api/operazioni/[id]/route.ts` to find the DELETE handler (or soft-delete via `eliminato` flag).

- [ ] **Step 2: Add cascade deletion for autofatture**

Before deleting/soft-deleting an operazione, check if it has linked autofatture via `operazioneOrigineId`. If so, delete/soft-delete the autofatture first. The API should return the list of autofatture that were also deleted in the response, so the UI can show confirmation.

Note: protocolli IVA of deleted operations are NOT reassigned — they remain as "annullato" gaps in the register (conforme alla prassi fiscale italiana).

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/operazioni/[id]/route.ts
git commit -m "feat(api): cascade soft-delete autofatture when deleting linked operation"
```

---

## Task 23: Warning on anagrafica nazione change

**Files:**
- Modify: `src/app/api/anagrafiche/[id]/route.ts` (PATCH handler)

- [ ] **Step 1: Read the current PATCH handler**

Read `src/app/api/anagrafiche/[id]/route.ts` to understand the update flow.

- [ ] **Step 2: Add nazione change detection**

When `nazione` is updated, query how many operations reference this anagrafica. If > 0, include a warning in the response:

```typescript
// After updating the anagrafica
if (body.nazione && body.nazione !== existingAnagrafica.nazione) {
  const operazioniCollegate = await prisma.operazione.count({
    where: {
      OR: [
        { fornitoreId: anagraficaId },
        { clienteId: anagraficaId },
      ],
      eliminato: false,
    },
  });
  if (operazioniCollegate > 0) {
    responseData.warning = `Ci sono ${operazioniCollegate} operazioni registrate con il precedente trattamento IVA. Non vengono ricalcolate automaticamente.`;
  }
}
```

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/anagrafiche/[id]/route.ts
git commit -m "feat(api): warn when changing anagrafica nazione with existing operations"
```

---

## Task 24: Plafond mobile recalculation

**Files:**
- Modify: `src/lib/iva/plafond.ts`
- Create: `src/lib/iva/__tests__/plafond-mobile.test.ts`

- [ ] **Step 1: Write tests for mobile recalculation**

```typescript
// src/lib/iva/__tests__/plafond-mobile.test.ts
import { describe, it, expect } from "vitest";
import { calculateMobilePlafond } from "../plafond";

describe("plafond mobile recalculation", () => {
  it("somma esportazioni degli ultimi 12 mesi", () => {
    const esportazioni = [
      { importo: 10000, data: new Date("2025-06-15") },
      { importo: 20000, data: new Date("2025-09-01") },
      { importo: 15000, data: new Date("2026-01-10") },
    ];
    const result = calculateMobilePlafond(esportazioni, new Date("2026-03-20"));
    expect(result).toBe(45000);
  });

  it("esclude esportazioni oltre i 12 mesi", () => {
    const esportazioni = [
      { importo: 10000, data: new Date("2024-12-01") }, // > 12 mesi fa
      { importo: 20000, data: new Date("2025-06-15") },
    ];
    const result = calculateMobilePlafond(esportazioni, new Date("2026-03-20"));
    expect(result).toBe(20000);
  });

  it("nessuna esportazione → plafond 0", () => {
    const result = calculateMobilePlafond([], new Date("2026-03-20"));
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/iva/__tests__/plafond-mobile.test.ts
```

- [ ] **Step 3: Implement mobile recalculation**

Add to `src/lib/iva/plafond.ts`:

```typescript
type EsportazioneRecord = {
  importo: number;
  data: Date;
};

/**
 * Calculates the mobile plafond by summing export operations
 * (N3.1, N3.2, N3.4) from the 12 months preceding the reference date.
 */
export function calculateMobilePlafond(
  esportazioni: EsportazioneRecord[],
  dataRiferimento: Date
): number {
  const twelveMonthsAgo = new Date(dataRiferimento);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  return esportazioni
    .filter(e => e.data >= twelveMonthsAgo && e.data <= dataRiferimento)
    .reduce((sum, e) => sum + e.importo, 0);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/iva/__tests__/plafond-mobile.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iva/plafond.ts src/lib/iva/__tests__/plafond-mobile.test.ts
git commit -m "feat(iva): add plafond mobile recalculation — rolling 12 months"
```

---

## Task 25: Final build verification and cleanup

- [ ] **Step 1: Run full IVA test suite**

```bash
npx vitest run src/lib/iva/
```

Expected: all IVA module tests pass.

- [ ] **Step 2: Run full project test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run full build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Run linting**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix lint issues and finalize IVA engine implementation"
```
