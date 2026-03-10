# Spese Ricorrenti - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere la possibilità di creare spese ricorrenti (affitto, leasing, NLT, licenze) con generazione automatica di bozze mensili, banner di conferma in dashboard, e calcoli fiscali specifici per leasing/NLT auto.

**Architecture:** Nuovo modello Prisma `OperazioneRicorrente` come template. Due nuovi campi su `Operazione` (`bozza`, `operazioneRicorrenteId`). API per CRUD ricorrenze + generazione bozze. Toggle "Rendi ricorrente" nel form operazione. Banner bozze in dashboard. Tab "Ricorrenze" in configurazione.

**Tech Stack:** Next.js App Router, Prisma (MySQL), TypeScript, shadcn/ui, Tailwind CSS

---

### Task 1: Schema Prisma - Nuovo modello e migrazione

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Aggiungere l'enum `TipoContratto` e il modello `OperazioneRicorrente`**

Aggiungere dopo l'enum `RegimeFiscale` (riga 275):

```prisma
enum TipoContratto {
  LEASING
  NOLEGGIO_LUNGO_TERMINE

  @@map("tipo_contratto")
}
```

Aggiungere il modello `OperazioneRicorrente` dopo `PreferenzaUsoCategoria`:

```prisma
model OperazioneRicorrente {
  id                Int       @id @default(autoincrement())
  societaId         Int       @map("societa_id")
  createdByUserId   Int       @map("created_by_user_id")
  attiva            Boolean   @default(true)

  // Template dati operazione
  tipoOperazione    TipoOperazione @map("tipo_operazione")
  categoriaId       Int            @map("categoria_id")
  descrizione       String         @db.Text
  importoTotale     Decimal        @map("importo_totale") @db.Decimal(10, 2)
  aliquotaIva       Decimal?       @map("aliquota_iva") @db.Decimal(5, 2)
  importoImponibile Decimal?       @map("importo_imponibile") @db.Decimal(10, 2)
  importoIva        Decimal?       @map("importo_iva") @db.Decimal(10, 2)
  percentualeDetraibilitaIva Decimal? @map("percentuale_detraibilita_iva") @db.Decimal(5, 2)
  ivaDetraibile     Decimal?       @map("iva_detraibile") @db.Decimal(10, 2)
  ivaIndetraibile   Decimal?       @map("iva_indetraibile") @db.Decimal(10, 2)
  opzioneUso        String?        @map("opzione_uso") @db.VarChar(50)
  percentualeDeducibilita Decimal  @map("percentuale_deducibilita") @db.Decimal(5, 2)
  importoDeducibile Decimal        @map("importo_deducibile") @db.Decimal(10, 2)
  deducibilitaCustom Boolean       @default(false) @map("deducibilita_custom")
  tipoRipartizione  TipoRipartizione @map("tipo_ripartizione")
  socioSingoloId    Int?           @map("socio_singolo_id")
  note              String?        @db.Text

  // Ricorrenza
  giornoDelMese        Int       @map("giorno_del_mese")
  dataInizio           DateTime  @map("data_inizio") @db.Date
  dataFine             DateTime? @map("data_fine") @db.Date
  prossimaGenerazione  DateTime  @map("prossima_generazione") @db.Date

  // Dati fiscali leasing/NLT (opzionali)
  tipoContratto     TipoContratto? @map("tipo_contratto")
  valoreBene        Decimal?       @map("valore_bene") @db.Decimal(10, 2)
  maxicanone        Decimal?       @map("maxicanone") @db.Decimal(10, 2)
  durataContratto   Int?           @map("durata_contratto")
  quotaServizi      Decimal?       @map("quota_servizi") @db.Decimal(10, 2)
  rateRimanenti     Int?           @map("rate_rimanenti")

  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  societa            Societa        @relation(fields: [societaId], references: [id])
  categoria          CategoriaSpesa @relation(fields: [categoriaId], references: [id])
  createdBy          Utente         @relation(fields: [createdByUserId], references: [id])
  operazioniGenerate Operazione[]

  @@index([societaId, attiva])
  @@index([prossimaGenerazione])
  @@map("operazioni_ricorrenti")
}
```

**Step 2: Aggiungere i campi `bozza` e `operazioneRicorrenteId` al modello `Operazione`**

In `Operazione` (dopo riga 116 - campo `eliminato`), aggiungere:

```prisma
  bozza                  Boolean  @default(false)
  operazioneRicorrenteId Int?     @map("operazione_ricorrente_id")
```

Aggiungere la relazione (dopo riga 125 - relazione `cespite`):

```prisma
  operazioneRicorrente OperazioneRicorrente? @relation(fields: [operazioneRicorrenteId], references: [id])
```

Aggiungere indice (dopo riga 129):

```prisma
  @@index([operazioneRicorrenteId])
```

**Step 3: Aggiungere relazioni inverse**

In `Societa` (dopo riga 27 - `cespiti`):
```prisma
  operazioniRicorrenti OperazioneRicorrente[]
```

In `CategoriaSpesa` (dopo riga 88 - `preferenzeUso`):
```prisma
  operazioniRicorrenti OperazioneRicorrente[]
```

In `Utente` (dopo riga 66 - `preferenzeUso`):
```prisma
  operazioniRicorrenti OperazioneRicorrente[]
```

**Step 4: Eseguire la migrazione**

