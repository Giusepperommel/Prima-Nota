# Sub-project 0: Architettura Fondazionale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational architecture (Provider/Adapter, AI Pipeline, Notification System) that all subsequent sub-projects depend on.

**Architecture:** Three independent modules under `src/lib/`: `providers/` for the adapter pattern, `ai/` for the AI pipeline, `notifiche/` for the notification engine. Each module has its own Prisma models, API routes, types, and tests. The modules are loosely coupled — they can be implemented and tested independently.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6 (MySQL), Vitest, @anthropic-ai/sdk, Resend, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-25-automazioni-commercialista-design.md` (Section: Sub-project 0)

---

## File Structure

### New files

```
prisma/
  migrations/XXXXXX_sp0_architettura_fondazionale/   # Auto-generated

src/lib/
  providers/
    types.ts                    # Provider interfaces (FattureProvider, BancaProvider)
    manager.ts                  # ProviderManager: registry + factory
    adapters/
      fatture-file.ts           # FileXML adapter for fatture
      banca-file.ts             # FileCSV adapter for banca (wraps existing)
  ai/
    types.ts                    # AI pipeline types (AiSuggestionInput, etc.)
    pipeline.ts                 # Core AI pipeline: deterministic → AI → review
    classifier.ts               # Claude-based classifier (fatture, movimenti)
    cost-tracker.ts             # Token usage tracking
  notifiche/
    types.ts                    # Notification types
    engine.ts                   # NotificationEngine: create, schedule, send
    digest.ts                   # Digest aggregator (giornaliero/settimanale)
    channels/
      in-app.ts                 # In-app notification channel
      email.ts                  # Email channel (Resend)
  __tests__/
    providers-manager.test.ts
    providers-fatture-file.test.ts
    providers-banca-file.test.ts
    ai-pipeline.test.ts
    ai-classifier.test.ts
    ai-cost-tracker.test.ts
    notifiche-engine.test.ts
    notifiche-digest.test.ts

src/app/api/
  providers/
    route.ts                    # GET (list) / POST (create) provider configs
    [id]/
      route.ts                  # GET / PUT / DELETE single provider config
    test/
      route.ts                  # POST: test provider connection
  notifiche/
    route.ts                    # GET (list) / PUT (mark read)
    preferenze/
      route.ts                  # GET / PUT notification preferences
  ai/
    suggestions/
      route.ts                  # GET (pending) / PUT (approve/reject)
```

### Modified files

```
prisma/schema.prisma            # Add 4 new models + enums + Societa/Utente relations
```

---

## Task 1: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Provider enums and model**

Add after the existing `ConfigurazioneProvider` model:

```prisma
// ─── Provider/Adapter System ──────────────────────────────────────────────────

enum ProviderTipo {
  FATTURE
  BANCA
}

enum ProviderNome {
  FILE
  ARUBA
  INFOCERT
  FABRICK
  NORDIGEN
}

enum ProviderStato {
  ATTIVO
  CONFIGURAZIONE
  ERRORE
}

model ProviderConfig {
  id            Int            @id @default(autoincrement())
  societaId     Int            @map("societa_id")
  tipo          ProviderTipo   @map("tipo")
  provider      ProviderNome   @map("provider")
  credenziali   Json?          @map("credenziali")
  stato         ProviderStato  @default(CONFIGURAZIONE) @map("stato")
  ultimoSync    DateTime?      @map("ultimo_sync")
  configExtra   Json?          @map("config_extra")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  societa       Societa        @relation(fields: [societaId], references: [id])

  @@unique([societaId, tipo, provider])
  @@index([societaId, tipo])
  @@map("provider_config")
}
```

- [ ] **Step 2: Add AI Pipeline enums and model**

```prisma
// ─── AI Pipeline ──────────────────────────────────────────────────────────────

enum AiSuggestionTipo {
  CLASSIFICAZIONE
  ANOMALIA
  RICONCILIAZIONE
  NARRATIVA
}

enum AiSuggestionStato {
  PENDING
  APPROVED
  REJECTED
  AUTO_APPLIED
}

model AiSuggestion {
  id            Int                @id @default(autoincrement())
  societaId     Int                @map("societa_id")
  tipo          AiSuggestionTipo   @map("tipo")
  entityType    String             @map("entity_type") @db.VarChar(50)
  entityId      Int                @map("entity_id")
  suggestion    Json               @map("suggestion")
  confidence    Float              @map("confidence")
  stato         AiSuggestionStato  @default(PENDING) @map("stato")
  motivazione   String?            @map("motivazione") @db.Text
  tokensUsati   Int?               @map("tokens_usati")
  reviewedBy    Int?               @map("reviewed_by")
  reviewedAt    DateTime?          @map("reviewed_at")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  societa       Societa            @relation(fields: [societaId], references: [id])

  @@index([societaId, stato])
  @@index([entityType, entityId])
  @@map("ai_suggestions")
}
```

- [ ] **Step 3: Add Notification enums and models**

```prisma
// ─── Notification System ──────────────────────────────────────────────────────

enum NotificaTipo {
  SCADENZA
  ANOMALIA
  DOCUMENTO
  SYNC
  ADEMPIMENTO
  AI_REVIEW
}

enum NotificaPriorita {
  CRITICA
  ALTA
  MEDIA
  BASSA
}

enum NotificaCanale {
  IN_APP
  EMAIL
  PORTALE
}

enum NotificaStato {
  NON_LETTA
  LETTA
  ARCHIVIATA
}

enum DigestFrequency {
  IMMEDIATO
  GIORNALIERO
  SETTIMANALE
}

model Notifica {
  id                      Int              @id @default(autoincrement())
  societaId               Int              @map("societa_id")
  utenteDestinatarioId    Int?             @map("utente_destinatario_id")
  tipo                    NotificaTipo     @map("tipo")
  priorita                NotificaPriorita @map("priorita")
  titolo                  String           @map("titolo") @db.VarChar(255)
  messaggio               String           @map("messaggio") @db.Text
  entityType              String?          @map("entity_type") @db.VarChar(50)
  entityId                Int?             @map("entity_id")
  canale                  NotificaCanale   @map("canale")
  stato                   NotificaStato    @default(NON_LETTA) @map("stato")
  scheduledAt             DateTime?        @map("scheduled_at")
  sentAt                  DateTime?        @map("sent_at")
  createdAt               DateTime         @default(now()) @map("created_at")
  updatedAt               DateTime         @updatedAt @map("updated_at")

  societa                 Societa          @relation(fields: [societaId], references: [id])
  utenteDestinatario      Utente?          @relation("NotificheUtente", fields: [utenteDestinatarioId], references: [id])

  @@index([societaId, stato])
  @@index([utenteDestinatarioId, stato])
  @@index([scheduledAt])
  @@map("notifiche")
}

model PreferenzaNotifica {
  id              Int              @id @default(autoincrement())
  utenteId        Int              @map("utente_id")
  tipoEvento      String           @map("tipo_evento") @db.VarChar(50)
  canale          String           @map("canale") @db.VarChar(20)
  abilitato       Boolean          @default(true) @map("abilitato")
  digestFrequency DigestFrequency  @default(IMMEDIATO) @map("digest_frequency")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  utente          Utente           @relation(fields: [utenteId], references: [id])

  @@unique([utenteId, tipoEvento, canale])
  @@map("preferenze_notifica")
}
```

**Note:** `Notifica` does NOT include `clienteDestinatarioId` at this stage. The `AccessoCliente` model doesn't exist yet (Sub-project 4). The field will be added when Sub-project 4 is implemented. For now, notifications only target `Utente`.

- [ ] **Step 4: Add relation arrays to Societa**

Add inside the `Societa` model, after the existing `scadenzePartitario` relation:

```prisma
  // SP0: Architettura fondazionale
  providerConfigs        ProviderConfig[]
  aiSuggestions          AiSuggestion[]
  notificheAutomazione   Notifica[]
