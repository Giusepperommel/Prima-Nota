# Design Spec: Simulazione Cassa

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Aggiungere alla dashboard una sezione "Simulazione Cassa" che mostra il flusso di cassa reale della società, partendo dal capitale sociale come saldo iniziale. Contestualmente, aggiungere tre nuovi tipi di operazione (pagamento imposte, distribuzione dividendi, compenso amministratore) per registrare movimenti finanziari che oggi non è possibile tracciare.

---

## 1. Nuovi Tipi di Operazione

### 1.1 Enum TipoOperazione — nuovi valori

Aggiungere al campo `tipoOperazione` del modello `Operazione` in Prisma:

| Valore | Descrizione | Segno cassa |
|--------|-------------|-------------|
| `PAGAMENTO_IMPOSTE` | Versamento di imposte/contributi all'erario o enti previdenziali | Uscita |
| `DISTRIBUZIONE_DIVIDENDI` | Distribuzione di utili ai soci | Uscita |
| `COMPENSO_AMMINISTRATORE` | Compenso corrisposto all'amministratore | Uscita |

### 1.2 Nuovo campo — sottotipoOperazione

Aggiungere campo opzionale `sottotipoOperazione String?` al modello `Operazione`. Il tipo è `String?` (non enum) per evitare una migrazione aggiuntiva; la validità del valore è verificata a livello API (see §1.8).

Per `PAGAMENTO_IMPOSTE`, i valori consentiti sono:

| Valore | Descrizione |
|--------|-------------|
| `IVA` | Liquidazione IVA (mensile o trimestrale) |
| `IRES_ACCONTO` | Acconto IRES (giugno / novembre) |
| `IRES_SALDO` | Saldo IRES annuale |
| `IRAP_ACCONTO` | Acconto IRAP |
| `IRAP_SALDO` | Saldo IRAP |
| `INPS` | Contributi INPS soci lavoratori |

Per `DISTRIBUZIONE_DIVIDENDI` e `COMPENSO_AMMINISTRATORE` il campo è sempre `null`.

### 1.3 categoriaId — campo reso nullable

Il campo `categoriaId` del modello `Operazione` (e `OperazioneRicorrente`) è attualmente `Int` (non-nullable). Poiché i tre nuovi tipi di operazione non hanno una categoria di spesa applicabile, il campo viene reso opzionale: `categoriaId Int? @map("categoria_id")`.

Impatto downstream:
- Tutti i `include: { categoria: true }` nei GET diventano `include: { categoria: { select: {...} } }` con null-safe access (`op.categoria?.nome ?? "—"`).
- Le route report (rendiconto, stima-fiscale) già filtrano per tipoOperazione specifico, quindi non incontrano mai le nuove operazioni e non richiedono modifiche.
- Il form mostra il campo categoria solo per FATTURA_ATTIVA, COSTO, CESPITE; lo nasconde per i 3 nuovi tipi.
- La validazione API accetta `categoriaId = null` solo per i 3 nuovi tipi.

### 1.4 importoDeducibile e percentualeDeducibilita

I campi `importoDeducibile` e `percentualeDeducibilita` sono `Decimal` non-nullable nel modello `Operazione`. Per i 3 nuovi tipi vengono salvati sempre a `0` (nessuna deducibilità fiscale applicabile). L'API li imposta a `0` senza validarli dal form.

### 1.5 Comportamento fiscale dei nuovi tipi

- **Nessuna IVA**: `aliquotaIva = null`, `importoImponibile = null`, `importoIva = null`, `ivaDetraibile = null`, `ivaIndetraibile = null`.
- **Esclusi dai calcoli fiscali**: non contribuiscono a fatturato, costi, utile nei report (rendiconto, stima fiscale, KPI). I report filtrano esplicitamente per `tipoOperazione IN [FATTURA_ATTIVA, COSTO, CESPITE]`.
- **IVA route (`/api/report/iva`)**: l'`else` branch legge `ivaDetraibile`/`ivaIndetraibile` che per i nuovi tipi sono `null`. `Number(null) || 0 = 0`, quindi aggiunge `0` a `ivaCredito` e `mensileCredito` — comportamento corretto per design. Confermato sicuro: la route restituisce solo totali aggregati mensili, non una lista di singole operazioni, quindi i nuovi tipi non appaiono come voci individuali nel Riepilogo IVA. Non serve modificare la route. L'indicatore "IVA versata" da `PAGAMENTO_IMPOSTE/IVA` è **out of scope** per questa release e non viene implementato nel Riepilogo IVA.
- **Ripartizione tra soci**: supportata e obbligatoria per tutti e tre i nuovi tipi (la sezione ripartizione è sempre visibile nel form e viene sempre salvata). Poiché `importoImponibile` è sempre `null` per i nuovi tipi, la base di calcolo delle ripartizioni (`importoPerRipartizione`) è `importoTotale` — questo avviene automaticamente tramite il fallback `importoImponibile != null ? ... : importo` già presente nelle route POST e PUT.