```bash
npx prisma migrate dev --name add-operazioni-ricorrenti
npx prisma generate
```

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add OperazioneRicorrente model and bozza field on Operazione"
```

---

### Task 2: Utility di calcolo fiscale leasing/NLT

**Files:**
- Create: `src/lib/calcoli-ricorrenze.ts`

**Step 1: Creare il file con le costanti e funzioni di calcolo**

```typescript
// Costanti limiti fiscali art. 164 TUIR
export const LIMITI_LEASING_AUTO = {
  STANDARD: 18075.99,
  AGENTE: 25822.84,
};

export const LIMITI_NLT_ANNUO = {
  STANDARD: 3615.20,
  AGENTE: 5164.57,
};

export const DURATA_MINIMA_FISCALE_AUTO_MESI = 48;

type TipoAttivita = "SRL" | "SRLS" | "SNC" | "SAS" | "STP" | "DITTA_INDIVIDUALE" | "LIBERO_PROFESSIONISTA" | "AGENTE_COMMERCIO";

/**
 * Calcola il coefficiente di proporzionalità per leasing auto.
 * Se il valore del bene supera il limite fiscale, il canone deducibile
 * si riduce proporzionalmente: canone × (limite / valoreBene)
 */
export function calcolaCoeffLeasing(
  valoreBene: number,
  tipoAttivita: TipoAttivita
): number {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const limite = isAgente ? LIMITI_LEASING_AUTO.AGENTE : LIMITI_LEASING_AUTO.STANDARD;

  if (valoreBene <= limite) return 1;
  return limite / valoreBene;
}

/**
 * Calcola la quota di maxicanone mensile da aggiungere al canone
 * per il calcolo della deducibilità.
 * Il maxicanone va riscontato sull'intera durata del contratto.
 */
export function calcolaQuotaMaxicanoneMensile(
  maxicanone: number,
  durataContratto: number
): number {
  if (durataContratto <= 0 || maxicanone <= 0) return 0;
  return maxicanone / durataContratto;
}

/**
 * Per NLT: calcola il cap mensile sulla quota locazione.
 * Limite annuo: €3.615,20 (standard) o €5.164,57 (agenti).
 * È un cap secco, non proporzionale.
 */
export function calcolaCapNltMensile(tipoAttivita: TipoAttivita): number {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const limiteAnnuo = isAgente ? LIMITI_NLT_ANNUO.AGENTE : LIMITI_NLT_ANNUO.STANDARD;
  return Math.round((limiteAnnuo / 12) * 100) / 100;
}

/**
 * Calcola l'importo deducibile per un canone di leasing auto.
 * Applica: proporzionalità sul valore bene + maxicanone riscontato.
 *
 * @returns importoDeducibile (dopo applicazione % deducibilità)
 */
export function calcolaDeducibileLeasing(params: {
  canone: number;
  valoreBene: number;
  maxicanone: number;
  durataContratto: number;
  percentualeDeducibilita: number;
  tipoAttivita: TipoAttivita;
}): number {
  const { canone, valoreBene, maxicanone, durataContratto, percentualeDeducibilita, tipoAttivita } = params;

  const coeff = calcolaCoeffLeasing(valoreBene, tipoAttivita);
  const quotaMaxicanone = calcolaQuotaMaxicanoneMensile(maxicanone, durataContratto);

  // Il canone fiscalmente rilevante è (canone + quota maxicanone mensile) × coefficiente
  const canoneFiscale = (canone + quotaMaxicanone) * coeff;

  return Math.round(canoneFiscale * percentualeDeducibilita) / 100;
}

/**
 * Calcola l'importo deducibile per un canone NLT auto.
 * La quota locazione ha un cap annuo; la quota servizi non ha limiti.
 *
 * @returns importoDeducibile (dopo applicazione % deducibilità)
 */
export function calcolaDeducibileNlt(params: {
  canone: number;
  quotaServizi: number;
  maxicanone: number;
  durataContratto: number;
  percentualeDeducibilita: number;
  tipoAttivita: TipoAttivita;
}): number {
  const { canone, quotaServizi, maxicanone, durataContratto, percentualeDeducibilita, tipoAttivita } = params;

  const quotaLocazione = canone - quotaServizi;
  const capMensile = calcolaCapNltMensile(tipoAttivita);

  // Quota locazione: capped al limite mensile
  const quotaLocazioneDeducibile = Math.min(quotaLocazione, capMensile);

  // Quota servizi: nessun cap, stessa % deducibilità
  // Anticipo NLT: riscontato sulla durata
  const quotaAnticipo = (maxicanone > 0 && durataContratto > 0)
    ? maxicanone / durataContratto
    : 0;

  const totaleFiscale = quotaLocazioneDeducibile + quotaServizi + quotaAnticipo;

  return Math.round(totaleFiscale * percentualeDeducibilita) / 100;
}

/**
 * Calcola la data effettiva per un dato mese/anno rispettando il giorno scelto.
 * Se il mese ha meno giorni, usa l'ultimo giorno del mese.
 */
export function calcolaDataEffettiva(
  giornoDelMese: number,
  mese: number, // 0-11
  anno: number
): Date {
  // Ultimo giorno del mese
  const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();
  const giornoEffettivo = Math.min(giornoDelMese, ultimoGiorno);
  return new Date(anno, mese, giornoEffettivo);
}

/**
 * Calcola la prossima data di generazione a partire dalla data corrente.
 */