```

- [ ] **Step 5: Add relation arrays to Utente**

Find the `Utente` model and add:

```prisma
  // SP0: Architettura fondazionale
  notificheRicevute      Notifica[]            @relation("NotificheUtente")
  preferenzeNotifica     PreferenzaNotifica[]
```

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name sp0-architettura-fondazionale
```

**Verify:** `npx prisma generate` succeeds. New models visible in Prisma client.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(sp0): add schema for ProviderConfig, AiSuggestion, Notifica, PreferenzaNotifica"
```

---

## Task 2: Provider Types & Interfaces

**Files:**
- Create: `src/lib/providers/types.ts`
- Test: `src/lib/__tests__/providers-manager.test.ts` (types only, tested via manager)

- [ ] **Step 1: Write provider types**

Create `src/lib/providers/types.ts`:

```typescript
import type { ProviderTipo, ProviderNome, ProviderStato } from "@prisma/client";

// ─── Fatture Provider ─────────────────────────────────────────────────────────

export type FatturaImportata = {
  identificativoSdi?: string;
  nomeFile?: string;
  tipoDocumento: string;        // TD01, TD04, TD05, TD16-TD28
  cedente: {
    denominazione: string;
    partitaIva?: string;
    codiceFiscale?: string;
    nazione: string;
  };
  dataFattura: Date;
  numeroFattura: string;
  importoTotale: number;
  imponibile: number;
  iva: number;
  aliquotaIva: number;
  righe: FatturaRiga[];
  scadenzePagamento: ScadenzaPagamento[];
  xmlOriginale?: string;
};

export type FatturaRiga = {
  descrizione: string;
  quantita?: number;
  prezzoUnitario?: number;
  importo: number;
  aliquotaIva: number;
  natura?: string;
};

export type ScadenzaPagamento = {
  data: Date;
  importo: number;
  modalita?: string;
};

export type StatoInvio = {
  stato: "INVIATA" | "CONSEGNATA" | "SCARTATA" | "ERRORE";
  identificativoSdi?: string;
  errore?: string;
};

export type StatoFattura = {
  stato: "INVIATA" | "CONSEGNATA" | "ACCETTATA" | "RIFIUTATA" | "SCARTATA" | "DECORRENZA_TERMINI";
  dataAggiornamento: Date;
  errore?: string;
};

export interface FattureProvider {
  importaFatturePassive(files?: File[]): Promise<FatturaImportata[]>;
  inviaFatturaAttiva?(fatturaId: number): Promise<StatoInvio>;
  getStatoFattura?(identificativoSdi: string): Promise<StatoFattura>;
  sync?(): Promise<SyncResult>;
}

// ─── Banca Provider ───────────────────────────────────────────────────────────

export type MovimentoBancarioImportato = {
  data: Date;
  dataValuta?: Date;
  importo: number;
  descrizione: string;
  causale?: string;
  riferimento?: string;
};

export type SaldoBancario = {
  iban: string;
  saldo: number;
  dataAggiornamento: Date;
};

export type ContoBancario = {
  iban: string;
  denominazione: string;
  banca: string;
};

export interface BancaProvider {
  getMovimenti(from: Date, to: Date): Promise<MovimentoBancarioImportato[]>;
  getSaldo?(iban: string): Promise<SaldoBancario>;
  getConti?(): Promise<ContoBancario[]>;
  sync?(): Promise<SyncResult>;
}

// ─── Common ───────────────────────────────────────────────────────────────────

export type SyncResult = {
  success: boolean;
  importati: number;
  errori: number;
  dettagli?: string;
};

export type ProviderConfigData = {
  societaId: number;
  tipo: ProviderTipo;
  provider: ProviderNome;
  credenziali?: Record<string, unknown>;
  configExtra?: Record<string, unknown>;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/providers/
git commit -m "feat(sp0): add provider type definitions and interfaces"
```

---

## Task 3: Provider Manager

**Files:**
- Create: `src/lib/providers/manager.ts`
- Test: `src/lib/__tests__/providers-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/providers-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProviderManager } from "../providers/manager";
import type { FattureProvider, BancaProvider } from "../providers/types";