### 1.6 Operazioni ricorrenti — nuovi tipi esclusi

I tre nuovi tipi **non possono essere usati come operazioni ricorrenti**. Il form nasconde il toggle "Operazione ricorrente" quando tipoOperazione è uno dei tre nuovi valori. `OperazioneRicorrente` mantiene `categoriaId Int` non-nullable e non viene modificato.

### 1.7 Form operazioni — modifiche

Il dropdown `tipoOperazione` mostra i tre nuovi valori in un gruppo separato "Movimenti Finanziari", distinto da "Operazioni" (fatture, costi, cespiti).

Quando si seleziona `PAGAMENTO_IMPOSTE`, appare un campo select "Tipo imposta" obbligatorio con i 6 sottotipi descritti in §1.2. Il campo è validato lato client e lato API.

I campi IVA, detraibilità, deducibilità, cespite, categorie e operazione ricorrente sono nascosti per i 3 nuovi tipi. La sezione ripartizione soci è sempre visibile.

### 1.8 Validazione API (POST e PUT operazioni)

**Modifica alla whitelist `tipiValidi`** (entrambe le route):

L'array attuale `["FATTURA_ATTIVA", "COSTO", "CESPITE"]` rifiuta i nuovi tipi prima di ogni altra verifica. Estendere a:
```typescript
const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE", "PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
```

**Modifica al guard dei campi obbligatori** (entrambe le route):

Il controllo `if (!tipoOperazione || !dataOperazione || !descrizione || !categoriaId)` attuale rifiuta richieste con `categoriaId` falsy. Deve diventare:
```typescript
const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
const isTipoFinanziario = TIPI_FINANZIARI.includes(tipoOperazione);
if (!tipoOperazione || !dataOperazione || !descrizione || (!isTipoFinanziario && !categoriaId)) {
  return 400;
}
```

**Validazione categoriaSpesa**: il `prisma.categoriaSpesa.findFirst` (che dereferenzia `categoriaId`) deve essere eseguito solo se `!isTipoFinanziario`. Il blocco `if (!categoria) return 400` che segue deve essere anch'esso condizionale.

**Calcolo `percDeduc`/`impDeduc`**: entrambi i campi devono essere `0` per i nuovi tipi, saltando il blocco che legge `categoria.percentualeDeducibilita`:
```typescript
const percDeduc = isTipoFinanziario ? 0 : (deducibilitaCustom ? ... : Number(categoria.percentualeDeducibilita));
const impDeduc = isTipoFinanziario ? 0 : (deducibilitaCustom ? ... : Math.round(...));
```

**`categoriaId` nella scrittura DB**: nel `prisma.operazione.create`/`update`, usare:
```typescript
categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
```
Lo stesso vale per il campo `categoriaId` nel payload di `logAttivita`.