export function calcolaProssimaGenerazione(
  giornoDelMese: number,
  dataCorrente: Date
): Date {
  const mese = dataCorrente.getMonth();
  const anno = dataCorrente.getFullYear();

  // Prova il mese successivo
  const meseProssimo = mese + 1;
  const annoProssimo = meseProssimo > 11 ? anno + 1 : anno;
  const meseEffettivo = meseProssimo > 11 ? 0 : meseProssimo;

  return calcolaDataEffettiva(giornoDelMese, meseEffettivo, annoProssimo);
}
```

**Step 2: Commit**

```bash
git add src/lib/calcoli-ricorrenze.ts
git commit -m "feat: add fiscal calculation utilities for leasing and NLT"
```

---

### Task 3: API CRUD operazioni ricorrenti

**Files:**
- Create: `src/app/api/operazioni-ricorrenti/route.ts`
- Create: `src/app/api/operazioni-ricorrenti/[id]/route.ts`

**Step 1: Creare l'API GET + POST per `/api/operazioni-ricorrenti`**

`src/app/api/operazioni-ricorrenti/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAttivita } from "@/lib/log-helper";
import { calcolaProssimaGenerazione } from "@/lib/calcoli-ricorrenze";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const ricorrenze = await prisma.operazioneRicorrente.findMany({
      where: { societaId },
      include: {
        categoria: { select: { id: true, nome: true } },
        createdBy: {
          select: {
            id: true,
            socio: { select: { nome: true, cognome: true } },
          },
        },
      },
      orderBy: [{ attiva: "desc" }, { descrizione: "asc" }],
    });

    const serialized = ricorrenze.map((r) => ({
      ...r,
      importoTotale: Number(r.importoTotale),
      aliquotaIva: r.aliquotaIva != null ? Number(r.aliquotaIva) : null,
      importoImponibile: r.importoImponibile != null ? Number(r.importoImponibile) : null,
      importoIva: r.importoIva != null ? Number(r.importoIva) : null,
      percentualeDetraibilitaIva: r.percentualeDetraibilitaIva != null ? Number(r.percentualeDetraibilitaIva) : null,
      ivaDetraibile: r.ivaDetraibile != null ? Number(r.ivaDetraibile) : null,
      ivaIndetraibile: r.ivaIndetraibile != null ? Number(r.ivaIndetraibile) : null,
      percentualeDeducibilita: Number(r.percentualeDeducibilita),
      importoDeducibile: Number(r.importoDeducibile),
      valoreBene: r.valoreBene != null ? Number(r.valoreBene) : null,
      maxicanone: r.maxicanone != null ? Number(r.maxicanone) : null,
      quotaServizi: r.quotaServizi != null ? Number(r.quotaServizi) : null,
      dataInizio: r.dataInizio.toISOString(),
      dataFine: r.dataFine?.toISOString() ?? null,
      prossimaGenerazione: r.prossimaGenerazione.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore GET operazioni ricorrenti:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    const body = await request.json();
    const {
      tipoOperazione, categoriaId, descrizione, importoTotale,
      aliquotaIva, importoImponibile, importoIva,
      percentualeDetraibilitaIva, ivaDetraibile, ivaIndetraibile,
      opzioneUso, percentualeDeducibilita, importoDeducibile,
      deducibilitaCustom, tipoRipartizione, socioSingoloId, note,
      giornoDelMese, dataInizio, dataFine,
      tipoContratto, valoreBene, maxicanone, durataContratto,
      quotaServizi, rateRimanenti,
    } = body;

    // Validations
    if (!tipoOperazione || !descrizione || !categoriaId || !importoTotale || !giornoDelMese || !dataInizio) {
      return NextResponse.json(
        { error: "Campi obbligatori mancanti" },
        { status: 400 }
      );
    }

    const giorno = parseInt(String(giornoDelMese), 10);
    if (giorno < 1 || giorno > 31) {
      return NextResponse.json(
        { error: "Il giorno del mese deve essere tra 1 e 31" },
        { status: 400 }
      );
    }

    // Calcola prossima generazione (mese dopo la data inizio)
    const dataInizioDate = new Date(dataInizio);
    const prossimaGen = calcolaProssimaGenerazione(giorno, dataInizioDate);

    const ricorrenza = await prisma.operazioneRicorrente.create({
      data: {
        societaId,
        createdByUserId: userId,
        tipoOperazione: tipoOperazione as any,
        categoriaId: parseInt(String(categoriaId), 10),
        descrizione,
        importoTotale: parseFloat(String(importoTotale)),
        aliquotaIva: aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null,
        importoImponibile: importoImponibile != null ? parseFloat(String(importoImponibile)) : null,
        importoIva: importoIva != null ? parseFloat(String(importoIva)) : null,
        percentualeDetraibilitaIva: percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null,
        ivaDetraibile: ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null,
        ivaIndetraibile: ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null,
        opzioneUso: opzioneUso || null,
        percentualeDeducibilita: parseFloat(String(percentualeDeducibilita)),
        importoDeducibile: parseFloat(String(importoDeducibile)),
        deducibilitaCustom: Boolean(deducibilitaCustom),
        tipoRipartizione: tipoRipartizione as any,
        socioSingoloId: socioSingoloId ? parseInt(String(socioSingoloId), 10) : null,
        note: note || null,
        giornoDelMese: giorno,
        dataInizio: dataInizioDate,
        dataFine: dataFine ? new Date(dataFine) : null,
        prossimaGenerazione: prossimaGen,
        tipoContratto: tipoContratto || null,
        valoreBene: valoreBene != null ? parseFloat(String(valoreBene)) : null,
        maxicanone: maxicanone != null ? parseFloat(String(maxicanone)) : null,
        durataContratto: durataContratto != null ? parseInt(String(durataContratto), 10) : null,
        quotaServizi: quotaServizi != null ? parseFloat(String(quotaServizi)) : null,
        rateRimanenti: rateRimanenti != null ? parseInt(String(rateRimanenti), 10) : null,
      },
    });

    await logAttivita({
      userId,
      azione: "INSERT",
      tabella: "operazioni_ricorrenti",
      recordId: ricorrenza.id,
      valoriDopo: { descrizione, importoTotale, tipoContratto, giornoDelMese },
    });

    return NextResponse.json({
      ...ricorrenza,
      importoTotale: Number(ricorrenza.importoTotale),
      percentualeDeducibilita: Number(ricorrenza.percentualeDeducibilita),
      importoDeducibile: Number(ricorrenza.importoDeducibile),
      dataInizio: ricorrenza.dataInizio.toISOString(),
      dataFine: ricorrenza.dataFine?.toISOString() ?? null,
      prossimaGenerazione: ricorrenza.prossimaGenerazione.toISOString(),
      createdAt: ricorrenza.createdAt.toISOString(),
      updatedAt: ricorrenza.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Errore POST operazione ricorrente:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 2: Creare l'API GET + PUT + DELETE per `/api/operazioni-ricorrenti/[id]`**

`src/app/api/operazioni-ricorrenti/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAttivita } from "@/lib/log-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;

    const ricorrenza = await prisma.operazioneRicorrente.findFirst({
      where: { id: parseInt(id, 10), societaId: user.societaId },
      include: {
        categoria: { select: { id: true, nome: true } },
      },
    });

    if (!ricorrenza) {
      return NextResponse.json({ error: "Non trovata" }, { status: 404 });
    }

    return NextResponse.json({
      ...ricorrenza,
      importoTotale: Number(ricorrenza.importoTotale),
      aliquotaIva: ricorrenza.aliquotaIva != null ? Number(ricorrenza.aliquotaIva) : null,
      importoImponibile: ricorrenza.importoImponibile != null ? Number(ricorrenza.importoImponibile) : null,
      importoIva: ricorrenza.importoIva != null ? Number(ricorrenza.importoIva) : null,
      percentualeDetraibilitaIva: ricorrenza.percentualeDetraibilitaIva != null ? Number(ricorrenza.percentualeDetraibilitaIva) : null,
      ivaDetraibile: ricorrenza.ivaDetraibile != null ? Number(ricorrenza.ivaDetraibile) : null,
      ivaIndetraibile: ricorrenza.ivaIndetraibile != null ? Number(ricorrenza.ivaIndetraibile) : null,
      percentualeDeducibilita: Number(ricorrenza.percentualeDeducibilita),
      importoDeducibile: Number(ricorrenza.importoDeducibile),
      valoreBene: ricorrenza.valoreBene != null ? Number(ricorrenza.valoreBene) : null,
      maxicanone: ricorrenza.maxicanone != null ? Number(ricorrenza.maxicanone) : null,
      quotaServizi: ricorrenza.quotaServizi != null ? Number(ricorrenza.quotaServizi) : null,
      dataInizio: ricorrenza.dataInizio.toISOString(),
      dataFine: ricorrenza.dataFine?.toISOString() ?? null,
      prossimaGenerazione: ricorrenza.prossimaGenerazione.toISOString(),
      createdAt: ricorrenza.createdAt.toISOString(),
      updatedAt: ricorrenza.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore GET ricorrenza:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;
    const ricorrenteId = parseInt(id, 10);

    const existing = await prisma.operazioneRicorrente.findFirst({
      where: { id: ricorrenteId, societaId: user.societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Non trovata" }, { status: 404 });
    }

    const body = await request.json();
    const {
      descrizione, importoTotale, aliquotaIva, importoImponibile, importoIva,
      percentualeDetraibilitaIva, ivaDetraibile, ivaIndetraibile,
      opzioneUso, percentualeDeducibilita, importoDeducibile,
      tipoRipartizione, socioSingoloId, note,
      attiva, dataFine,
      valoreBene, maxicanone, durataContratto, quotaServizi,
    } = body;

    const updateData: any = {};

    if (descrizione !== undefined) updateData.descrizione = descrizione;
    if (importoTotale !== undefined) updateData.importoTotale = parseFloat(String(importoTotale));
    if (aliquotaIva !== undefined) updateData.aliquotaIva = aliquotaIva != null ? parseFloat(String(aliquotaIva)) : null;
    if (importoImponibile !== undefined) updateData.importoImponibile = importoImponibile != null ? parseFloat(String(importoImponibile)) : null;
    if (importoIva !== undefined) updateData.importoIva = importoIva != null ? parseFloat(String(importoIva)) : null;
    if (percentualeDetraibilitaIva !== undefined) updateData.percentualeDetraibilitaIva = percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null;
    if (ivaDetraibile !== undefined) updateData.ivaDetraibile = ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null;
    if (ivaIndetraibile !== undefined) updateData.ivaIndetraibile = ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null;
    if (opzioneUso !== undefined) updateData.opzioneUso = opzioneUso || null;
    if (percentualeDeducibilita !== undefined) updateData.percentualeDeducibilita = parseFloat(String(percentualeDeducibilita));
    if (importoDeducibile !== undefined) updateData.importoDeducibile = parseFloat(String(importoDeducibile));
    if (tipoRipartizione !== undefined) updateData.tipoRipartizione = tipoRipartizione;
    if (socioSingoloId !== undefined) updateData.socioSingoloId = socioSingoloId ? parseInt(String(socioSingoloId), 10) : null;
    if (note !== undefined) updateData.note = note || null;
    if (attiva !== undefined) updateData.attiva = Boolean(attiva);
    if (dataFine !== undefined) updateData.dataFine = dataFine ? new Date(dataFine) : null;
    if (valoreBene !== undefined) updateData.valoreBene = valoreBene != null ? parseFloat(String(valoreBene)) : null;
    if (maxicanone !== undefined) updateData.maxicanone = maxicanone != null ? parseFloat(String(maxicanone)) : null;
    if (durataContratto !== undefined) updateData.durataContratto = durataContratto != null ? parseInt(String(durataContratto), 10) : null;
    if (quotaServizi !== undefined) updateData.quotaServizi = quotaServizi != null ? parseFloat(String(quotaServizi)) : null;

    const updated = await prisma.operazioneRicorrente.update({
      where: { id: ricorrenteId },
      data: updateData,
    });

    await logAttivita({
      userId: user.id,
      azione: "UPDATE",
      tabella: "operazioni_ricorrenti",
      recordId: ricorrenteId,
      valoriPrima: { attiva: existing.attiva, importoTotale: Number(existing.importoTotale) },
      valoriDopo: updateData,
    });

    return NextResponse.json({
      ...updated,
      importoTotale: Number(updated.importoTotale),
      percentualeDeducibilita: Number(updated.percentualeDeducibilita),
      importoDeducibile: Number(updated.importoDeducibile),
      dataInizio: updated.dataInizio.toISOString(),
      dataFine: updated.dataFine?.toISOString() ?? null,
      prossimaGenerazione: updated.prossimaGenerazione.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Errore PUT ricorrenza:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;
    const ricorrenteId = parseInt(id, 10);

    const existing = await prisma.operazioneRicorrente.findFirst({
      where: { id: ricorrenteId, societaId: user.societaId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Non trovata" }, { status: 404 });
    }

    // Elimina bozze non confermate
    await prisma.operazione.deleteMany({
      where: {
        operazioneRicorrenteId: ricorrenteId,
        bozza: true,
      },
    });

    // Scollega operazioni confermate (non le eliminiamo)
    await prisma.operazione.updateMany({
      where: {
        operazioneRicorrenteId: ricorrenteId,
        bozza: false,
      },
      data: { operazioneRicorrenteId: null },
    });

    // Elimina la ricorrenza
    await prisma.operazioneRicorrente.delete({
      where: { id: ricorrenteId },
    });

    await logAttivita({
      userId: user.id,
      azione: "DELETE",
      tabella: "operazioni_ricorrenti",
      recordId: ricorrenteId,
      valoriPrima: { descrizione: existing.descrizione },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE ricorrenza:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/operazioni-ricorrenti/
git commit -m "feat: add CRUD API for recurring operations"
```

---

### Task 4: API generazione bozze

**Files:**
- Create: `src/app/api/operazioni-ricorrenti/genera/route.ts`

**Step 1: Creare l'endpoint di generazione**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaRipartizione } from "@/lib/business-utils";
import { calcolaDataEffettiva, calcolaProssimaGenerazione } from "@/lib/calcoli-ricorrenze";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    // Trova ricorrenze attive con prossimaGenerazione <= oggi
    const ricorrenze = await prisma.operazioneRicorrente.findMany({
      where: {
        societaId,
        attiva: true,
        prossimaGenerazione: { lte: oggi },
      },
    });

    const bozzeGenerate: number[] = [];

    for (const ric of ricorrenze) {
      // Genera bozze per tutti i mesi mancanti fino ad oggi
      let prossimaGen = new Date(ric.prossimaGenerazione);
      prossimaGen.setHours(0, 0, 0, 0);

      while (prossimaGen <= oggi) {
        const mese = prossimaGen.getMonth();
        const anno = prossimaGen.getFullYear();

        // Check se bozza già esiste per questo mese/anno
        const dataEffettiva = calcolaDataEffettiva(ric.giornoDelMese, mese, anno);

        const bozzaEsistente = await prisma.operazione.findFirst({
          where: {
            operazioneRicorrenteId: ric.id,
            dataOperazione: dataEffettiva,
          },
        });

        if (!bozzaEsistente) {
          // Calcola ripartizioni
          const soci = await prisma.socio.findMany({
            where: { societaId, attivo: true },
            select: { id: true, quotaPercentuale: true },
          });

          const sociForCalc = soci.map((s) => ({
            id: s.id,
            quotaPercentuale: Number(s.quotaPercentuale),
          }));

          const ripartizioniCalcolate = calcolaRipartizione(
            Number(ric.importoTotale),
            ric.tipoRipartizione as "COMUNE" | "SINGOLO" | "CUSTOM",
            sociForCalc,
            ric.socioSingoloId ?? undefined
          );

          // Crea bozza
          const bozza = await prisma.operazione.create({
            data: {
              societaId,
              tipoOperazione: ric.tipoOperazione,
              dataOperazione: dataEffettiva,
              descrizione: ric.descrizione,
              importoTotale: ric.importoTotale,
              aliquotaIva: ric.aliquotaIva,
              importoImponibile: ric.importoImponibile,
              importoIva: ric.importoIva,
              percentualeDetraibilitaIva: ric.percentualeDetraibilitaIva,
              ivaDetraibile: ric.ivaDetraibile,
              ivaIndetraibile: ric.ivaIndetraibile,
              opzioneUso: ric.opzioneUso,
              categoriaId: ric.categoriaId,
              importoDeducibile: ric.importoDeducibile,
              percentualeDeducibilita: ric.percentualeDeducibilita,
              deducibilitaCustom: ric.deducibilitaCustom,
              tipoRipartizione: ric.tipoRipartizione,
              note: ric.note,
              createdByUserId: ric.createdByUserId,
              bozza: true,
              operazioneRicorrenteId: ric.id,
            },
          });

          // Crea ripartizioni per la bozza
          await prisma.ripartizioneOperazione.createMany({
            data: ripartizioniCalcolate.map((rip) => ({
              operazioneId: bozza.id,
              socioId: rip.socioId,
              percentuale: rip.percentuale,
              importoCalcolato: rip.importo,
            })),
          });

          bozzeGenerate.push(bozza.id);
        }

        // Avanza al mese successivo
        prossimaGen = calcolaProssimaGenerazione(ric.giornoDelMese, prossimaGen);
      }

      // Aggiorna prossimaGenerazione e rateRimanenti
      const updateData: any = { prossimaGenerazione: prossimaGen };

      if (ric.rateRimanenti != null) {
        const nuoveRate = ric.rateRimanenti - bozzeGenerate.length;
        updateData.rateRimanenti = Math.max(0, nuoveRate);
        if (nuoveRate <= 0) {
          updateData.attiva = false;
        }
      }

      // Check dataFine
      if (ric.dataFine && prossimaGen > ric.dataFine) {
        updateData.attiva = false;
      }

      await prisma.operazioneRicorrente.update({
        where: { id: ric.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      bozzeGenerate: bozzeGenerate.length,
      ids: bozzeGenerate,
    });
  } catch (error) {
    console.error("Errore generazione bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/operazioni-ricorrenti/genera/
git commit -m "feat: add draft generation endpoint for recurring operations"
```

---

### Task 5: API bozze - lista e conferma

**Files:**
- Create: `src/app/api/bozze/route.ts`
- Create: `src/app/api/bozze/[id]/conferma/route.ts`
- Create: `src/app/api/bozze/conferma-tutte/route.ts`

**Step 1: GET bozze pendenti**

`src/app/api/bozze/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const bozze = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: true,
        eliminato: false,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        operazioneRicorrente: {
          select: { id: true, tipoContratto: true },
        },
      },
      orderBy: { dataOperazione: "asc" },
    });

    const serialized = bozze.map((op) => ({
      id: op.id,
      dataOperazione: op.dataOperazione.toISOString(),
      descrizione: op.descrizione,
      importoTotale: Number(op.importoTotale),
      categoria: op.categoria,
      tipoOperazione: op.tipoOperazione,
      operazioneRicorrenteId: op.operazioneRicorrenteId,
      tipoContratto: op.operazioneRicorrente?.tipoContratto ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore GET bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 2: Conferma singola bozza**

`src/app/api/bozze/[id]/conferma/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;
    const operazioneId = parseInt(id, 10);

    const bozza = await prisma.operazione.findFirst({
      where: {
        id: operazioneId,
        societaId: user.societaId,
        bozza: true,
        eliminato: false,
      },
    });

    if (!bozza) {
      return NextResponse.json({ error: "Bozza non trovata" }, { status: 404 });
    }

    // Opzionalmente aggiornare l'importo se fornito nel body
    const body = await request.json().catch(() => ({}));
    const updateData: any = { bozza: false };

    if (body.importoTotale !== undefined) {
      updateData.importoTotale = parseFloat(String(body.importoTotale));
    }

    await prisma.operazione.update({
      where: { id: operazioneId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore conferma bozza:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 3: Conferma tutte le bozze**

`src/app/api/bozze/conferma-tutte/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;

    const result = await prisma.operazione.updateMany({
      where: {
        societaId: user.societaId,
        bozza: true,
        eliminato: false,
      },
      data: { bozza: false },
    });

    return NextResponse.json({ confermate: result.count });
  } catch (error) {
    console.error("Errore conferma tutte:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/bozze/
git commit -m "feat: add draft listing and confirmation APIs"
```

---

### Task 6: Escludere bozze dalla lista operazioni e dai report

**Files:**
- Modify: `src/app/api/operazioni/route.ts`
- Modify: `src/app/api/dashboard/kpi/route.ts` (se esiste)

**Step 1: Aggiungere `bozza: false` al filtro GET operazioni**

In `src/app/api/operazioni/route.ts`, nel `where` iniziale (riga 33-36), aggiungere `bozza: false`:

```typescript
    const where: Prisma.OperazioneWhereInput = {
      societaId,
      eliminato: false,
      bozza: false,
    };
```

**Step 2: Fare lo stesso per tutti gli endpoint di report/dashboard**

Cercare tutti gli endpoint che fanno query su `Operazione` con `eliminato: false` e aggiungere `bozza: false`. I file coinvolti sono:
- `src/app/api/dashboard/kpi/route.ts`
- `src/app/api/dashboard/trend/route.ts`
- `src/app/api/dashboard/breakdown/route.ts`
- `src/app/api/report/stima-fiscale/route.ts`
- `src/app/api/report/stima-fiscale-socio/route.ts`

Per ciascuno, aggiungere `bozza: false` accanto a `eliminato: false` in tutti i `where` clause.

**Step 3: Commit**

```bash
git add src/app/api/
git commit -m "fix: exclude draft operations from listings and reports"
```

---

### Task 7: Toggle "Rendi ricorrente" nel form operazione

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`
- Modify: `src/app/operazioni/nuova/page.tsx`

**Step 1: Aggiungere il tipo e le props per il tipo attività**

In `operazione-form.tsx`, aggiungere alle Props il `tipoAttivita`:

```typescript
type Props = {
  soci: Socio[];
  categorie: Categoria[];
  operazione?: OperazioneData;
  preferenzeUso?: PreferenzaUso[];
  regimeFiscale?: string;
  tipoAttivita?: string;  // NUOVO
};
```

**Step 2: Aggiungere gli state per la ricorrenza**

Dopo gli state esistenti, aggiungere:

```typescript
// Ricorrenza
const [isRicorrente, setIsRicorrente] = useState(false);
const [giornoDelMese, setGiornoDelMese] = useState(new Date().getDate());
const [dataFine, setDataFine] = useState("");

// Leasing/NLT
const [tipoContratto, setTipoContratto] = useState<string>("");
const [valoreBene, setValoreBene] = useState("");
const [maxicanoneImporto, setMaxicanoneImporto] = useState("");
const [durataContrattoMesi, setDurataContrattoMesi] = useState("");
const [quotaServiziImporto, setQuotaServiziImporto] = useState("");
```

**Step 3: Aggiungere la sezione UI ricorrenza dopo la sezione note**

Dopo la sezione note nel form, aggiungere il toggle e i campi ricorrenza. Il toggle mostra:
- Campo giorno del mese (1-31), pre-compilato dalla data operazione
- Campo data fine (opzionale)
- Se la categoria è "Leasing e noleggio auto" → mostra select LEASING vs NLT con campi dedicati
- Se LEASING: valore veicolo, anticipo/maxicanone, durata contratto. Con avviso se supera il limite fiscale
- Se NLT: quota servizi, anticipo (opzionale), durata (opzionale). Con avviso se supera il cap

**Step 4: Aggiornare il giorno quando cambia dataOperazione**

```typescript
useEffect(() => {
  if (dataOperazione && isRicorrente) {
    const giorno = new Date(dataOperazione).getDate();
    setGiornoDelMese(giorno);
  }
}, [dataOperazione, isRicorrente]);
```

**Step 5: Aggiornare il submit**

Nel submit, se `isRicorrente` è true:
1. Creare prima l'operazione normale (prima occorrenza) tramite POST `/api/operazioni`
2. Poi creare la ricorrenza tramite POST `/api/operazioni-ricorrenti` con tutti i dati del template

**Step 6: Passare `tipoAttivita` dalla page al form**

In `src/app/operazioni/nuova/page.tsx`, aggiungere `tipoAttivita` alle props passate:

```typescript
<OperazioneForm
  soci={serializedSoci}
  categorie={serializedCategorie}
  preferenzeUso={preferenzeUso}
  regimeFiscale={societa?.regimeFiscale || "ORDINARIO"}
  tipoAttivita={societa?.tipoAttivita || "SRL"}
/>
```

**Step 7: Commit**

```bash
git add src/app/operazioni/
git commit -m "feat: add recurring expense toggle with leasing/NLT fields in operation form"
```

---

### Task 8: Banner bozze in dashboard

**Files:**
- Modify: `src/app/dashboard/dashboard-content.tsx`

**Step 1: Aggiungere state e fetch per le bozze**

Aggiungere al componente:

```typescript
type Bozza = {
  id: number;
  dataOperazione: string;
  descrizione: string;
  importoTotale: number;
  categoria: { id: number; nome: string };
  tipoContratto: string | null;
};

// State
const [bozze, setBozze] = useState<Bozza[]>([]);
const [loadingBozze, setLoadingBozze] = useState(true);
const [editingBozza, setEditingBozza] = useState<number | null>(null);
const [editImporto, setEditImporto] = useState("");
const [confermando, setConfermando] = useState<number | null>(null);
```

**Step 2: Fetch e generazione bozze all'avvio**

```typescript
const fetchBozze = useCallback(async () => {
  setLoadingBozze(true);
  try {
    // Prima genera eventuali bozze in attesa
    await fetch("/api/operazioni-ricorrenti/genera", { method: "POST" });
    // Poi carica le bozze
    const res = await fetch("/api/bozze");
    if (res.ok) {
      const data = await res.json();
      setBozze(data);
    }
  } catch (err) {
    console.error("Errore bozze:", err);
  } finally {
    setLoadingBozze(false);
  }
}, []);

useEffect(() => {
  fetchBozze();
}, [fetchBozze]);
```

**Step 3: Funzioni di conferma**

```typescript
async function confermaBozza(id: number, importo?: number) {
  setConfermando(id);
  try {
    const body = importo !== undefined ? { importoTotale: importo } : {};
    const res = await fetch(`/api/bozze/${id}/conferma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setBozze((prev) => prev.filter((b) => b.id !== id));
      setEditingBozza(null);
      // Refresh KPI e operazioni
      fetchKpi(dates.da, dates.a);
      fetchRecentOps();
    }
  } finally {
    setConfermando(null);
  }
}

async function confermaTutte() {
  setConfermando(-1);
  try {
    const res = await fetch("/api/bozze/conferma-tutte", { method: "POST" });
    if (res.ok) {
      setBozze([]);
      fetchKpi(dates.da, dates.a);
      fetchRecentOps();
    }
  } finally {
    setConfermando(null);
  }
}
```

**Step 4: Rendering del banner**

Inserire il banner come primo elemento dentro `<div className="space-y-6">`, prima del Period Selector:

```tsx
{/* ── Banner Bozze Ricorrenti ──────────────────────────── */}
{!loadingBozze && bozze.length > 0 && (
  <Card className="border-amber-500/50 bg-amber-500/5">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        Hai {bozze.length} {bozze.length === 1 ? "spesa ricorrente" : "spese ricorrenti"} da confermare
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {bozze.map((bozza) => (
          <div key={bozza.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {formatDataItaliana(bozza.dataOperazione)}
              </span>
              <span className="text-sm font-medium">{bozza.descrizione}</span>
              <Badge variant="outline" className="text-xs">{bozza.categoria.nome}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {editingBozza === bozza.id ? (
                <>
                  <Input
                    type="number"
                    step="0.01"
                    value={editImporto}
                    onChange={(e) => setEditImporto(e.target.value)}
                    className="h-8 w-28"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      confermaBozza(bozza.id, parseFloat(editImporto));
                    }}
                    disabled={confermando === bozza.id}
                  >
                    Salva
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingBozza(null)}
                  >
                    Annulla
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium w-24 text-right">
                    {formatCurrency(bozza.importoTotale)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confermaBozza(bozza.id)}
                    disabled={confermando !== null}
                  >
                    Conferma
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingBozza(bozza.id);
                      setEditImporto(String(bozza.importoTotale));
                    }}
                  >
                    Modifica
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {bozze.length > 1 && (
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            onClick={confermaTutte}
            disabled={confermando !== null}
          >
            Conferma tutte
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

**Step 5: Commit**

```bash
git add src/app/dashboard/dashboard-content.tsx
git commit -m "feat: add recurring expense drafts banner to dashboard"
```

---

### Task 9: Pagina gestione ricorrenze

**Files:**
- Create: `src/app/configurazione/ricorrenze/page.tsx`
- Create: `src/app/configurazione/ricorrenze/ricorrenze-table.tsx`

**Step 1: Creare la server page**

`src/app/configurazione/ricorrenze/page.tsx`:

```typescript
import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { RicorrenzeTable } from "./ricorrenze-table";

export default async function RicorrenzePage() {
  const user = await requireAdmin();

  return (
    <AuthenticatedLayout user={user} pageTitle="Gestione Ricorrenze">
      <RicorrenzeTable />
    </AuthenticatedLayout>
  );
}
```

**Step 2: Creare il componente tabella**

`src/app/configurazione/ricorrenze/ricorrenze-table.tsx`:

Componente client che:
- Fa fetch da `/api/operazioni-ricorrenti` e mostra una tabella con: descrizione, importo, categoria, giorno del mese, data inizio/fine, tipo contratto, stato attiva/disattiva
- Toggle attiva/disattiva con PUT sull'API
- Bottone modifica che apre un dialog per editare importo, descrizione, data fine
- Bottone elimina con conferma
- Badge per tipo contratto (LEASING, NLT, o nessuno)
- Badge per stato (Attiva verde, Disattiva grigio)

**Step 3: Aggiungere il link nel menu laterale**

Trovare il file del sidebar/navigation e aggiungere il link "Ricorrenze" sotto la sezione Configurazione.

**Step 4: Commit**

```bash
git add src/app/configurazione/ricorrenze/ src/components/
git commit -m "feat: add recurring expenses management page"
```

---

### Task 10: Aggiungere link navigazione e test end-to-end

**Files:**
- Modify: il componente sidebar/navigation (cercare il file)

**Step 1: Aggiungere "Ricorrenze" al menu di navigazione**

Aggiungere una voce nel menu di configurazione che punta a `/configurazione/ricorrenze`.

**Step 2: Verificare il flusso completo**

1. Avviare il dev server: `npm run dev -- -p 8080`
2. Creare una nuova operazione con toggle "Rendi ricorrente" attivo
3. Verificare che la ricorrenza venga creata (controllare in `/configurazione/ricorrenze`)
4. Verificare che le bozze vengano generate al caricamento della dashboard
5. Verificare conferma singola e conferma tutte dal banner
6. Verificare che le bozze confermate appaiano nella lista operazioni
7. Verificare disattivazione/eliminazione ricorrenza dalla pagina gestione

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add recurring expenses navigation and complete integration"
```

---

### Task 11: Fix e rifinitura TypeScript

**Step 1: Verificare che il build passi**

```bash
npx tsc --noEmit
```

**Step 2: Fixare eventuali errori TypeScript**

Risolvere tutti gli errori di tipo, assicurandosi che:
- I campi `bozza` e `operazioneRicorrenteId` vengano serializzati dove necessario
- I tipi `Decimal` di Prisma vengano convertiti a `number` nelle risposte API
- Le props del form siano tipizzate correttamente

**Step 3: Commit**

```bash
git add .
git commit -m "fix: resolve TypeScript errors for recurring expenses feature"
```