// Mock prisma
vi.mock("../prisma", () => ({
  prisma: {
    providerConfig: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

describe("ProviderManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFattureProvider", () => {
    it("returns FileXML adapter when provider is FILE", async () => {
      vi.mocked(prisma.providerConfig.findFirst).mockResolvedValue({
        id: 1,
        societaId: 1,
        tipo: "FATTURE",
        provider: "FILE",
        stato: "ATTIVO",
        credenziali: null,
        configExtra: null,
        ultimoSync: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeDefined();
    });

    it("returns null when no provider is configured", async () => {
      vi.mocked(prisma.providerConfig.findFirst).mockResolvedValue(null);

      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeNull();
    });

    it("returns null when provider is in ERRORE state", async () => {
      vi.mocked(prisma.providerConfig.findFirst).mockResolvedValue({
        id: 1,
        societaId: 1,
        tipo: "FATTURE",
        provider: "FILE",
        stato: "ERRORE",
        credenziali: null,
        configExtra: null,
        ultimoSync: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const manager = new ProviderManager(1);
      const provider = await manager.getFattureProvider();
      expect(provider).toBeNull();
    });
  });

  describe("getBancaProvider", () => {
    it("returns FileCSV adapter when provider is FILE", async () => {
      vi.mocked(prisma.providerConfig.findFirst).mockResolvedValue({
        id: 1,
        societaId: 1,
        tipo: "BANCA",
        provider: "FILE",
        stato: "ATTIVO",
        credenziali: null,
        configExtra: null,
        ultimoSync: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const manager = new ProviderManager(1);
      const provider = await manager.getBancaProvider();
      expect(provider).toBeDefined();
    });
  });

  describe("getActiveProviders", () => {
    it("returns all active providers for a società", async () => {
      vi.mocked(prisma.providerConfig.findMany).mockResolvedValue([
        {
          id: 1, societaId: 1, tipo: "FATTURE", provider: "FILE",
          stato: "ATTIVO", credenziali: null, configExtra: null,
          ultimoSync: null, createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: 2, societaId: 1, tipo: "BANCA", provider: "FILE",
          stato: "ATTIVO", credenziali: null, configExtra: null,
          ultimoSync: null, createdAt: new Date(), updatedAt: new Date(),
        },
      ]);

      const manager = new ProviderManager(1);
      const providers = await manager.getActiveProviders();
      expect(providers).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/providers-manager.test.ts
```

Expected: FAIL — `ProviderManager` not found.

- [ ] **Step 3: Write ProviderManager**

Create `src/lib/providers/manager.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { ProviderConfig, ProviderTipo } from "@prisma/client";
import type { FattureProvider, BancaProvider } from "./types";
import { FattureFileAdapter } from "./adapters/fatture-file";
import { BancaFileAdapter } from "./adapters/banca-file";

export class ProviderManager {
  constructor(private societaId: number) {}

  async getFattureProvider(): Promise<FattureProvider | null> {
    const config = await this.findActiveConfig("FATTURE");
    if (!config) return null;
    return this.createFattureAdapter(config);
  }

  async getBancaProvider(): Promise<BancaProvider | null> {
    const config = await this.findActiveConfig("BANCA");
    if (!config) return null;
    return this.createBancaAdapter(config);
  }

  async getActiveProviders(): Promise<ProviderConfig[]> {
    return prisma.providerConfig.findMany({
      where: { societaId: this.societaId, stato: "ATTIVO" },
    });
  }

  private async findActiveConfig(tipo: ProviderTipo): Promise<ProviderConfig | null> {
    return prisma.providerConfig.findFirst({
      where: { societaId: this.societaId, tipo, stato: "ATTIVO" },
    });
  }

  private createFattureAdapter(config: ProviderConfig): FattureProvider {
    switch (config.provider) {
      case "FILE":
        return new FattureFileAdapter(config);
      case "ARUBA":
      case "INFOCERT":
        throw new Error(`Provider ${config.provider} non ancora implementato`);
      default:
        throw new Error(`Provider fatture sconosciuto: ${config.provider}`);
    }
  }

  private createBancaAdapter(config: ProviderConfig): BancaProvider {
    switch (config.provider) {
      case "FILE":
        return new BancaFileAdapter(config);
      case "FABRICK":
      case "NORDIGEN":
        throw new Error(`Provider ${config.provider} non ancora implementato`);
      default:
        throw new Error(`Provider banca sconosciuto: ${config.provider}`);
    }
  }
}
```

- [ ] **Step 4: Create stub adapters so imports resolve**

Create `src/lib/providers/adapters/fatture-file.ts`:

```typescript
import type { ProviderConfig } from "@prisma/client";
import type { FattureProvider, FatturaImportata, SyncResult } from "../types";

export class FattureFileAdapter implements FattureProvider {
  constructor(private config: ProviderConfig) {}

  async importaFatturePassive(_files?: File[]): Promise<FatturaImportata[]> {
    // Implementation in Task 4
    return [];
  }
}
```

Create `src/lib/providers/adapters/banca-file.ts`:

```typescript
import type { ProviderConfig } from "@prisma/client";
import type { BancaProvider, MovimentoBancarioImportato } from "../types";

export class BancaFileAdapter implements BancaProvider {
  constructor(private config: ProviderConfig) {}

  async getMovimenti(_from: Date, _to: Date): Promise<MovimentoBancarioImportato[]> {
    // Implementation in Task 5
    return [];
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/providers-manager.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/ src/lib/__tests__/providers-manager.test.ts
git commit -m "feat(sp0): add ProviderManager with adapter factory pattern"
```

---

## Task 4: FattureFile Adapter (XML Parser)

**Files:**
- Modify: `src/lib/providers/adapters/fatture-file.ts`
- Test: `src/lib/__tests__/providers-fatture-file.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/providers-fatture-file.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseFatturaXml } from "../providers/adapters/fatture-file";

const SAMPLE_FATTURA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>01234567890</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Rossi SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Data>2026-03-15</Data>
        <Numero>FT-001/2026</Numero>
        <ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Consulenza informatica</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>1000.00</PrezzoUnitario>
        <PrezzoTotale>1000.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1000.00</ImponibileImporto>
        <Imposta>220.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <DettaglioPagamento>
        <DataScadenzaPagamento>2026-04-15</DataScadenzaPagamento>
        <ImportoPagamento>1220.00</ImportoPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

describe("parseFatturaXml", () => {
  it("extracts cedente data from XML", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.cedente.denominazione).toBe("Rossi SRL");
    expect(result.cedente.partitaIva).toBe("01234567890");
    expect(result.cedente.nazione).toBe("IT");
  });

  it("extracts document data", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.tipoDocumento).toBe("TD01");
    expect(result.numeroFattura).toBe("FT-001/2026");
    expect(result.importoTotale).toBe(1220);
    expect(result.imponibile).toBe(1000);
    expect(result.iva).toBe(220);
    expect(result.aliquotaIva).toBe(22);
  });

  it("extracts line items", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.righe).toHaveLength(1);
    expect(result.righe[0].descrizione).toBe("Consulenza informatica");
    expect(result.righe[0].importo).toBe(1000);
    expect(result.righe[0].aliquotaIva).toBe(22);
  });

  it("extracts payment terms", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.scadenzePagamento).toHaveLength(1);
    expect(result.scadenzePagamento[0].importo).toBe(1220);
  });

  it("returns date as Date object", () => {
    const result = parseFatturaXml(SAMPLE_FATTURA_XML);
    expect(result.dataFattura).toBeInstanceOf(Date);
    expect(result.dataFattura.getFullYear()).toBe(2026);
    expect(result.dataFattura.getMonth()).toBe(2); // March = 2
    expect(result.dataFattura.getDate()).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/providers-fatture-file.test.ts
```

Expected: FAIL — `parseFatturaXml` not found.

- [ ] **Step 3: Implement XML parser**

Replace `src/lib/providers/adapters/fatture-file.ts`:

```typescript
import { XMLParser } from "fast-xml-parser";
import type { ProviderConfig } from "@prisma/client";
import type {
  FattureProvider,
  FatturaImportata,
  FatturaRiga,
  ScadenzaPagamento,
} from "../types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  isArray: (name) => {
    return ["DettaglioLinee", "DatiRiepilogo", "DettaglioPagamento", "FatturaElettronicaBody"].includes(name);
  },
});

export function parseFatturaXml(xml: string): FatturaImportata {
  const parsed = xmlParser.parse(xml);
  const fe = parsed.FatturaElettronica;
  const header = fe.FatturaElettronicaHeader;
  const body = Array.isArray(fe.FatturaElettronicaBody)
    ? fe.FatturaElettronicaBody[0]
    : fe.FatturaElettronicaBody;

  const cedente = header.CedentePrestatore;
  const datiAnag = cedente.DatiAnagrafici;
  const datiGen = body.DatiGenerali.DatiGeneraliDocumento;
  const beniServizi = body.DatiBeniServizi;
  const datiPagamento = body.DatiPagamento;

  // Extract line items
  const dettaglioLinee = Array.isArray(beniServizi.DettaglioLinee)
    ? beniServizi.DettaglioLinee
    : [beniServizi.DettaglioLinee];

  const righe: FatturaRiga[] = dettaglioLinee.map((linea: Record<string, unknown>) => ({
    descrizione: String(linea.Descrizione ?? ""),
    quantita: linea.Quantita ? Number(linea.Quantita) : undefined,
    prezzoUnitario: linea.PrezzoUnitario ? Number(linea.PrezzoUnitario) : undefined,
    importo: Number(linea.PrezzoTotale ?? 0),
    aliquotaIva: Number(linea.AliquotaIVA ?? 0),
    natura: linea.Natura ? String(linea.Natura) : undefined,
  }));

  // Extract VAT summary
  const riepilogo = Array.isArray(beniServizi.DatiRiepilogo)
    ? beniServizi.DatiRiepilogo
    : [beniServizi.DatiRiepilogo];

  const imponibile = riepilogo.reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.ImponibileImporto ?? 0),
    0
  );
  const iva = riepilogo.reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r.Imposta ?? 0),
    0
  );
  const aliquotaPrincipale = Number(riepilogo[0]?.AliquotaIVA ?? 0);

  // Extract payment terms
  const scadenzePagamento: ScadenzaPagamento[] = [];
  if (datiPagamento) {
    const dettagliPagamento = Array.isArray(datiPagamento.DettaglioPagamento)
      ? datiPagamento.DettaglioPagamento
      : datiPagamento.DettaglioPagamento
        ? [datiPagamento.DettaglioPagamento]
        : [];

    for (const dp of dettagliPagamento) {
      scadenzePagamento.push({
        data: new Date(String(dp.DataScadenzaPagamento)),
        importo: Number(dp.ImportoPagamento ?? 0),
        modalita: dp.ModalitaPagamento ? String(dp.ModalitaPagamento) : undefined,
      });
    }
  }

  return {
    tipoDocumento: String(datiGen.TipoDocumento),
    cedente: {
      denominazione: String(datiAnag.Anagrafica?.Denominazione ?? ""),
      partitaIva: datiAnag.IdFiscaleIVA?.IdCodice
        ? String(datiAnag.IdFiscaleIVA.IdCodice)
        : undefined,
      codiceFiscale: datiAnag.CodiceFiscale
        ? String(datiAnag.CodiceFiscale)
        : undefined,
      nazione: datiAnag.IdFiscaleIVA?.IdPaese
        ? String(datiAnag.IdFiscaleIVA.IdPaese)
        : "IT",
    },
    dataFattura: new Date(String(datiGen.Data)),
    numeroFattura: String(datiGen.Numero),
    importoTotale: datiGen.ImportoTotaleDocumento
      ? Number(datiGen.ImportoTotaleDocumento)
      : imponibile + iva,
    imponibile,
    iva,
    aliquotaIva: aliquotaPrincipale,
    righe,
    scadenzePagamento,
    xmlOriginale: xml,
  };
}

export class FattureFileAdapter implements FattureProvider {
  constructor(private config: ProviderConfig) {}

  async importaFatturePassive(files?: File[]): Promise<FatturaImportata[]> {
    if (!files || files.length === 0) return [];

    const results: FatturaImportata[] = [];

    for (const file of files) {
      const text = await file.text();

      if (file.name.endsWith(".xml")) {
        results.push(parseFatturaXml(text));
      }
      // ZIP handling will be added in Sub-project 1
    }

    return results;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/providers-fatture-file.test.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/adapters/fatture-file.ts src/lib/__tests__/providers-fatture-file.test.ts
git commit -m "feat(sp0): implement FatturaPA XML parser for file adapter"
```

---

## Task 5: BancaFile Adapter (CSV Parser)

**Files:**
- Modify: `src/lib/providers/adapters/banca-file.ts`
- Test: `src/lib/__tests__/providers-banca-file.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/providers-banca-file.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseBancaCsv } from "../providers/adapters/banca-file";

describe("parseBancaCsv", () => {
  it("parses standard Italian bank CSV (semicolon separator)", () => {
    const csv = `Data;Data Valuta;Descrizione;Importo;Causale
15/03/2026;15/03/2026;BONIFICO A ROSSI SRL FT 001;-1220.00;48
16/03/2026;16/03/2026;ACCREDITO STIPENDIO;2500.00;27`;

    const result = parseBancaCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].importo).toBe(-1220);
    expect(result[0].descrizione).toBe("BONIFICO A ROSSI SRL FT 001");
    expect(result[1].importo).toBe(2500);
  });

  it("handles comma separator", () => {
    const csv = `Data,Descrizione,Importo
15/03/2026,PAGAMENTO FATTURA,-500.00`;

    const result = parseBancaCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].importo).toBe(-500);
  });

  it("handles amounts with comma as decimal separator", () => {
    const csv = `Data;Descrizione;Importo
15/03/2026;PAGAMENTO;-1.220,50`;

    const result = parseBancaCsv(csv);
    expect(result[0].importo).toBe(-1220.5);
  });

  it("parses dates in DD/MM/YYYY format", () => {
    const csv = `Data;Descrizione;Importo
25/12/2026;NATALIZIO;100.00`;

    const result = parseBancaCsv(csv);
    expect(result[0].data.getFullYear()).toBe(2026);
    expect(result[0].data.getMonth()).toBe(11); // December
    expect(result[0].data.getDate()).toBe(25);
  });

  it("returns empty array for empty input", () => {
    expect(parseBancaCsv("")).toEqual([]);
    expect(parseBancaCsv("Data;Descrizione;Importo")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/providers-banca-file.test.ts
```

Expected: FAIL — `parseBancaCsv` not found.

- [ ] **Step 3: Implement CSV parser**

Replace `src/lib/providers/adapters/banca-file.ts`:

```typescript
import type { ProviderConfig } from "@prisma/client";
import type { BancaProvider, MovimentoBancarioImportato } from "../types";

function detectSeparator(firstLine: string): string {
  if (firstLine.includes(";")) return ";";
  if (firstLine.includes("\t")) return "\t";
  return ",";
}

function parseItalianDate(dateStr: string): Date {
  // DD/MM/YYYY or YYYY-MM-DD
  const trimmed = dateStr.trim();
  if (trimmed.includes("/")) {
    const [day, month, year] = trimmed.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(trimmed);
}

function parseItalianAmount(amountStr: string): number {
  let cleaned = amountStr.trim();
  // Handle "1.220,50" format (dot as thousands, comma as decimal)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Handle "1220,50" format (comma as decimal only)
    cleaned = cleaned.replace(",", ".");
  }
  return Number(cleaned);
}

function findColumn(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase().includes(candidate.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseBancaCsv(csvContent: string): MovimentoBancarioImportato[] {
  const lines = csvContent.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator).map((h) => h.trim());

  const colData = findColumn(headers, "data", "date");
  const colDataValuta = findColumn(headers, "valuta", "data valuta");
  const colDescrizione = findColumn(headers, "descrizione", "description", "causale");
  const colImporto = findColumn(headers, "importo", "amount", "dare/avere");
  const colCausale = findColumn(headers, "causale", "codice causale", "cod");

  if (colData === -1 || colImporto === -1) return [];

  const results: MovimentoBancarioImportato[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim());
    if (cols.length < 2) continue;

    const dataStr = cols[colData];
    if (!dataStr) continue;

    results.push({
      data: parseItalianDate(dataStr),
      dataValuta: colDataValuta !== -1 && cols[colDataValuta]
        ? parseItalianDate(cols[colDataValuta])
        : undefined,
      importo: parseItalianAmount(cols[colImporto]),
      descrizione: colDescrizione !== -1 ? (cols[colDescrizione] ?? "") : "",
      causale: colCausale !== -1 && colCausale !== colDescrizione
        ? cols[colCausale]
        : undefined,
    });
  }

  return results;
}

export class BancaFileAdapter implements BancaProvider {
  constructor(private config: ProviderConfig) {}

  async getMovimenti(_from: Date, _to: Date): Promise<MovimentoBancarioImportato[]> {
    // File-based provider doesn't support date filtering — returns all parsed rows.
    // Filtering is done at the caller level after upload.
    return [];
  }

  parseFile(csvContent: string): MovimentoBancarioImportato[] {
    return parseBancaCsv(csvContent);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/providers-banca-file.test.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/adapters/banca-file.ts src/lib/__tests__/providers-banca-file.test.ts
git commit -m "feat(sp0): implement bank CSV parser for file adapter"
```

---

## Task 6: AI Pipeline Core

**Files:**
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/ai/pipeline.ts`
- Create: `src/lib/ai/cost-tracker.ts`
- Test: `src/lib/__tests__/ai-pipeline.test.ts`
- Test: `src/lib/__tests__/ai-cost-tracker.test.ts`

- [ ] **Step 1: Create AI types**

Create `src/lib/ai/types.ts`:

```typescript
import type { AiSuggestionTipo } from "@prisma/client";

export type AiClassificationInput = {
  societaId: number;
  entityType: string;
  entityId: number;
  tipo: AiSuggestionTipo;
  context: Record<string, unknown>;  // Data to send to Claude
};

export type AiClassificationResult = {
  suggestion: Record<string, unknown>;
  confidence: number;
  motivazione: string;
  tokensUsati: number;
};

export type PipelineDecision =
  | { action: "DETERMINISTIC"; result: Record<string, unknown> }
  | { action: "AUTO_APPLIED"; result: Record<string, unknown>; aiSuggestionId: number }
  | { action: "PENDING_REVIEW"; aiSuggestionId: number };

export type DeterministicRule<T> = {
  name: string;
  matches: (input: T) => boolean;
  apply: (input: T) => Record<string, unknown>;
};

export const AI_CONFIDENCE_THRESHOLD = 0.9;
```

- [ ] **Step 2: Write failing tests for pipeline**

Create `src/lib/__tests__/ai-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiPipeline } from "../ai/pipeline";
import type { DeterministicRule } from "../ai/types";

// Mock prisma
vi.mock("../prisma", () => ({
  prisma: {
    aiSuggestion: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

type TestInput = { fornitore: string; importo: number };

describe("AiPipeline", () => {
  const rules: DeterministicRule<TestInput>[] = [
    {
      name: "fornitore-noto-telecom",
      matches: (input) => input.fornitore.toLowerCase().includes("telecom"),
      apply: (input) => ({ categoriaId: 5, conto: "Telefonia" }),
    },
  ];

  const mockClassifier = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DETERMINISTIC when a rule matches", async () => {
    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Telecom Italia", importo: 200 },
      { societaId: 1, entityType: "Operazione", entityId: 1, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("DETERMINISTIC");
    expect(result.result).toEqual({ categoriaId: 5, conto: "Telefonia" });
    expect(mockClassifier).not.toHaveBeenCalled();
  });

  it("calls AI classifier when no rule matches", async () => {
    mockClassifier.mockResolvedValue({
      suggestion: { categoriaId: 10 },
      confidence: 0.95,
      motivazione: "Sembra un costo consulenza",
      tokensUsati: 150,
    });

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Bianchi Consulting", importo: 3000 },
      { societaId: 1, entityType: "Operazione", entityId: 2, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("AUTO_APPLIED");
    expect(mockClassifier).toHaveBeenCalled();
  });

  it("returns PENDING_REVIEW when AI confidence is below threshold", async () => {
    mockClassifier.mockResolvedValue({
      suggestion: { categoriaId: 10 },
      confidence: 0.6,
      motivazione: "Non sono sicuro",
      tokensUsati: 200,
    });

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Unknown Corp", importo: 5000 },
      { societaId: 1, entityType: "Operazione", entityId: 3, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("PENDING_REVIEW");
  });

  it("degrades to PENDING_REVIEW when AI classifier throws", async () => {
    mockClassifier.mockRejectedValue(new Error("API unavailable"));

    const pipeline = new AiPipeline(rules, mockClassifier);
    const result = await pipeline.process(
      { fornitore: "Unknown Corp", importo: 5000 },
      { societaId: 1, entityType: "Operazione", entityId: 4, tipo: "CLASSIFICAZIONE" }
    );

    expect(result.action).toBe("PENDING_REVIEW");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/ai-pipeline.test.ts
```

Expected: FAIL — `AiPipeline` not found.

- [ ] **Step 4: Implement pipeline**

Create `src/lib/ai/pipeline.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { AiSuggestionTipo } from "@prisma/client";
import type {
  AiClassificationResult,
  DeterministicRule,
  PipelineDecision,
} from "./types";
import { AI_CONFIDENCE_THRESHOLD } from "./types";

type PipelineContext = {
  societaId: number;
  entityType: string;
  entityId: number;
  tipo: AiSuggestionTipo;
};

type AiClassifier<T> = (input: T, context: PipelineContext) => Promise<AiClassificationResult>;

export class AiPipeline<T> {
  constructor(
    private rules: DeterministicRule<T>[],
    private classifier: AiClassifier<T>,
  ) {}

  async process(input: T, context: PipelineContext): Promise<PipelineDecision> {
    // Step 1: Try deterministic rules
    for (const rule of this.rules) {
      if (rule.matches(input)) {
        return { action: "DETERMINISTIC", result: rule.apply(input) };
      }
    }

    // Step 2: Try AI classification
    try {
      const aiResult = await this.classifier(input, context);

      const suggestion = await prisma.aiSuggestion.create({
        data: {
          societaId: context.societaId,
          tipo: context.tipo,
          entityType: context.entityType,
          entityId: context.entityId,
          suggestion: aiResult.suggestion,
          confidence: aiResult.confidence,
          motivazione: aiResult.motivazione,
          tokensUsati: aiResult.tokensUsati,
          stato: aiResult.confidence >= AI_CONFIDENCE_THRESHOLD
            ? "AUTO_APPLIED"
            : "PENDING",
        },
      });

      if (aiResult.confidence >= AI_CONFIDENCE_THRESHOLD) {
        return {
          action: "AUTO_APPLIED",
          result: aiResult.suggestion,
          aiSuggestionId: suggestion.id,
        };
      }

      return { action: "PENDING_REVIEW", aiSuggestionId: suggestion.id };
    } catch (error) {
      // AI unavailable — degrade gracefully, create pending suggestion
      console.error("AI classifier failed, degrading to manual review:", error);

      const suggestion = await prisma.aiSuggestion.create({
        data: {
          societaId: context.societaId,
          tipo: context.tipo,
          entityType: context.entityType,
          entityId: context.entityId,
          suggestion: {},
          confidence: 0,
          motivazione: "Classificazione AI non disponibile — richiede review manuale",
          stato: "PENDING",
        },
      });

      return { action: "PENDING_REVIEW", aiSuggestionId: suggestion.id };
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/ai-pipeline.test.ts
```

Expected: PASS (all 4 tests)

- [ ] **Step 6: Write cost tracker tests**

Create `src/lib/__tests__/ai-cost-tracker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateAiCost, formatTokenUsage } from "../ai/cost-tracker";

describe("calculateAiCost", () => {
  it("calculates cost for haiku model", () => {
    const cost = calculateAiCost(1000, 500, "haiku");
    // Haiku: $0.25/1M input, $1.25/1M output
    expect(cost).toBeCloseTo(0.000875, 5);
  });

  it("calculates cost for sonnet model", () => {
    const cost = calculateAiCost(1000, 500, "sonnet");
    // Sonnet: $3/1M input, $15/1M output
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateAiCost(0, 0, "haiku")).toBe(0);
  });
});

describe("formatTokenUsage", () => {
  it("formats usage summary", () => {
    const result = formatTokenUsage(15000, 25);
    expect(result.totalTokens).toBe(15000);
    expect(result.totalRequests).toBe(25);
    expect(result.avgTokensPerRequest).toBe(600);
  });
});
```

- [ ] **Step 7: Implement cost tracker**

Create `src/lib/ai/cost-tracker.ts`:

```typescript
type ModelTier = "haiku" | "sonnet" | "opus";

// Pricing per 1M tokens (USD) — update as pricing changes
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3, output: 15 },
  opus: { input: 15, output: 75 },
};

export function calculateAiCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelTier = "haiku",
): number {
  const pricing = PRICING[model];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function formatTokenUsage(
  totalTokens: number,
  totalRequests: number,
): { totalTokens: number; totalRequests: number; avgTokensPerRequest: number } {
  return {
    totalTokens,
    totalRequests,
    avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
  };
}
```

- [ ] **Step 8: Run all AI tests**

```bash
npx vitest run src/lib/__tests__/ai-pipeline.test.ts src/lib/__tests__/ai-cost-tracker.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/ src/lib/__tests__/ai-pipeline.test.ts src/lib/__tests__/ai-cost-tracker.test.ts
git commit -m "feat(sp0): add AI pipeline with deterministic rules, confidence threshold, and graceful degradation"
```

---

## Task 7: AI Classifier (Claude Integration)

**Files:**
- Create: `src/lib/ai/classifier.ts`
- Test: `src/lib/__tests__/ai-classifier.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/ai-classifier.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildClassificationPrompt, parseClassificationResponse } from "../ai/classifier";

describe("buildClassificationPrompt", () => {
  it("builds prompt for fattura classification", () => {
    const prompt = buildClassificationPrompt("CLASSIFICAZIONE", {
      fornitore: "Rossi SRL",
      descrizione: "Consulenza informatica",
      importo: 1000,
      categorie: [
        { id: 1, nome: "Consulenze" },
        { id: 2, nome: "Hardware" },
      ],
    });

    expect(prompt).toContain("Rossi SRL");
    expect(prompt).toContain("Consulenze");
    expect(prompt).toContain("JSON");
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON response", () => {
    const response = `{"categoriaId": 1, "confidence": 0.95, "motivazione": "Consulenza informatica"}`;
    const result = parseClassificationResponse(response);
    expect(result.suggestion).toEqual({ categoriaId: 1 });
    expect(result.confidence).toBe(0.95);
    expect(result.motivazione).toBe("Consulenza informatica");
  });

  it("handles markdown-wrapped JSON", () => {
    const response = "```json\n{\"categoriaId\": 2, \"confidence\": 0.8, \"motivazione\": \"Hardware\"}\n```";
    const result = parseClassificationResponse(response);
    expect(result.suggestion).toEqual({ categoriaId: 2 });
  });

  it("returns low confidence on parse error", () => {
    const result = parseClassificationResponse("not json");
    expect(result.confidence).toBe(0);
    expect(result.motivazione).toContain("parse");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/ai-classifier.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement classifier**

Create `src/lib/ai/classifier.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AiSuggestionTipo } from "@prisma/client";
import type { AiClassificationResult } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un assistente contabile specializzato nella classificazione di documenti fiscali italiani.
Rispondi SEMPRE in formato JSON con questa struttura:
{
  "categoriaId": number | null,
  "contoId": number | null,
  "confidence": number (0.0-1.0),
  "motivazione": "spiegazione breve in italiano"
}

Non includere altro testo. Solo JSON.`;

export function buildClassificationPrompt(
  tipo: AiSuggestionTipo,
  context: Record<string, unknown>,
): string {
  const parts: string[] = [];

  if (tipo === "CLASSIFICAZIONE") {
    parts.push("Classifica questa operazione contabile:");
    if (context.fornitore) parts.push(`Fornitore: ${context.fornitore}`);
    if (context.descrizione) parts.push(`Descrizione: ${context.descrizione}`);
    if (context.importo) parts.push(`Importo: €${context.importo}`);

    if (Array.isArray(context.categorie) && context.categorie.length > 0) {
      parts.push("\nCategorie disponibili:");
      for (const cat of context.categorie as { id: number; nome: string }[]) {
        parts.push(`- ID ${cat.id}: ${cat.nome}`);
      }
    }

    parts.push("\nRispondi in formato JSON.");
  } else if (tipo === "RICONCILIAZIONE") {
    parts.push("Analizza questo movimento bancario e suggerisci un match:");
    if (context.descrizione) parts.push(`Causale bancaria: ${context.descrizione}`);
    if (context.importo) parts.push(`Importo: €${context.importo}`);
    parts.push("\nRispondi in formato JSON.");
  } else if (tipo === "ANOMALIA") {
    parts.push("Analizza questa operazione e identifica eventuali anomalie:");
    parts.push(JSON.stringify(context, null, 2));
    parts.push("\nRispondi in formato JSON.");
  }

  return parts.join("\n");
}

export function parseClassificationResponse(text: string): AiClassificationResult {
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    const { confidence, motivazione, ...suggestion } = parsed;

    return {
      suggestion,
      confidence: typeof confidence === "number" ? confidence : 0.5,
      motivazione: typeof motivazione === "string" ? motivazione : "",
      tokensUsati: 0, // Set by caller from API response
    };
  } catch {
    return {
      suggestion: {},
      confidence: 0,
      motivazione: "Errore nel parse della risposta AI",
      tokensUsati: 0,
    };
  }
}

export async function classifyWithClaude(
  tipo: AiSuggestionTipo,
  context: Record<string, unknown>,
): Promise<AiClassificationResult> {
  const prompt = buildClassificationPrompt(tipo, context);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

  const result = parseClassificationResponse(text);
  result.tokensUsati = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/ai-classifier.test.ts
```

Expected: PASS (all 5 tests — only unit tests for prompt building and response parsing, no API calls)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/classifier.ts src/lib/__tests__/ai-classifier.test.ts
git commit -m "feat(sp0): add Claude classifier with prompt builder and response parser"
```

---

## Task 8: Notification Engine

**Files:**
- Create: `src/lib/notifiche/types.ts`
- Create: `src/lib/notifiche/engine.ts`
- Create: `src/lib/notifiche/channels/in-app.ts`
- Create: `src/lib/notifiche/channels/email.ts`
- Test: `src/lib/__tests__/notifiche-engine.test.ts`

- [ ] **Step 1: Create notification types**

Create `src/lib/notifiche/types.ts`:

```typescript
import type { NotificaTipo, NotificaPriorita, NotificaCanale } from "@prisma/client";

export type CreateNotificaInput = {
  societaId: number;
  utenteDestinatarioId: number;
  tipo: NotificaTipo;
  priorita: NotificaPriorita;
  titolo: string;
  messaggio: string;
  entityType?: string;
  entityId?: number;
  canale?: NotificaCanale;     // defaults based on priorita if not specified
  scheduledAt?: Date;
};

export type NotificaWithChannel = CreateNotificaInput & {
  canale: NotificaCanale;
};

// Priority → default channel mapping
export const PRIORITY_CHANNEL_MAP: Record<NotificaPriorita, NotificaCanale> = {
  CRITICA: "EMAIL",      // immediate email + in-app
  ALTA: "IN_APP",        // in-app immediate, email via digest
  MEDIA: "IN_APP",       // in-app badge, email via weekly digest
  BASSA: "IN_APP",       // in-app badge only
};
```

- [ ] **Step 2: Write failing tests**

Create `src/lib/__tests__/notifiche-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationEngine } from "../notifiche/engine";

vi.mock("../prisma", () => ({
  prisma: {
    notifica: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    preferenzaNotifica: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("../notifiche/channels/email", () => ({
  sendNotificaEmail: vi.fn().mockResolvedValue(true),
}));

import { prisma } from "../prisma";
import { sendNotificaEmail } from "../notifiche/channels/email";

describe("NotificationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("send", () => {
    it("creates notification in database", async () => {
      const engine = new NotificationEngine();
      await engine.send({
        societaId: 1,
        utenteDestinatarioId: 1,
        tipo: "SCADENZA",
        priorita: "ALTA",
        titolo: "F24 in scadenza",
        messaggio: "F24 IVA scade tra 3 giorni",
      });

      expect(prisma.notifica.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societaId: 1,
          tipo: "SCADENZA",
          priorita: "ALTA",
          titolo: "F24 in scadenza",
          canale: "IN_APP",
        }),
      });
    });

    it("sends email immediately for CRITICA priority", async () => {
      const engine = new NotificationEngine();
      await engine.send({
        societaId: 1,
        utenteDestinatarioId: 1,
        tipo: "ANOMALIA",
        priorita: "CRITICA",
        titolo: "Fattura scartata",
        messaggio: "La fattura FT-001 è stata scartata da SDI",
      });

      expect(sendNotificaEmail).toHaveBeenCalled();
    });

    it("does NOT send email for BASSA priority", async () => {
      const engine = new NotificationEngine();
      await engine.send({
        societaId: 1,
        utenteDestinatarioId: 1,
        tipo: "SYNC",
        priorita: "BASSA",
        titolo: "Sync completato",
        messaggio: "Import movimenti bancari completato",
      });

      expect(sendNotificaEmail).not.toHaveBeenCalled();
    });

    it("respects user preference to disable channel", async () => {
      vi.mocked(prisma.preferenzaNotifica.findFirst).mockResolvedValue({
        id: 1,
        utenteId: 1,
        tipoEvento: "ANOMALIA",
        canale: "EMAIL",
        abilitato: false,
        digestFrequency: "IMMEDIATO",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const engine = new NotificationEngine();
      await engine.send({
        societaId: 1,
        utenteDestinatarioId: 1,
        tipo: "ANOMALIA",
        priorita: "CRITICA",
        titolo: "Test",
        messaggio: "Test",
      });

      // Still creates in-app, but skips email
      expect(prisma.notifica.create).toHaveBeenCalled();
      expect(sendNotificaEmail).not.toHaveBeenCalled();
    });
  });

  describe("markAsRead", () => {
    it("updates notification status", async () => {
      const engine = new NotificationEngine();
      await engine.markAsRead(1, 1);

      expect(prisma.notifica.updateMany).toHaveBeenCalledWith({
        where: { id: 1, utenteDestinatarioId: 1 },
        data: { stato: "LETTA" },
      });
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/notifiche-engine.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement email channel stub**

Create `src/lib/notifiche/channels/email.ts`:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNotificaEmail(
  to: string,
  titolo: string,
  messaggio: string,
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Prima Nota <noreply@primanota.app>",
      to,
      subject: titolo,
      text: messaggio,
    });
    return true;
  } catch (error) {
    console.error("Failed to send notification email:", error);
    return false;
  }
}
```

Create `src/lib/notifiche/channels/in-app.ts`:

```typescript
// In-app notifications are handled by database records (Notifica model).
// This module provides helpers for querying/filtering.

import { prisma } from "@/lib/prisma";
import type { NotificaStato } from "@prisma/client";

export async function getUnreadCount(utenteId: number): Promise<number> {
  return prisma.notifica.count({
    where: { utenteDestinatarioId: utenteId, stato: "NON_LETTA" },
  });
}

export async function getNotifiche(
  utenteId: number,
  stato?: NotificaStato,
  limit = 20,
) {
  return prisma.notifica.findMany({
    where: {
      utenteDestinatarioId: utenteId,
      ...(stato ? { stato } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
```

- [ ] **Step 5: Implement notification engine**

Create `src/lib/notifiche/engine.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { CreateNotificaInput } from "./types";
import { PRIORITY_CHANNEL_MAP } from "./types";
import { sendNotificaEmail } from "./channels/email";

export class NotificationEngine {
  async send(input: CreateNotificaInput): Promise<void> {
    const canale = input.canale ?? PRIORITY_CHANNEL_MAP[input.priorita];

    // Create in-app notification
    const notifica = await prisma.notifica.create({
      data: {
        societaId: input.societaId,
        utenteDestinatarioId: input.utenteDestinatarioId,
        tipo: input.tipo,
        priorita: input.priorita,
        titolo: input.titolo,
        messaggio: input.messaggio,
        entityType: input.entityType,
        entityId: input.entityId,
        canale,
        scheduledAt: input.scheduledAt,
      },
    });

    // Send email for CRITICA priority (immediate)
    if (input.priorita === "CRITICA") {
      const shouldEmail = await this.checkEmailPreference(
        input.utenteDestinatarioId,
        input.tipo,
      );
      if (shouldEmail) {
        // Fetch user email
        const utente = await prisma.utente.findUnique({
          where: { id: input.utenteDestinatarioId },
          select: { email: true },
        });
        if (utente?.email) {
          await sendNotificaEmail(utente.email, input.titolo, input.messaggio);
          await prisma.notifica.updateMany({
            where: { id: notifica.id },
            data: { sentAt: new Date() },
          });
        }
      }
    }
  }

  async markAsRead(notificaId: number, utenteId: number): Promise<void> {
    await prisma.notifica.updateMany({
      where: { id: notificaId, utenteDestinatarioId: utenteId },
      data: { stato: "LETTA" },
    });
  }

  async markAllAsRead(utenteId: number, societaId: number): Promise<void> {
    await prisma.notifica.updateMany({
      where: {
        utenteDestinatarioId: utenteId,
        societaId,
        stato: "NON_LETTA",
      },
      data: { stato: "LETTA" },
    });
  }

  private async checkEmailPreference(
    utenteId: number,
    tipo: string,
  ): Promise<boolean> {
    const pref = await prisma.preferenzaNotifica.findFirst({
      where: {
        utenteId,
        tipoEvento: tipo,
        canale: "EMAIL",
      },
    });

    // Default: email enabled if no preference exists
    if (!pref) return true;
    return pref.abilitato;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/notifiche-engine.test.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifiche/ src/lib/__tests__/notifiche-engine.test.ts
git commit -m "feat(sp0): add notification engine with in-app and email channels"
```

---

## Task 9: Digest Aggregator

**Files:**
- Create: `src/lib/notifiche/digest.ts`
- Test: `src/lib/__tests__/notifiche-digest.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/notifiche-digest.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDigestHtml, groupNotificheByPriorita } from "../notifiche/digest";
import type { NotificaPriorita, NotificaTipo, NotificaCanale, NotificaStato } from "@prisma/client";

const makeNotifica = (
  titolo: string,
  priorita: NotificaPriorita,
  tipo: NotificaTipo = "SCADENZA",
) => ({
  id: 1,
  societaId: 1,
  utenteDestinatarioId: 1,
  tipo,
  priorita,
  titolo,
  messaggio: `Dettaglio: ${titolo}`,
  entityType: null,
  entityId: null,
  canale: "IN_APP" as NotificaCanale,
  stato: "NON_LETTA" as NotificaStato,
  scheduledAt: null,
  sentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("groupNotificheByPriorita", () => {
  it("groups notifications by priority", () => {
    const notifiche = [
      makeNotifica("F24 scaduto", "CRITICA"),
      makeNotifica("Anomalia IVA", "ALTA"),
      makeNotifica("Sync completato", "BASSA"),
      makeNotifica("Altra anomalia", "ALTA"),
    ];

    const grouped = groupNotificheByPriorita(notifiche);
    expect(grouped.CRITICA).toHaveLength(1);
    expect(grouped.ALTA).toHaveLength(2);
    expect(grouped.MEDIA).toHaveLength(0);
    expect(grouped.BASSA).toHaveLength(1);
  });
});

describe("buildDigestHtml", () => {
  it("builds HTML digest with notifications", () => {
    const notifiche = [
      makeNotifica("F24 scaduto", "CRITICA"),
      makeNotifica("Anomalia IVA", "ALTA"),
    ];

    const html = buildDigestHtml(notifiche, "giornaliero");
    expect(html).toContain("F24 scaduto");
    expect(html).toContain("Anomalia IVA");
    expect(html).toContain("giornaliero");
  });

  it("returns empty string for no notifications", () => {
    expect(buildDigestHtml([], "giornaliero")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/notifiche-digest.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement digest**

Create `src/lib/notifiche/digest.ts`:

```typescript
import type { Notifica, NotificaPriorita } from "@prisma/client";

type GroupedNotifiche = Record<NotificaPriorita, Notifica[]>;

export function groupNotificheByPriorita(notifiche: Notifica[]): GroupedNotifiche {
  const grouped: GroupedNotifiche = {
    CRITICA: [],
    ALTA: [],
    MEDIA: [],
    BASSA: [],
  };

  for (const n of notifiche) {
    grouped[n.priorita].push(n);
  }

  return grouped;
}

export function buildDigestHtml(
  notifiche: Notifica[],
  frequenza: "giornaliero" | "settimanale",
): string {
  if (notifiche.length === 0) return "";

  const grouped = groupNotificheByPriorita(notifiche);
  const prioritaLabels: Record<NotificaPriorita, string> = {
    CRITICA: "Critiche",
    ALTA: "Priorità alta",
    MEDIA: "Priorità media",
    BASSA: "Informative",
  };

  const sections: string[] = [];

  for (const priorita of ["CRITICA", "ALTA", "MEDIA", "BASSA"] as NotificaPriorita[]) {
    const items = grouped[priorita];
    if (items.length === 0) continue;

    const itemsHtml = items
      .map((n) => `<li><strong>${n.titolo}</strong><br/>${n.messaggio}</li>`)
      .join("\n");

    sections.push(`
      <h3>${prioritaLabels[priorita]} (${items.length})</h3>
      <ul>${itemsHtml}</ul>
    `);
  }

  return `
    <h2>Riepilogo ${frequenza} — Prima Nota</h2>
    <p>Hai ${notifiche.length} notifiche non lette.</p>
    ${sections.join("\n")}
  `.trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/notifiche-digest.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifiche/digest.ts src/lib/__tests__/notifiche-digest.test.ts
git commit -m "feat(sp0): add notification digest aggregator for email summaries"
```

---

## Task 10: API Routes — Providers

**Files:**
- Create: `src/app/api/providers/route.ts`
- Create: `src/app/api/providers/[id]/route.ts`
- Create: `src/app/api/providers/test/route.ts`

- [ ] **Step 1: Create providers list/create route**

Create `src/app/api/providers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const providers = await prisma.providerConfig.findMany({
      where: { societaId },
      orderBy: { tipo: "asc" },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error("GET /api/providers error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await req.json();

    const { tipo, provider, configExtra } = body;

    if (!tipo || !provider) {
      return NextResponse.json(
        { error: "tipo e provider sono obbligatori" },
        { status: 400 },
      );
    }

    const config = await prisma.providerConfig.create({
      data: {
        societaId,
        tipo,
        provider,
        stato: provider === "FILE" ? "ATTIVO" : "CONFIGURAZIONE",
        configExtra: configExtra ?? undefined,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Provider già configurato per questa società" },
        { status: 409 },
      );
    }
    console.error("POST /api/providers error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create single provider route**

Create `src/app/api/providers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;

    const config = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!config) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    const updated = await prisma.providerConfig.update({
      where: { id: Number(id) },
      data: {
        stato: body.stato,
        credenziali: body.credenziali,
        configExtra: body.configExtra,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;

    const existing = await prisma.providerConfig.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    await prisma.providerConfig.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/providers/[id] error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create test connection route**

Create `src/app/api/providers/test/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProviderManager } from "@/lib/providers/manager";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const body = await req.json();

    const { providerConfigId } = body;

    const config = await prisma.providerConfig.findFirst({
      where: { id: providerConfigId, societaId },
    });

    if (!config) {
      return NextResponse.json({ error: "Provider non trovato" }, { status: 404 });
    }

    // For FILE providers, test is always successful
    if (config.provider === "FILE") {
      await prisma.providerConfig.update({
        where: { id: config.id },
        data: { stato: "ATTIVO" },
      });

      return NextResponse.json({ success: true, messaggio: "Provider file attivo" });
    }

    // For API providers (future): attempt connection test
    return NextResponse.json(
      { success: false, messaggio: `Test per ${config.provider} non ancora implementato` },
      { status: 501 },
    );
  } catch (error) {
    console.error("POST /api/providers/test error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/providers/
git commit -m "feat(sp0): add provider CRUD and test API routes"
```

---

## Task 11: API Routes — Notifications

**Files:**
- Create: `src/app/api/notifiche/route.ts`
- Create: `src/app/api/notifiche/preferenze/route.ts`

- [ ] **Step 1: Create notifications route**

Create `src/app/api/notifiche/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationEngine } from "@/lib/notifiche/engine";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const { searchParams } = new URL(req.url);
    const stato = searchParams.get("stato");
    const limit = Number(searchParams.get("limit") ?? 20);

    const notifiche = await prisma.notifica.findMany({
      where: {
        utenteDestinatarioId: userId,
        ...(stato ? { stato: stato as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const nonLette = await prisma.notifica.count({
      where: { utenteDestinatarioId: userId, stato: "NON_LETTA" },
    });

    return NextResponse.json({ notifiche, nonLette });
  } catch (error) {
    console.error("GET /api/notifiche error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const body = await req.json();

    const engine = new NotificationEngine();

    if (body.action === "markAsRead" && body.id) {
      await engine.markAsRead(body.id, userId);
    } else if (body.action === "markAllAsRead" && body.societaId) {
      await engine.markAllAsRead(userId, body.societaId);
    } else {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/notifiche error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create preferences route**

Create `src/app/api/notifiche/preferenze/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;

    const preferenze = await prisma.preferenzaNotifica.findMany({
      where: { utenteId: userId },
    });

    return NextResponse.json(preferenze);
  } catch (error) {
    console.error("GET /api/notifiche/preferenze error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const body = await req.json();

    const { tipoEvento, canale, abilitato, digestFrequency } = body;

    if (!tipoEvento || !canale) {
      return NextResponse.json(
        { error: "tipoEvento e canale sono obbligatori" },
        { status: 400 },
      );
    }

    const preferenza = await prisma.preferenzaNotifica.upsert({
      where: {
        utenteId_tipoEvento_canale: { utenteId: userId, tipoEvento, canale },
      },
      update: {
        abilitato: abilitato ?? true,
        digestFrequency: digestFrequency ?? "IMMEDIATO",
      },
      create: {
        utenteId: userId,
        tipoEvento,
        canale,
        abilitato: abilitato ?? true,
        digestFrequency: digestFrequency ?? "IMMEDIATO",
      },
    });

    return NextResponse.json(preferenza);
  } catch (error) {
    console.error("PUT /api/notifiche/preferenze error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifiche/
git commit -m "feat(sp0): add notification and preferences API routes"
```

---

## Task 12: API Routes — AI Suggestions

**Files:**
- Create: `src/app/api/ai/suggestions/route.ts`

- [ ] **Step 1: Create suggestions route**

Create `src/app/api/ai/suggestions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { searchParams } = new URL(req.url);
    const stato = searchParams.get("stato") ?? "PENDING";
    const limit = Number(searchParams.get("limit") ?? 20);

    const suggestions = await prisma.aiSuggestion.findMany({
      where: { societaId, stato: stato as any },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const serialized = suggestions.map((s) => ({
      ...s,
      confidence: Number(s.confidence),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("GET /api/ai/suggestions error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;
    const societaId = user.societaId as number;
    const body = await req.json();

    const { id, action } = body;

    if (!id || !["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json(
        { error: "id e action (APPROVED|REJECTED) sono obbligatori" },
        { status: 400 },
      );
    }

    const suggestion = await prisma.aiSuggestion.findFirst({
      where: { id: Number(id), societaId },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion non trovata" }, { status: 404 });
    }

    const updated = await prisma.aiSuggestion.update({
      where: { id: Number(id) },
      data: {
        stato: action,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      confidence: Number(updated.confidence),
    });
  } catch (error) {
    console.error("PUT /api/ai/suggestions error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ai/
git commit -m "feat(sp0): add AI suggestions list and review API routes"
```

---

## Task 13: Run All Tests & Verify Build

**Files:** None (verification only)

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run src/lib/__tests__/providers-manager.test.ts src/lib/__tests__/providers-fatture-file.test.ts src/lib/__tests__/providers-banca-file.test.ts src/lib/__tests__/ai-pipeline.test.ts src/lib/__tests__/ai-cost-tracker.test.ts src/lib/__tests__/ai-classifier.test.ts src/lib/__tests__/notifiche-engine.test.ts src/lib/__tests__/notifiche-digest.test.ts
```

Expected: All PASS

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests still pass + new tests pass

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(sp0): resolve any test/build issues"
```

(Skip this step if no fixes were needed.)