**Regole aggiuntive** per i nuovi tipi:
- Se `tipoOperazione IN [PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE]`:
  - `categoriaId` deve essere `null` (o assente) — rifiutare 400 se presente
  - `importoDeducibile = 0`, `percentualeDeducibilita = 0` (impostati dall'API, non dal form)
  - Tutti i campi IVA devono essere `null`
  - `isRicorrente` deve essere `false`
- Se `tipoOperazione === PAGAMENTO_IMPOSTE`:
  - `sottotipoOperazione` deve essere uno dei 6 valori consentiti (§1.2); altrimenti 400
- Se `tipoOperazione IN [DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE]`:
  - `sottotipoOperazione` deve essere `null`

### 1.9 Lista operazioni — badge

I nuovi tipi appaiono con badge di colore distinto nella lista operazioni:
- `PAGAMENTO_IMPOSTE`: arancione (`bg-orange-100 text-orange-800`)
- `DISTRIBUZIONE_DIVIDENDI`: viola (`bg-purple-100 text-purple-800`)
- `COMPENSO_AMMINISTRATORE`: azzurro (`bg-sky-100 text-sky-800`)

---

## 2. Simulazione Cassa nella Dashboard

### 2.1 Posizione

Nuova sezione in fondo alla pagina `dashboard-content.tsx`, dopo "Ripartizione per Socio" e prima di "Ultime Operazioni". Titolo: **"Simulazione Cassa"**, con selettore anno indipendente (default: anno corrente).

### 2.2 Calcolo del saldo

**Filtro bozze**: il filtro `bozza: false` si applica sia al calcolo del saldo iniziale sugli anni precedenti, sia ai mesi dell'anno corrente.

**Saldo iniziale dell'anno** = capitale sociale + net cash flow cumulativo di tutti gli anni precedenti all'anno selezionato:

```
saldoInizioAnno = (capitaleSociale ?? 0) + Σ(anni < annoSelezionato) netCashFlow(anno)
netCashFlow(anno) = Σ importoTotale FATTURA_ATTIVA − Σ importoTotale (COSTO + CESPITE + PAGAMENTO_IMPOSTE + DISTRIBUZIONE_DIVIDENDI + COMPENSO_AMMINISTRATORE)
```

Se `capitaleSociale` è `null` nel DB (campo `Decimal?`), viene trattato come `0`.

**Saldo progressivo mensile**: per ogni mese M dell'anno selezionato:
```
saldoFineM = saldoInizioAnno + Σ(mesi 1..M) entrate − Σ(mesi 1..M) uscite
```

**Entrate** = `importoTotale` delle FATTURA_ATTIVA (lordo IVA inclusa).
**Uscite** = `importoTotale` di COSTO + CESPITE + PAGAMENTO_IMPOSTE + DISTRIBUZIONE_DIVIDENDI + COMPENSO_AMMINISTRATORE.

L'IVA è gestita correttamente: entra con la fattura attiva (+importoTotale incluso IVA), esce con il pagamento IVA (−importoTotale del PAGAMENTO_IMPOSTE sottotipo IVA).

### 2.3 Visibilità per ruolo

**ADMIN**: cash flow calcolato su tutti i movimenti della società (`importoTotale` diretto).

**STANDARD**: cash flow calcolato sulla propria quota di partecipazione:
- Per ogni operazione, l'importo è `importoCalcolato` dalla `RipartizioneOperazione` del socio.
- Se per una determinata operazione non esiste una `RipartizioneOperazione` per questo socio (es. ripartizione SINGOLO assegnata ad altro socio), l'importo è `0`.
- Il `saldoIniziale` per STANDARD è calcolato con la stessa logica dei segni: `(capitaleSociale ?? 0) × (quota% / 100)` + Σ(anni < annoSelezionato) [ Σ `importoCalcolato` dove `tipoOperazione = FATTURA_ATTIVA` − Σ `importoCalcolato` dove `tipoOperazione IN [COSTO, CESPITE, PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE]` ].
- Per `PAGAMENTO_IMPOSTE`, `DISTRIBUZIONE_DIVIDENDI`, `COMPENSO_AMMINISTRATORE`: l'importo del socio è sempre tramite `importoCalcolato` (ripartizione obbligatoria, §1.5). Se un pagamento imposte non è stato ripartito al socio, sarà €0 nella sua vista — questo è il comportamento atteso (la società potrebbe aver pagato solo la quota di un socio).

### 2.4 UI — componenti

**Card riepilogative (4, in griglia):**
1. Saldo Iniziale Anno — valore a inizio anno (grigio/neutro)
2. Entrate Lorde — totale FATTURA_ATTIVA anno (verde)
3. Uscite Lorde — totale uscite anno (rosso)
4. Saldo Finale Anno — saldo a fine anno, verde se positivo / rosso se negativo

**Grafico a linea (Recharts `LineChart`):**
- X: mesi (Gen–Dic)
- Y: saldo di cassa progressivo (parte dal saldo iniziale, non da zero)
- Una linea (blu/indaco) con tooltip che mostra il saldo a fine mese e le entrate/uscite del mese
- `ReferenceLine` orizzontale tratteggiata a €0
- Area colorata sotto la linea tramite `defs` + `linearGradient`

**Tabella breakdown uscite:**
Sotto il grafico, tabella compatta con righe per categoria di uscita:

| Categoria | Importo |
|-----------|---------|
| Costi operativi (COSTO) | €X |
| Cespiti (CESPITE) | €X |
| Imposte pagate (PAGAMENTO_IMPOSTE) | €X |
| Dividendi distribuiti (DISTRIBUZIONE_DIVIDENDI) | €X |
| Compensi amministratore (COMPENSO_AMMINISTRATORE) | €X |

**Empty state**: se non esistono movimenti per l'anno selezionato, mostrare un messaggio "Nessun movimento registrato per questo anno".

### 2.5 Esclusione bozze

Le operazioni con `bozza: true` sono escluse dal calcolo sia nell'anno corrente sia negli anni precedenti per il saldo iniziale.

---

## 3. API — nuovo endpoint

### `GET /api/dashboard/cassa?anno=YYYY`

Parametri: `anno` (intero, obbligatorio).

**Response:**
```typescript
{
  anno: number;
  saldoIniziale: number;           // capitale sociale + net cash flow anni precedenti (bozze escluse)
  mensile: Array<{
    mese: number;                  // 1-12
    meseLabel: string;             // "Gen", "Feb", ...
    entrate: number;               // FATTURA_ATTIVA importoTotale
    uscite: number;                // somma tutte le uscite
    usciteDettaglio: {
      costiOperativi: number;      // COSTO
      cespiti: number;             // CESPITE
      imposte: number;             // PAGAMENTO_IMPOSTE
      dividendi: number;           // DISTRIBUZIONE_DIVIDENDI
      compensiAmm: number;         // COMPENSO_AMMINISTRATORE
    };
    saldoProgressivo: number;      // cumulativo a fine mese (include saldoIniziale)
  }>;
  totali: {
    entrate: number;
    uscite: number;
    saldoFinale: number;           // = saldoIniziale + totali.entrate - totali.uscite
  };
}
```

**Logica ADMIN**: usa `importoTotale` diretto da `Operazione`.
**Logica STANDARD**: usa `importoCalcolato` da `RipartizioneOperazione` per il socio corrente. Il `saldoIniziale` è calcolato come:
```
saldoIniziale_STANDARD = (capitaleSociale ?? 0) × (quota% / 100)
  + Σ(anni < annoSelezionato) [
      Σ importoCalcolato WHERE tipoOperazione = FATTURA_ATTIVA
    − Σ importoCalcolato WHERE tipoOperazione IN [COSTO, CESPITE, PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE]
  ]
```

---

## 4. Modifiche al DB (Prisma schema)

```prisma
// 1. Aggiornare enum TipoOperazione:
enum TipoOperazione {
  FATTURA_ATTIVA
  COSTO
  CESPITE
  PAGAMENTO_IMPOSTE        // nuovo
  DISTRIBUZIONE_DIVIDENDI  // nuovo
  COMPENSO_AMMINISTRATORE  // nuovo
}

// 2. Aggiungere al modello Operazione:
sottotipoOperazione  String?   @map("sottotipo_operazione")

// 3. Rendere nullable categoriaId in Operazione:
categoriaId          Int?      @map("categoria_id")
// (OperazioneRicorrente mantiene categoriaId Int non-nullable — invariato)
```

Migration: `prisma migrate dev --name add-tipi-finanziari`.

---

## 5. File impattati

| File | Modifica |
|------|----------|
| `prisma/schema.prisma` | Nuovo enum values, `sottotipoOperazione`, `categoriaId Int?` in Operazione |
| `src/app/operazioni/operazione-form.tsx` | Nuovi tipi nel dropdown, campo sottotipo, nascondi categoria/IVA/ricorrenza |
| `src/app/operazioni/operazioni-list.tsx` | Null-safe `op.categoria?.nome`, nuovi badge |
| `src/app/api/operazioni/route.ts` | Validazione nuovi tipi, `categoriaId` nullable, POST |
| `src/app/api/operazioni/[id]/route.ts` (PUT) | Validazione nuovi tipi, `categoriaId` nullable |
| `src/app/api/operazioni/[id]/route.ts` (GET) | Null-guard serializzazione categoria: `categoria: operazione.categoria ? { ...operazione.categoria, percentualeDeducibilita: Number(operazione.categoria.percentualeDeducibilita) } : null` |
| `src/app/api/report/rendiconto/route.ts` | Nel loop `dettaglioPerCategoria` aggiungere `if (!op.categoria) continue;` prima di accedere a `op.categoria.nome` (i nuovi tipi finanziari avranno `categoria = null` e non contribuiscono al dettaglio per categoria) |
| `src/app/api/dashboard/cassa/route.ts` | **Nuovo** endpoint cash flow |
| `src/app/dashboard/dashboard-content.tsx` | Nuova sezione Simulazione Cassa |

**Non impattati:**
- `src/app/api/report/kpi/route.ts`, `src/app/api/report/trend/route.ts`, `src/app/api/report/stima-fiscale/route.ts`: filtrano esplicitamente per `tipoOperazione IN [FATTURA_ATTIVA, COSTO, CESPITE]` e non incontrano mai i nuovi tipi.
- `src/app/api/report/iva/route.ts`: i nuovi tipi hanno IVA null → `Number(null) || 0 = 0` nell'`else` branch, nessun valore errato aggiunto.
- `src/app/api/operazioni-ricorrenti/genera/route.ts`: `OperazioneRicorrente` mantiene `categoriaId Int` non-nullable e i nuovi tipi non possono essere ricorrenti (§1.6), quindi questo route non incontra mai operazioni con `categoria = null`.
- `src/app/api/bozze/route.ts`: il GET serializza `categoria: op.categoria` passandolo direttamente (null-safe). Il POST crea sempre bozze di tipo `COSTO` con una `categoriaId` obbligatoria — non crea mai i nuovi tipi finanziari. Nessuna modifica richiesta.

---

## 6. Out of scope

- Export PDF del cash flow
- Proiezioni future / scenari "what-if"
- Integrazione con conti bancari reali
- "IVA versata" nel Riepilogo IVA (rimandato a release successiva)
- Operazioni ricorrenti per i nuovi tipi
