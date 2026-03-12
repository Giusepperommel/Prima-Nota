# Gestione IVA Automatica - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatizzare la gestione IVA in base al tipo di societa e regime fiscale, con toggle contestuali per categorie a trattamento variabile e memoria delle preferenze utente.

**Architecture:** Estendere schema Prisma con enum TipoAttivita/RegimeFiscale sulla Societa, aggiungere campi IVA/detraibilita sulle categorie con opzioni uso in JSON, nuova tabella preferenze utente. Il form calcola tutto automaticamente dalla categoria selezionata e dall'opzione uso. Migrazione dati esistenti per Clever (SRL ordinaria).

**Tech Stack:** Next.js App Router, Prisma ORM (MySQL), React (shadcn/ui components), TypeScript

---

### Task 1: Schema Prisma - Nuovi enum e modifiche Societa

**Files:**
- Modify: `prisma/schema.prisma:10-29` (Societa model)
- Modify: `prisma/schema.prisma` (aggiungere enum in fondo)

**Step 1: Aggiungere enum TipoAttivita e RegimeFiscale**

In `prisma/schema.prisma`, dopo l'enum `StatoCespite` (line 240), aggiungere:

```prisma
enum TipoAttivita {
  SRL
  SRLS
  SNC
  SAS
  STP
  DITTA_INDIVIDUALE
  LIBERO_PROFESSIONISTA
  AGENTE_COMMERCIO

  @@map("tipo_attivita")
}

enum RegimeFiscale {
  ORDINARIO
  FORFETTARIO

  @@map("regime_fiscale")
}
```

**Step 2: Modificare il model Societa**

In `prisma/schema.prisma:10-29`, sostituire il campo `regimeFiscale`:
- Rimuovere: `regimeFiscale String? @map("regime_fiscale") @db.VarChar(100)` (line 16)
- Aggiungere:
```prisma
  tipoAttivita     TipoAttivita @default(SRL) @map("tipo_attivita")
  regimeFiscale    RegimeFiscale @default(ORDINARIO) @map("regime_fiscale")
```

**Step 3: Eseguire migration**

```bash
npx prisma migrate dev --name add-tipo-attivita-regime-fiscale
```

Nota: La migrazione potrebbe richiedere di impostare un default per i record esistenti. Se Prisma chiede, confermare con il default SRL/ORDINARIO.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add TipoAttivita and RegimeFiscale enums to Societa model"
```

---

### Task 2: Schema Prisma - Modifiche CategoriaSpesa

**Files:**
- Modify: `prisma/schema.prisma:69-84` (CategoriaSpesa model)

**Step 1: Aggiungere campi IVA alla CategoriaSpesa**

Dopo il campo `tipoCategoria` (line 75), aggiungere:

```prisma
  aliquotaIvaDefault        Decimal  @default(22) @map("aliquota_iva_default") @db.Decimal(5, 2)
  percentualeDetraibilitaIva Decimal @default(100) @map("percentuale_detraibilita_iva") @db.Decimal(5, 2)
  haOpzioniUso              Boolean  @default(false) @map("ha_opzioni_uso")
  opzioniUso                Json?    @map("opzioni_uso")
```

**Step 2: Eseguire migration**

```bash
npx prisma migrate dev --name add-iva-fields-to-categoria
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add IVA deductibility fields to CategoriaSpesa model"
```

---

### Task 3: Schema Prisma - Modifiche Operazione e nuova tabella PreferenzaUsoCategoria

**Files:**
- Modify: `prisma/schema.prisma:86-120` (Operazione model)
- Modify: `prisma/schema.prisma` (aggiungere model PreferenzaUsoCategoria)

**Step 1: Aggiungere campi IVA detraibilita all'Operazione**

Dopo il campo `importoIva` (line 96), aggiungere:

```prisma
  percentualeDetraibilitaIva Decimal?  @map("percentuale_detraibilita_iva") @db.Decimal(5, 2)
  ivaDetraibile              Decimal?  @map("iva_detraibile") @db.Decimal(10, 2)
  ivaIndetraibile            Decimal?  @map("iva_indetraibile") @db.Decimal(10, 2)
  opzioneUso                 String?   @map("opzione_uso") @db.VarChar(50)
```

**Step 2: Aggiungere model PreferenzaUsoCategoria**

Dopo il model QuotaAmmortamento, aggiungere:

```prisma
model PreferenzaUsoCategoria {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  categoriaId Int      @map("categoria_id")
  opzioneUso  String   @map("opzione_uso") @db.VarChar(50)
  updatedAt   DateTime @updatedAt @map("updated_at")

  utente    Utente         @relation(fields: [userId], references: [id])
  categoria CategoriaSpesa @relation(fields: [categoriaId], references: [id])

  @@unique([userId, categoriaId])
  @@map("preferenze_uso_categoria")
}
```

Aggiungere le relazioni inverse:
- In model `Utente` (line 63): `preferenzeUso PreferenzaUsoCategoria[]`
- In model `CategoriaSpesa` (line 81): `preferenzeUso PreferenzaUsoCategoria[]`

**Step 3: Eseguire migration**

```bash
npx prisma migrate dev --name add-iva-detraibilita-operazione-preferenze-uso
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add IVA deductibility to Operazione and PreferenzaUsoCategoria table"
```

---

### Task 4: Configurazione categorie default - Logica centralizzata

**Files:**
- Create: `src/lib/categorie-default.ts`

**Step 1: Creare il file con le categorie default per ogni tipo attivita**

```typescript
// src/lib/categorie-default.ts

export type OpzioneUso = {
  label: string;
  codice: string;
  detraibilitaIva: number;
  deducibilitaCosto: number;
};

export type CategoriaDefault = {
  nome: string;
  percentualeDeducibilita: number;
  descrizione: string;
  tipoCategoria: string;
  aliquotaIvaDefault: number;
  percentualeDetraibilitaIva: number;
  haOpzioniUso: boolean;
  opzioniUso: OpzioneUso[] | null;
};

// Opzioni uso per auto/veicoli - standard (SRL, SNC, SAS, STP, Ditta, Professionista)
const OPZIONI_AUTO_STANDARD: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 40, deducibilitaCosto: 20 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
];

// Opzioni uso per auto/veicoli - agente di commercio
const OPZIONI_AUTO_AGENTE: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 100, deducibilitaCosto: 80 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
];

// Opzioni uso per telefonia mobile
const OPZIONI_TELEFONIA_MOBILE: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 50, deducibilitaCosto: 80 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
];

// Opzioni uso per alberghi e ristoranti
const OPZIONI_ALBERGHI_RISTORANTI: OpzioneUso[] = [
  { label: "Spesa di lavoro (trasferta, riunione)", codice: "BUSINESS", detraibilitaIva: 100, deducibilitaCosto: 75 },
  { label: "Spesa di rappresentanza (clienti, eventi)", codice: "RAPPRESENTANZA", detraibilitaIva: 0, deducibilitaCosto: 75 },
];

type TipoAttivita = "SRL" | "SRLS" | "SNC" | "SAS" | "STP" | "DITTA_INDIVIDUALE" | "LIBERO_PROFESSIONISTA" | "AGENTE_COMMERCIO";
type RegimeFiscale = "ORDINARIO" | "FORFETTARIO";

export function getCategorieDefault(tipoAttivita: TipoAttivita, regimeFiscale: RegimeFiscale): CategoriaDefault[] {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const isForfettario = regimeFiscale === "FORFETTARIO";

  const opzioniAuto = isAgente ? OPZIONI_AUTO_AGENTE : OPZIONI_AUTO_STANDARD;
  const dedAutoMisto = isAgente ? 80 : 20;

  // Categorie base (valide per tutti i regimi ordinari)
  const categorie: CategoriaDefault[] = [
    // --- Auto ---
    {
      nome: "Carburante auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: isAgente ? "Art. 164 TUIR - Agente di commercio" : "Art. 164 comma 1 TUIR - Uso promiscuo",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Manutenzione auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: "Riparazioni, tagliandi, revisioni",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Assicurazione auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: "RC auto, kasko, furto",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Leasing e noleggio auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: isAgente ? "Max deducibile 5.164,57 EUR/anno" : "Max deducibile 3.615,20 EUR/anno",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    // --- Telecomunicazioni ---
    {
      nome: "Telefonia mobile",
      percentualeDeducibilita: 80,
      descrizione: "Abbonamenti e ricariche cellulari",
      tipoCategoria: "Telecomunicazioni",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 50,
      haOpzioniUso: true,
      opzioniUso: OPZIONI_TELEFONIA_MOBILE,
    },
    {
      nome: "Telefonia fissa ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Linea fissa e internet ufficio",
      tipoCategoria: "Telecomunicazioni",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Ufficio ---
    {
      nome: "Cancelleria e materiale ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Carta, toner, penne, materiale di consumo",
      tipoCategoria: "Ufficio",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Mobili e arredi",
      percentualeDeducibilita: 100,
      descrizione: "Scrivanie, sedie, armadi ufficio",
      tipoCategoria: "Ufficio",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- IT ---
    {
      nome: "Software e licenze",
      percentualeDeducibilita: 100,
      descrizione: "Abbonamenti cloud, licenze software",
      tipoCategoria: "IT",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Hardware e computer",
      percentualeDeducibilita: 100,
      descrizione: "PC, stampanti, monitor, periferiche",
      tipoCategoria: "IT",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Immobili ---
    {
      nome: "Affitto ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Canone di locazione ufficio/studio",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Utenze ufficio (luce, gas, acqua)",
      percentualeDeducibilita: 100,
      descrizione: "Bollette utenze dello studio/ufficio",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 10,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Pulizie ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Servizio pulizia locali",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Servizi ---
    {
      nome: "Consulenze professionali",
      percentualeDeducibilita: 100,
      descrizione: "Commercialista, avvocato, consulenti",
      tipoCategoria: "Servizi",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Formazione e aggiornamento professionale",
      percentualeDeducibilita: 100,
      descrizione: "Corsi, seminari, convegni",
      tipoCategoria: "Formazione",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Banca/Assicurazioni (IVA esente) ---
    {
      nome: "Spese bancarie e commissioni",
      percentualeDeducibilita: 100,
      descrizione: "Commissioni bancarie, canoni conto",
      tipoCategoria: "Banca",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Assicurazioni professionali",
      percentualeDeducibilita: 100,
      descrizione: "RC professionale, polizze attivita",
      tipoCategoria: "Assicurazioni",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Marketing/Rappresentanza ---
    {
      nome: "Marketing e pubblicita",
      percentualeDeducibilita: 100,
      descrizione: "Campagne pubblicitarie, sito web, social",
      tipoCategoria: "Marketing",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Spese di rappresentanza",
      percentualeDeducibilita: 75,
      descrizione: "Art. 108 TUIR - Limiti in base ai ricavi",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Omaggi (fino a 50 EUR)",
      percentualeDeducibilita: 100,
      descrizione: "Regali a clienti/fornitori fino a 50 EUR",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Omaggi (oltre 50 EUR)",
      percentualeDeducibilita: 75,
      descrizione: "Regali a clienti/fornitori oltre 50 EUR",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Trasferte ---
    {
      nome: "Viaggi e trasferte",
      percentualeDeducibilita: 100,
      descrizione: "Biglietti treno, aereo, pedaggi",
      tipoCategoria: "Trasferte",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Alberghi e ristoranti",
      percentualeDeducibilita: 75,
      descrizione: "Pasti e pernottamenti",
      tipoCategoria: "Trasferte",
      aliquotaIvaDefault: 10,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: true,
      opzioniUso: OPZIONI_ALBERGHI_RISTORANTI,
    },
  ];

  // Per regime forfettario: azzera tutto IVA
  if (isForfettario) {
    return categorie.map((c) => ({
      ...c,
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    }));
  }

  return categorie;
}
```

**Step 2: Commit**

```bash
git add src/lib/categorie-default.ts
git commit -m "feat: add centralized default categories config with IVA rules per company type"
```

---

### Task 5: Aggiornare API creazione societa

**Files:**
- Modify: `src/app/api/societa/route.ts:6-27` (CATEGORIE_DEFAULT), `src/app/api/societa/route.ts:110-150` (POST handler)

**Step 1: Sostituire CATEGORIE_DEFAULT con import da categorie-default.ts**

Rimuovere l'array CATEGORIE_DEFAULT (lines 6-27). Aggiungere import:
```typescript
import { getCategorieDefault } from "@/lib/categorie-default";
```

**Step 2: Aggiornare il POST handler**

Nella creazione della societa (intorno a line 110), aggiungere `tipoAttivita` e `regimeFiscale` dal body:

```typescript
const { ragioneSociale, partitaIva, codiceFiscaleSocieta, indirizzo, tipoAttivita, regimeFiscale, capitaleSociale, dataCostituzione, socio } = body;
```

Nel `tx.societa.create`, aggiungere:
```typescript
tipoAttivita: tipoAttivita || "SRL",
regimeFiscale: regimeFiscale || "ORDINARIO",
```

Nella creazione categorie, sostituire con:
```typescript
const categorieDefault = getCategorieDefault(
  tipoAttivita || "SRL",
  regimeFiscale || "ORDINARIO"
);

await tx.categoriaSpesa.createMany({
  data: categorieDefault.map((c) => ({
    societaId: nuovaSocieta.id,
    nome: c.nome,
    percentualeDeducibilita: c.percentualeDeducibilita,
    descrizione: c.descrizione || null,
    tipoCategoria: c.tipoCategoria,
    aliquotaIvaDefault: c.aliquotaIvaDefault,
    percentualeDetraibilitaIva: c.percentualeDetraibilitaIva,
    haOpzioniUso: c.haOpzioniUso,
    opzioniUso: c.opzioniUso,
  })),
});
```

**Step 3: Commit**

```bash
git add src/app/api/societa/route.ts
git commit -m "feat: use centralized category config with IVA rules in company creation"
```

---

### Task 6: Aggiornare wizard creazione societa (frontend)

**Files:**
- Modify: `src/app/crea-societa/page.tsx:352-451` (step 1 form), `src/app/crea-societa/page.tsx:262-276` (validation), `src/app/crea-societa/page.tsx:310-329` (API call)

**Step 1: Aggiungere stato per tipoAttivita e regimeFiscale**

Aggiungere ai campi del form (nella sezione state):
```typescript
const [tipoAttivita, setTipoAttivita] = useState("SRL");
const [regimeFiscale, setRegimeFiscale] = useState("ORDINARIO");
```

**Step 2: Aggiungere i campi UI nello step 1**

Dopo il campo indirizzo e prima di regime fiscale, aggiungere select "Tipo attivita":

```tsx
<div className="space-y-2">
  <Label htmlFor="tipoAttivita">Tipo attivita *</Label>
  <Select value={tipoAttivita} onValueChange={(val) => {
    setTipoAttivita(val);
    // Le societa di capitali/persone sono sempre ordinarie
    if (["SRL", "SRLS", "SNC", "SAS", "STP"].includes(val)) {
      setRegimeFiscale("ORDINARIO");
    }
  }}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="SRL">SRL / SRLS</SelectItem>
      <SelectItem value="SNC">SNC</SelectItem>
      <SelectItem value="SAS">SAS</SelectItem>
      <SelectItem value="STP">STP (Societa tra professionisti)</SelectItem>
      <SelectItem value="DITTA_INDIVIDUALE">Ditta individuale</SelectItem>
      <SelectItem value="LIBERO_PROFESSIONISTA">Libero professionista</SelectItem>
      <SelectItem value="AGENTE_COMMERCIO">Agente di commercio</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Sostituire il campo regime fiscale (da text input a select condizionale):

```tsx
{["DITTA_INDIVIDUALE", "LIBERO_PROFESSIONISTA", "AGENTE_COMMERCIO"].includes(tipoAttivita) && (
  <div className="space-y-2">
    <Label htmlFor="regimeFiscale">Regime fiscale *</Label>
    <Select value={regimeFiscale} onValueChange={setRegimeFiscale}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="ORDINARIO">Ordinario</SelectItem>
        <SelectItem value="FORFETTARIO">Forfettario</SelectItem>
      </SelectContent>
    </Select>
  </div>
)}
```

**Step 3: Aggiornare il payload API**

Nel body della chiamata POST, aggiungere `tipoAttivita` e `regimeFiscale`.

**Step 4: Aggiornare il riepilogo (step 3)**

Mostrare tipo attivita e regime fiscale nel riepilogo prima della conferma.

**Step 5: Commit**

```bash
git add src/app/crea-societa/page.tsx
git commit -m "feat: add company type and fiscal regime selection to creation wizard"
```

---

### Task 7: API preferenze uso categoria

**Files:**
- Create: `src/app/api/preferenze-uso/route.ts`

**Step 1: Creare endpoint GET e PUT per le preferenze**

```typescript
// GET: recupera tutte le preferenze dell'utente
// PUT: aggiorna/crea una preferenza (upsert)
// Body: { categoriaId: number, opzioneUso: string }
```

L'endpoint deve:
- GET: restituire tutte le preferenze dell'utente corrente
- PUT: fare un upsert sulla tabella PreferenzaUsoCategoria

**Step 2: Commit**

```bash
git add src/app/api/preferenze-uso/route.ts
git commit -m "feat: add API endpoint for usage preference per category"
```

---

### Task 8: Aggiornare fetch categorie per il form operazioni

**Files:**
- Modify: `src/app/operazioni/nuova/page.tsx:9-42`
- Modify: `src/app/operazioni/[id]/page.tsx:21-51`

**Step 1: Estendere il select delle categorie**

Aggiungere i nuovi campi IVA al fetch delle categorie:

```typescript
const categorie = await prisma.categoriaSpesa.findMany({
  where: { societaId: user.societaId!, attiva: true },
  orderBy: { nome: "asc" },
  select: {
    id: true,
    nome: true,
    percentualeDeducibilita: true,
    aliquotaIvaDefault: true,
    percentualeDetraibilitaIva: true,
    haOpzioniUso: true,
    opzioniUso: true,
  },
});
```

Serializzare i nuovi Decimal:
```typescript
const serializedCategorie = categorie.map((c) => ({
  id: c.id,
  nome: c.nome,
  percentualeDeducibilita: Number(c.percentualeDeducibilita),
  aliquotaIvaDefault: Number(c.aliquotaIvaDefault),
  percentualeDetraibilitaIva: Number(c.percentualeDetraibilitaIva),
  haOpzioniUso: c.haOpzioniUso,
  opzioniUso: c.opzioniUso,
}));
```

**Step 2: Fetch delle preferenze uso e del regime fiscale**

Aggiungere fetch delle preferenze utente e del regime fiscale della societa:

```typescript
const [soci, categorie, preferenzeUso, societa] = await Promise.all([
  // ... existing soci fetch
  // ... existing categorie fetch
  prisma.preferenzaUsoCategoria.findMany({
    where: { userId: user.id as number },
  }),
  prisma.societa.findFirst({
    where: { id: user.societaId! },
    select: { regimeFiscale: true, tipoAttivita: true },
  }),
]);
```

Passare al form component: `preferenzeUso`, `regimeFiscale`, `tipoAttivita`.

**Step 3: Fare lo stesso per la pagina di modifica**

Applicare le stesse modifiche a `src/app/operazioni/[id]/page.tsx`.

**Step 4: Commit**

```bash
git add src/app/operazioni/nuova/page.tsx src/app/operazioni/[id]/page.tsx
git commit -m "feat: pass IVA category fields and usage preferences to operation form"
```

---

### Task 9: Aggiornare operazione-form.tsx - Logica IVA automatica

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`

Questo e il task piu corposo. Il form deve:

**Step 1: Aggiornare i props e i tipi**

Aggiungere ai props del componente:
- `preferenzeUso`: array di { categoriaId, opzioneUso }
- `regimeFiscale`: string ("ORDINARIO" | "FORFETTARIO")

Aggiornare il tipo Categoria per includere i nuovi campi IVA.

**Step 2: Aggiungere stato per opzione uso**

```typescript
const [opzioneUso, setOpzioneUso] = useState<string | null>(null);
const [ivaCustom, setIvaCustom] = useState(false); // override manuale IVA
```

**Step 3: Auto-selezionare aliquota IVA e detraibilita quando cambia categoria**

Quando l'utente seleziona una categoria:
- Se regime forfettario: nascondere sezione IVA
- Se la categoria ha opzioni uso: mostrare toggle, pre-selezionare dall'ultima preferenza
- Impostare aliquotaIva dal campo `aliquotaIvaDefault` della categoria
- Impostare detraibilitaIva dal campo `percentualeDetraibilitaIva` della categoria
- Se c'e un'opzione uso selezionata: sovrascrivere detraibilitaIva e deducibilitaCosto dall'opzione

**Step 4: Calcolo IVA detraibile/indetraibile**

```typescript
const calcoloIvaCompleto = useMemo(() => {
  if (!ivaApplicabile || regimeFiscale === "FORFETTARIO") return null;
  const totale = parseFloat(importoTotale) || 0;
  const aliquota = parseFloat(aliquotaIva) || 0;
  if (totale <= 0) return null;

  const imponibile = aliquota > 0
    ? Math.round((totale / (1 + aliquota / 100)) * 100) / 100
    : totale;
  const ivaTotale = Math.round((totale - imponibile) * 100) / 100;

  const percDetraibilita = parseFloat(String(percentualeDetraibilitaIva)) || 0;
  const ivaDetraibile = Math.round((ivaTotale * percDetraibilita / 100) * 100) / 100;
  const ivaIndetraibile = Math.round((ivaTotale - ivaDetraibile) * 100) / 100;

  return { imponibile, ivaTotale, ivaDetraibile, ivaIndetraibile };
}, [importoTotale, aliquotaIva, percentualeDetraibilitaIva, ivaApplicabile, regimeFiscale]);
```

**Step 5: Ricalcolare base deducibilita includendo IVA indetraibile**

```typescript
const baseDeducibilita = useMemo(() => {
  if (!ivaApplicabile || !calcoloIvaCompleto) return parseFloat(importoTotale) || 0;
  // Imponibile + IVA indetraibile = costo fiscale
  return calcoloIvaCompleto.imponibile + calcoloIvaCompleto.ivaIndetraibile;
}, [ivaApplicabile, calcoloIvaCompleto, importoTotale]);
```

**Step 6: Aggiungere UI toggle opzione uso**

Dopo il select categoria, se `selectedCategoria?.haOpzioniUso`:

```tsx
{selectedCategoria?.haOpzioniUso && selectedCategoria.opzioniUso && (
  <div className="space-y-2">
    <Label>{/* label contestuale, es "Uso del veicolo" */}</Label>
    <div className="flex gap-2">
      {(selectedCategoria.opzioniUso as OpzioneUso[]).map((opt) => (
        <Button
          key={opt.codice}
          type="button"
          variant={opzioneUso === opt.codice ? "default" : "outline"}
          onClick={() => handleOpzioneUsoChange(opt.codice)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  </div>
)}
```

**Step 7: Aggiungere UI riepilogo fiscale**

Sostituire la sezione IVA attuale con il riepilogo completo (imponibile, IVA totale, IVA detraibile, IVA indetraibile, costo fiscale, importo deducibile).

**Step 8: Aggiungere link "Modifica IVA manualmente"**

Mostra/nasconde i campi di override: select aliquota IVA + input % detraibilita.

**Step 9: Salvare preferenza uso**

Quando l'utente cambia opzione uso, fare PUT a `/api/preferenze-uso`.

**Step 10: Aggiornare payload di submit**

Aggiungere al payload: `percentualeDetraibilitaIva`, `ivaDetraibile`, `ivaIndetraibile`, `opzioneUso`.

**Step 11: Commit**

```bash
git add src/app/operazioni/operazione-form.tsx
git commit -m "feat: automatic IVA calculation with usage toggle and fiscal summary in operation form"
```

---

### Task 10: Aggiornare API operazioni (POST e PUT)

**Files:**
- Modify: `src/app/api/operazioni/route.ts` (POST)
- Modify: `src/app/api/operazioni/[id]/route.ts` (PUT)

**Step 1: Aggiungere campi al destructuring del body**

```typescript
const {
  // ... existing fields
  percentualeDetraibilitaIva,
  ivaDetraibile,
  ivaIndetraibile,
  opzioneUso,
} = body;
```

**Step 2: Aggiungere campi al create/update data**

```typescript
percentualeDetraibilitaIva: percentualeDetraibilitaIva != null ? parseFloat(String(percentualeDetraibilitaIva)) : null,
ivaDetraibile: ivaDetraibile != null ? parseFloat(String(ivaDetraibile)) : null,
ivaIndetraibile: ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : null,
opzioneUso: opzioneUso || null,
```

**Step 3: Aggiornare serializzazione nelle risposte GET**

Aggiungere serializzazione dei nuovi Decimal nei response di GET (sia lista che singolo).

**Step 4: Commit**

```bash
git add src/app/api/operazioni/route.ts src/app/api/operazioni/[id]/route.ts
git commit -m "feat: handle IVA deductibility fields in operation CRUD APIs"
```

---

### Task 11: Aggiornare gestione categorie (configurazione)

**Files:**
- Modify: `src/app/configurazione/categorie/categorie-table.tsx`
- Modify: `src/app/api/categorie-spesa/route.ts`
- Modify: `src/app/api/categorie-spesa/[id]/route.ts`

**Step 1: Estendere il form di creazione/modifica categoria**

Aggiungere campi:
- Aliquota IVA default (select: 22%, 10%, 5%, 4%, 0%, oppure input custom)
- % Detraibilita IVA (input 0-100)
- Toggle "Ha opzioni uso" (checkbox)
- Configurazione opzioni uso (UI per aggiungere/modificare opzioni, visibile solo se toggle attivo)

**Step 2: Aggiornare API categorie**

Accettare e salvare i nuovi campi nel POST e PUT.
Restituire i nuovi campi nel GET (serializzare Decimal).

**Step 3: Aggiornare la tabella categorie**

Mostrare colonne aggiuntive: aliquota IVA, detraibilita IVA, badge "opzioni uso".

**Step 4: Commit**

```bash
git add src/app/configurazione/categorie/ src/app/api/categorie-spesa/
git commit -m "feat: add IVA configuration fields to category management UI"
```

---

### Task 12: Migrazione dati esistenti

**Files:**
- Create: `prisma/migrations/XXXXXXXX_migrate_existing_data/migration.sql` (oppure script separato)
- Create: `scripts/migrate-iva-data.ts`

**Step 1: Creare script di migrazione**

Lo script deve:
1. Aggiornare Clever: `tipoAttivita = 'SRL'`, `regimeFiscale = 'ORDINARIO'`
2. Aggiornare le categorie esistenti di Clever con i nuovi campi IVA (match per nome)
3. Ricalcolare le operazioni COSTO/CESPITE esistenti:
   - Per ogni operazione senza `percentualeDetraibilitaIva`:
     - Recuperare la categoria associata
     - Applicare aliquotaIva (default 22% se non presente)
     - Calcolare imponibile, ivaTotale, ivaDetraibile, ivaIndetraibile
     - Ricalcolare importoDeducibile = (imponibile + ivaIndetraibile) * percentualeDeducibilita / 100

```typescript
// scripts/migrate-iva-data.ts
import { prisma } from "../src/lib/prisma";
import { getCategorieDefault } from "../src/lib/categorie-default";

async function migrate() {
  // 1. Aggiorna societa Clever
  const societa = await prisma.societa.findFirst();
  if (!societa) return;

  await prisma.societa.update({
    where: { id: societa.id },
    data: { tipoAttivita: "SRL", regimeFiscale: "ORDINARIO" },
  });

  // 2. Aggiorna categorie con campi IVA
  const categorieDefault = getCategorieDefault("SRL", "ORDINARIO");
  const categorieEsistenti = await prisma.categoriaSpesa.findMany({
    where: { societaId: societa.id },
  });

  for (const catDefault of categorieDefault) {
    const existing = categorieEsistenti.find((c) => c.nome === catDefault.nome);
    if (existing) {
      await prisma.categoriaSpesa.update({
        where: { id: existing.id },
        data: {
          aliquotaIvaDefault: catDefault.aliquotaIvaDefault,
          percentualeDetraibilitaIva: catDefault.percentualeDetraibilitaIva,
          haOpzioniUso: catDefault.haOpzioniUso,
          opzioniUso: catDefault.opzioniUso,
        },
      });
    } else {
      // Crea categorie nuove che non esistevano
      await prisma.categoriaSpesa.create({
        data: {
          societaId: societa.id,
          nome: catDefault.nome,
          percentualeDeducibilita: catDefault.percentualeDeducibilita,
          descrizione: catDefault.descrizione,
          tipoCategoria: catDefault.tipoCategoria,
          aliquotaIvaDefault: catDefault.aliquotaIvaDefault,
          percentualeDetraibilitaIva: catDefault.percentualeDetraibilitaIva,
          haOpzioniUso: catDefault.haOpzioniUso,
          opzioniUso: catDefault.opzioniUso,
        },
      });
    }
  }

  // 3. Ricalcola operazioni esistenti
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId: societa.id,
      eliminato: false,
      tipoOperazione: { in: ["COSTO", "CESPITE"] },
    },
    include: { categoria: true },
  });

  for (const op of operazioni) {
    const aliquota = op.aliquotaIva ? Number(op.aliquotaIva) : 22;
    const totale = Number(op.importoTotale);
    const imponibile = aliquota > 0
      ? Math.round((totale / (1 + aliquota / 100)) * 100) / 100
      : totale;
    const ivaTotale = Math.round((totale - imponibile) * 100) / 100;

    const percDetraibilita = Number(op.categoria.percentualeDetraibilitaIva);
    const ivaDetraibile = Math.round((ivaTotale * percDetraibilita / 100) * 100) / 100;
    const ivaIndetraibile = Math.round((ivaTotale - ivaDetraibile) * 100) / 100;

    // Costo fiscale = imponibile + IVA indetraibile
    const costoFiscale = imponibile + ivaIndetraibile;
    const percDeduc = Number(op.percentualeDeducibilita);
    const importoDeducibile = Math.round((costoFiscale * percDeduc / 100) * 100) / 100;

    await prisma.operazione.update({
      where: { id: op.id },
      data: {
        aliquotaIva: aliquota,
        importoImponibile: imponibile,
        importoIva: ivaTotale,
        percentualeDetraibilitaIva: percDetraibilita,
        ivaDetraibile,
        ivaIndetraibile,
        importoDeducibile,
      },
    });
  }

  console.log(`Migrazione completata: ${operazioni.length} operazioni aggiornate`);
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
```

**Step 2: Eseguire lo script**

```bash
npx tsx scripts/migrate-iva-data.ts
```

**Step 3: Commit**

```bash
git add scripts/migrate-iva-data.ts
git commit -m "feat: migration script to populate IVA data for existing company and operations"
```

---

### Task 13: Aggiornare seed.ts

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Usare getCategorieDefault nel seed**

Sostituire l'array di categorie hardcoded con import da `categorie-default.ts`.

**Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: use centralized category config in seed data"
```

---

### Task 14: Verifica finale e test manuale

**Step 1: Avviare l'app**

```bash
npm run dev -- -p 8080
```

**Step 2: Verificare**

- [ ] Creazione nuova societa con tipo attivita e regime fiscale
- [ ] Categorie generate correttamente con campi IVA
- [ ] Form operazione: selezione categoria auto-compila IVA
- [ ] Toggle uso per categorie auto/telefonia/alberghi
- [ ] Preferenza uso salvata e ricaricata
- [ ] Override manuale IVA funzionante
- [ ] Regime forfettario nasconde sezione IVA
- [ ] Riepilogo fiscale corretto (imponibile, IVA detr/indetr, costo deducibile)
- [ ] Operazioni esistenti ricalcolate correttamente

**Step 3: Commit finale**

```bash
git add -A
git commit -m "feat: complete automatic IVA management with fiscal rules per company type"
```
