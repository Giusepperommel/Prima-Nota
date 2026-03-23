# Specifica Tecnica — Sotto-progetto 1: Partita Doppia e Libro Giornale

> **Stato:** Revisione completata — in attesa approvazione utente
> **Data:** 2026-03-21
> **Progetto padre:** Upgrade a contabilita professionale
> **Riferimenti normativi:** `docs/normativa/partita-doppia-riferimenti.md`

---

## 1. Contesto e Obiettivo

Il software Prima Nota gestisce attualmente le operazioni contabili come registrazioni singole (prima nota semplice). Per diventare un sistema di contabilita professionale, serve la **partita doppia**: ogni operazione deve generare scritture contabili con righe dare/avere collegate al Piano dei Conti, permettendo la produzione del Libro Giornale, del Libro Mastro e del Bilancio di Verifica.

**Vincolo fondamentale:** il modello dati attuale (Operazione, Ripartizioni, IVA engine, Cespiti) deve continuare a funzionare. La partita doppia si aggiunge come **layer contabile** sopra le operazioni esistenti, senza rompere nulla.

**Principio delle tre modalita:**
- **Semplice:** la partita doppia e invisibile, generata in background
- **Avanzata:** le scritture sono visibili in sola lettura
- **Commercialista:** controllo totale — modifica scritture auto, creazione scritture manuali

---

## 2. Modello Dati

### 2.1 Nuove tabelle

#### ScritturaContabile

| Campo | Tipo | Note |
|---|---|---|
| scritturaId | Int @id @default(autoincrement()) | PK |
| societaId | Int | FK → Societa, RLS |
| operazioneId | Int? | FK → Operazione, nullable (scritture manuali) |
| dataRegistrazione | DateTime @db.Date | Data registrazione nel giornale |
| dataCompetenza | DateTime @db.Date | Data competenza economica |
| numeroProtocollo | Int | Progressivo annuale per societa |
| anno | Int | Anno di riferimento |
| descrizione | String @db.VarChar(500) | Causale della scrittura |
| causale | String @db.VarChar(10) | Codice causale (FA, FV, PG, AM, ecc.) |
| tipoScrittura | Enum(AUTO, MANUALE, RETTIFICA, STORNO, CHIUSURA, APERTURA) | |
| stato | Enum(DEFINITIVA, PROVVISORIA) | |
| eliminato | Boolean @default(false) | Soft-delete |
| protocolloIva | Int? | Protocollo IVA se pertinente |
| registroIvaSezionale | String? @db.VarChar(10) | Sezionale IVA (V1, A1, ecc.) |
| totaleDare | Decimal(12,2) | Totale movimenti in dare |
| totaleAvere | Decimal(12,2) | Totale movimenti in avere |
| createdByUserId | Int? | FK → Utente |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

**Indici:**
- `@@unique([societaId, anno, numeroProtocollo])` — protocollo unico per anno/societa
- `@@index([societaId, dataRegistrazione])`
- `@@index([operazioneId])`
- `@@index([societaId, anno, causale])`

#### MovimentoContabile

| Campo | Tipo | Note |
|---|---|---|
| movimentoId | Int @id @default(autoincrement()) | PK |
| scritturaId | Int | FK → ScritturaContabile |
| societaId | Int | FK → Societa (denormalizzato per performance RLS) |
| contoId | Int | FK → PianoDeiConti |
| importoDare | Decimal(12,2) @default(0) | 0 se in avere |
| importoAvere | Decimal(12,2) @default(0) | 0 se in dare |
| descrizione | String? @db.VarChar(255) | Descrizione riga (opzionale) |
| ordine | Int | Ordine visualizzazione |
| updatedAt | DateTime @updatedAt | Per audit trail |

**Indici:**
- `@@index([scritturaId])`
- `@@index([contoId])`
- `@@index([societaId, contoId])` — per Libro Mastro (query per conto filtrate per societa)

#### CausaleContabile (tabella di lookup)

| Campo | Tipo | Note |
|---|---|---|
| codice | String @id @db.VarChar(10) | PK (FA, FV, PG, ecc.) |
| descrizione | String @db.VarChar(100) | Descrizione estesa |
| tipoOperazione | String? @db.VarChar(50) | Tipo operazione associato |
| registroIva | Enum(VENDITE, ACQUISTI, CORRISPETTIVI)? | Registro IVA coinvolto |
| attivo | Boolean @default(true) | |

### 2.2 Modifiche a tabelle esistenti

#### CategoriaSpesa — Aggiunta campo
- `contoDefaultId Int?` — FK → PianoDeiConti — conto contabile di default per questa categoria
- Relazione Prisma: `contoDefault PianoDeiConti? @relation("ContoDefaultCategoria", fields: [contoDefaultId], references: [id])`
- Back-reference su PianoDeiConti: `categorieSpesa CategoriaSpesa[] @relation("ContoDefaultCategoria")`

#### PianoDeiConti — Nessuna modifica strutturale
I saldi (dare/avere) vengono calcolati dinamicamente dalle query sui MovimentiContabili, non duplicati nella tabella. Questo evita problemi di sincronizzazione.

#### Operazione — Campo deprecato
- `codiceContoId` resta nel DB per retrocompatibilita ma non viene piu usato per nuove operazioni. Le scritture contabili gestiscono il collegamento ai conti.

---

## 3. Motore di Generazione Scritture

### 3.1 Architettura

```
src/lib/contabilita/
  ├── motore-scritture.ts          # Orchestratore principale
  ├── conto-resolver.ts            # Risoluzione codice conto
  ├── causali.ts                   # Definizione causali e mapping
  ├── validazione-scrittura.ts     # Quadratura e validazioni
  ├── generatori/
  │   ├── index.ts                 # Registry dei generatori
  │   ├── fattura-attiva.ts        # FV, NCV, NDV, FVS
  │   ├── fattura-passiva.ts       # FA, NCA, NDA
  │   ├── reverse-charge.ts        # FAUE, FARE, TD16-TD19
  │   ├── cespite-acquisto.ts      # Acquisto + setup ammortamento
  │   ├── ammortamento.ts          # Quote annuali
  │   ├── compenso-amministratore.ts
  │   ├── pagamento-imposte.ts     # IRES, IRAP, IVA, ritenute, F24
  │   ├── dividendi.ts
  │   ├── liquidazione-iva.ts
  │   ├── chiusura-esercizio.ts
  │   ├── pagamento.ts             # PG, IN
  │   └── operazione-generica.ts   # OG — libera
  └── __tests__/
      ├── motore-scritture.test.ts
      ├── conto-resolver.test.ts
      └── generatori/              # Un test per ogni generatore
```

### 3.2 Interfacce principali

```typescript
interface GeneraScritturaInput {
  operazione: {
    tipoOperazione: TipoOperazione
    dataOperazione: Date
    descrizione: string
    importoTotale: number
    importoImponibile?: number
    importoIva?: number
    aliquotaIva?: number
    ivaDetraibile?: number
    ivaIndetraibile?: number
    percentualeDetraibilitaIva?: number
    importoDeducibile?: number
    percentualeDeducibilita?: number
    importoRitenuta?: number
    importoNettoRitenuta?: number
    statoPagamentoFattura?: string
    splitPayment?: boolean
    doppiaRegistrazione?: boolean
    bolloVirtuale?: boolean
    importoBollo?: number
    numeroDocumento?: string
  }
  societaId: number
  categoria?: { contoDefaultId?: number }
  anagrafica?: { denominazione: string; nazione: string }
  ivaResult?: {
    naturaIva?: string
    tipoDocumentoSdi?: string
    requiresAutofattura: boolean
    requiresDoppiaRegistrazione: boolean
  }
  modalita: 'SEMPLICE' | 'AVANZATA' | 'COMMERCIALISTA'
  contiEspliciti?: { [ruolo: string]: number }  // solo Commercialista
}

interface ScritturaGenerata {
  descrizione: string
  causale: string
  tipoScrittura: 'AUTO' | 'MANUALE'
  dataRegistrazione: Date
  dataCompetenza: Date
  movimenti: {
    contoId: number
    importoDare: number
    importoAvere: number
    descrizione?: string
    ordine: number
  }[]
  totaleDare: number
  totaleAvere: number
  warnings: string[]
}
```

### 3.3 Flusso di generazione

```
1. API riceve richiesta POST /api/operazioni
2. Validazione e calcoli esistenti (IVA, deducibilita, ripartizioni)
3. Determina causale contabile dal tipo operazione + contesto
4. Chiama motoreScrittureContabili.genera(input)
   a. Seleziona il generatore corretto dalla causale
   b. Il generatore produce i movimenti dare/avere
   c. ContoResolver risolve i codici conto per ogni movimento
   d. ValidazioneScrittura verifica quadratura
   e. Se un conto non e' risolvibile → warning + stato PROVVISORIA
5. Transazione Prisma atomica:
   a. Crea Operazione (come oggi)
   b. Crea RipartizioneOperazione (come oggi)
   c. Crea Cespite/Veicolo se applicabile (come oggi)
   d. Crea PianoPagamento se applicabile (come oggi)
   e. Crea ScritturaContabile                    ← NUOVO
   f. Crea MovimentiContabili (N righe)           ← NUOVO
   g. Se autofattura → genera anche scrittura per autofattura
6. Log attivita
7. Risposta 201
```

### 3.4 Risoluzione conti (ContoResolver)

Ordine di priorita:

1. **Conto esplicito** (`contiEspliciti[ruolo]`) — solo modalita Commercialista
2. **Conto da CategoriaSpesa** (`categoria.contoDefaultId`) — per il conto di costo/ricavo
3. **Conto da mapping fisso** — per conti strutturali (IVA, banca, fornitori, clienti, ritenute, ecc.)
4. **Fallback** → `null` con warning, scrittura in stato PROVVISORIA

Il mapping fisso dei conti strutturali e definito in `causali.ts`:

```typescript
const CONTI_STRUTTURALI = {
  // Attivita — codici verificati su piano-dei-conti-default.ts
  CREDITI_CLIENTI:        '110.001',  // "Clienti Italia" — SP C.II.1
  FATTURE_DA_EMETTERE:    '110.010',  // "Fatture da emettere" — SP C.II.1
  IVA_CREDITO:            '130.001',  // "Erario c/IVA" — SP C.II.5-bis (rinominare in "Erario c/IVA a credito")
  ERARIO_RITENUTE_SUBITE: '130.002',  // "Erario c/ritenute subite" — SP C.II.5-bis
  ERARIO_ACCONTI_IRES:    '130.003',  // "Erario c/acconto IRES" — SP C.II.5-bis
  ERARIO_ACCONTI_IRAP:    '130.004',  // "Erario c/acconto IRAP" — SP C.II.5-bis
  BANCA_CC:               '100.010',  // "Banca c/c principale" — SP C.IV.1 (FIX: era 100.001 che e' Cassa!)
  CASSA:                  '100.001',  // "Cassa contanti" — SP C.IV.3

  // Passivita — codici verificati
  DEBITI_FORNITORI:       '200.001',  // "Fornitori Italia" — SP D.7
  FATTURE_DA_RICEVERE:    '200.010',  // "Fatture da ricevere" — SP D.7
  IVA_DEBITO:             '220.001',  // "Erario c/IVA a debito" — SP D.12
  DEBITI_IRES:            '220.002',  // "Erario c/IRES da versare" — SP D.12
  DEBITI_IRAP:            '220.003',  // "Erario c/IRAP da versare" — SP D.12
  ERARIO_RITENUTE:        '220.004',  // "Erario c/ritenute da versare" — SP D.12
  INPS_CONTRIBUTI:        '220.005',  // NUOVO — "INPS c/contributi da versare" — SP D.13
  ERARIO_IVA:             '220.006',  // NUOVO — "Erario c/IVA (liquidazione)" — SP D.12
  IVA_REVERSE_CHARGE:     '220.010',  // NUOVO — "IVA c/reverse charge" — transitorio
  SOCI_DIVIDENDI:         '230.002',  // "Debiti verso soci per dividendi" — SP D.14
  DEBITI_AMMINISTRATORI:  '230.003',  // "Debiti verso amministratori per compensi" — SP D.14 (esiste gia!)
  FONDO_TFM:              '250.002',  // NUOVO — "Fondo TFM" — SP B.1

  // Patrimonio netto — codici verificati
  RISERVA_LEGALE:         '270.004',  // "Riserva legale" — SP A.IV
  RISERVA_STRAORDINARIA:  '270.006',  // "Riserva straordinaria" — SP A.VI
  UTILI_A_NUOVO:          '270.009',  // "Utili/perdite portati a nuovo" — SP A.VIII (FIX: era 270.007)
  UTILE_ESERCIZIO:        '270.010',  // "Utile/perdita d'esercizio" — SP A.IX (FIX: era 270.008)
  // NOTA: 270.010 gestisce sia utile (saldo Avere) che perdita (saldo Dare) — voce unica A.IX

  // Costi
  IMPOSTE_IRES:           '390.001',  // "IRES corrente" — CE 20
  IMPOSTE_IRAP:           '390.002',  // "IRAP corrente" — CE 20
  SANZIONI_TRIBUTARIE:    '370.009',  // NUOVO — "Sanzioni tributarie" — CE B.14 (indeducibile)
  MINUSVALENZE:           '370.010',  // NUOVO — "Minusvalenze da alienazione" — CE B.14

  // Ricavi
  PLUSVALENZE:             '420.001',  // "Plusvalenze da realizzo cespiti" — CE A.5
  RIMBORSO_BOLLI:          '420.010',  // NUOVO — "Rimborso bolli a clienti" — CE A.5

  // Conti transitori per chiusura/apertura
  CONTO_ECONOMICO:        '900.001',  // NUOVO — transitorio per chiusura
  STATO_PATRIMONIALE:     '900.002',  // NUOVO — transitorio per chiusura
} as const
```

I conti marcati "NUOVO" dovranno essere aggiunti al Piano dei Conti di default (`piano-dei-conti-default.ts`).
Il conto `130.001` "Erario c/IVA" sara rinominato in "Erario c/IVA a credito" per chiarezza.

### 3.5 Mapping CategoriaSpesa → Conto del Piano dei Conti

Ogni categoria di spesa predefinita viene mappata al conto contabile corrispondente. Esempi:

| Categoria | Conto PdC |
|---|---|
| Consulenze professionali | 310.001 Consulenze e collaborazioni |
| Affitto ufficio | 320.001 Fitti passivi |
| Utenze (luce, gas, acqua) | 310.010 Utenze |
| Assicurazioni | 310.020 Premi di assicurazione |
| Materiale d'ufficio | 310.030 Cancelleria e materiale d'ufficio |
| Spese telefoniche | 310.040 Spese telefoniche |
| Carburante | 310.050 Carburanti e lubrificanti |
| Manutenzioni | 310.060 Manutenzioni e riparazioni |
| Formazione | 310.070 Spese di formazione |
| Compenso amministratore | 330.040 Compenso amministratore |
| (Fattura attiva — ricavi) | 400.001 Ricavi per prestazioni |

La mappatura completa sara definita durante l'implementazione, coprendo tutte le ~40 categorie predefinite.

### 3.6 Validazioni

1. **Quadratura:** `SUM(importoDare) === SUM(importoAvere)` — errore bloccante
2. **Conto attivo:** ogni `contoId` deve referenziare un conto con `attivo = true` — errore bloccante
3. **Periodo aperto:** `dataRegistrazione` non deve cadere in un esercizio con `ChiusuraEsercizio.stato = DEFINITIVA` — errore bloccante
4. **Importi positivi:** `importoDare >= 0` e `importoAvere >= 0` — errore bloccante
5. **Mutuamente esclusivi:** per ogni riga, almeno uno tra dare e avere deve essere 0 — errore bloccante
6. **Coerenza natura:** warning (non bloccante) se un conto con `naturaSaldo = DARE` viene movimentato prevalentemente in Avere
7. **Numerazione protocollo:** progressiva senza buchi, calcolata come `MAX(numeroProtocollo WHERE societaId AND anno) + 1`

---

## 4. Generatori — Schemi di Scrittura

### 4.1 Fattura Attiva (fattura-attiva.ts)

#### FV — Fattura vendita con IVA
```
Dare: CREDITI_CLIENTI           = importoTotale
Avere: [conto da categoria]     = importoImponibile
Avere: IVA_DEBITO               = importoIva
```

#### FV — Fattura vendita esente con bollo
```
Dare: CREDITI_CLIENTI           = importoTotale (imponibile + bollo)
Avere: [conto da categoria]     = importoImponibile
Avere: Altri ricavi (rimborso bolli) = importoBollo
```

#### FVS — Fattura vendita split payment
```
Dare: CREDITI_CLIENTI           = importoImponibile (solo imponibile!)
Avere: [conto da categoria]     = importoImponibile
```
IVA annotata nel registro vendite ma non genera movimento contabile per il cedente.

#### NCV — Nota credito emessa
```
Dare: [conto da categoria] (storno ricavo) = importoImponibile
Dare: IVA_DEBITO (storno)                  = importoIva
Avere: CREDITI_CLIENTI                      = importoTotale
```

#### Se incasso immediato (statoPagamento = PAGATO)
Aggiunge seconda scrittura:
```
Dare: BANCA_CC                  = importoTotale
Avere: CREDITI_CLIENTI          = importoTotale
```

### 4.2 Fattura Passiva (fattura-passiva.ts)

#### FA — Acquisto con IVA detraibile 100%
```
Dare: [conto da categoria]     = importoImponibile
Dare: IVA_CREDITO              = ivaDetraibile
Avere: DEBITI_FORNITORI        = importoTotale
```

#### FA — Acquisto con IVA parzialmente detraibile
```
Dare: [conto da categoria]     = importoImponibile + ivaIndetraibile
Dare: IVA_CREDITO              = ivaDetraibile
Avere: DEBITI_FORNITORI        = importoTotale
```

#### FA — Acquisto con ritenuta (professionista)
```
Dare: [conto da categoria]     = importoImponibile (incl. cassa prev.)
Dare: IVA_CREDITO              = ivaDetraibile
Avere: DEBITI_FORNITORI        = importoNettoRitenuta + ivaDetraibile
Avere: ERARIO_RITENUTE         = importoRitenuta
```

#### NCA — Nota credito ricevuta
```
Dare: DEBITI_FORNITORI         = importoTotale
Avere: [conto da categoria]    = importoImponibile
Avere: IVA_CREDITO (storno)    = importoIva
```

#### Se pagamento immediato
Aggiunge seconda scrittura:
```
Dare: DEBITI_FORNITORI         = importoTotale (o netto ritenuta)
Avere: BANCA_CC                = importoTotale (o netto ritenuta)
```

### 4.3 Reverse Charge (reverse-charge.ts)

#### Acquisto intra-UE / reverse charge interno / San Marino senza IVA

Genera **due scritture** (doppia registrazione):

**Scrittura 1 — Registro acquisti:**
```
Dare: [conto da categoria]     = importoImponibile
Dare: IVA_CREDITO              = importoIva (calcolata)
Avere: DEBITI_FORNITORI        = importoImponibile (senza IVA!)
Avere: IVA_REVERSE_CHARGE      = importoIva (transitorio)
```

**Scrittura 2 — Registro vendite (sezionale):**
```
Dare: IVA_REVERSE_CHARGE       = importoIva (chiude transitorio)
Avere: IVA_DEBITO              = importoIva
```

Effetto netto: IVA a credito e IVA a debito si compensano in liquidazione. Debito verso fornitore = solo imponibile.

### 4.4 Cespite (cespite-acquisto.ts)

#### Acquisto cespite
```
Dare: [conto immobilizzazione]  = importoImponibile + ivaIndetraibile
Dare: IVA_CREDITO               = ivaDetraibile
Avere: DEBITI_FORNITORI          = importoTotale
```

Il conto immobilizzazione e determinato dal tipo di cespite (codici verificati):
- Immateriali (software) → 160.010
- Mobili e arredi → 170.006
- Elaboratori → 170.008
- Autovetture → 170.010
- Apparati telefonici → 170.011
- Impianti → 170.004 (NUOVO)
- Attrezzature → 170.005 (NUOVO)

### 4.5 Ammortamento (ammortamento.ts)

Generato in batch a fine esercizio o su richiesta.

```
Dare: [conto ammortamento]      = quotaAnnuale
Avere: [conto fondo ammortamento] = quotaAnnuale
```

Mapping per tipo (codici verificati su piano-dei-conti-default.ts):

| Tipo cespite | Conto ammortamento (CE B.10) | Conto fondo (SP rettifica) |
|---|---|---|
| Immobilizzazioni immateriali | 340.001 Amm.to immob. immateriali | 160.106 F.do amm.to software |
| Mobili e arredi | 340.013 Amm.to mobili e arredi | 170.106 F.do amm.to mobili |
| Elaboratori (PC, server) | 340.015 Amm.to elaboratori | 170.108 F.do amm.to elaboratori |
| Autovetture | 340.017 Amm.to autovetture | 170.110 F.do amm.to autovetture |
| Apparati telefonici | 340.018 Amm.to apparati telefonici | 170.111 F.do amm.to apparati tel. |
| Impianti generici | 340.011 Amm.to impianti (NUOVO) | 170.101 F.do amm.to impianti (NUOVO) |
| Attrezzature | 340.012 Amm.to attrezzature (NUOVO) | 170.102 F.do amm.to attrezzature (NUOVO) |

### 4.6 Compenso Amministratore (compenso-amministratore.ts)

#### Con ritenuta + INPS gestione separata
```
Dare: 330.040 Compensi amministratori = importoLordo
Dare: [INPS c/ditta] (2/3 contributo) = contributoAziendale
Avere: Debiti v/amministratori        = nettoAPagare
Avere: ERARIO_RITENUTE                = importoRitenuta
Avere: INPS_CONTRIBUTI                = contributoTotale
```

### 4.7 Pagamento Imposte (pagamento-imposte.ts)

#### IRES/IRAP acconto
```
Dare: ERARIO_ACCONTI_IRES (o IRAP) = importo
Avere: BANCA_CC                     = importo
```

#### IRES/IRAP saldo (stanziamento a bilancio)
```
Dare: Imposte correnti IRES    = impostaDovuta
Avere: ERARIO_ACCONTI_IRES     = accontiVersati
Avere: DEBITI_IRES             = saldoDaVersare
```

#### Versamento saldo
```
Dare: DEBITI_IRES              = saldo
Avere: BANCA_CC                = saldo
```

#### Versamento ritenute operate (F24)
```
Dare: ERARIO_RITENUTE          = totaleRitenute
Avere: BANCA_CC                = totaleRitenute
```

#### Compensazione crediti F24
```
Dare: [debito tributario]      = importoCompensato
Avere: [credito tributario]    = importoCompensato
```
Nessun transito per banca.

### 4.8 Dividendi (dividendi.ts)

#### Destinazione utile
```
Dare: UTILE_ESERCIZIO          = utile
Avere: RISERVA_LEGALE          = utile * 5% (fino a 20% capitale)
Avere: SOCI_DIVIDENDI          = dividendiDeliberati
Avere: UTILI_A_NUOVO           = residuo
```

#### Pagamento (persone fisiche)
```
Dare: SOCI_DIVIDENDI           = dividendoLordo
Avere: ERARIO_RITENUTE         = dividendoLordo * 26%
Avere: BANCA_CC                = dividendoNetto
```

### 4.9 Liquidazione IVA (liquidazione-iva.ts)

#### IVA a debito (vendite > acquisti)
```
Dare: IVA_DEBITO               = totaleIvaVendite
Avere: IVA_CREDITO             = totaleIvaAcquisti
Avere: ERARIO_IVA              = differenza (da versare)
```

#### IVA a credito (acquisti > vendite)
```
Dare: IVA_DEBITO               = totaleIvaVendite
Dare: ERARIO_IVA (credito)     = differenza (riportata)
Avere: IVA_CREDITO             = totaleIvaAcquisti
```

### 4.10 Chiusura Esercizio (chiusura-esercizio.ts)

Sequenza completa:

1. **Scritture di assestamento** (ratei, risconti, fatture da emettere/ricevere, fondi, imposte differite)
2. **Chiusura conti economici di costo** → CONTO_ECONOMICO
3. **Chiusura conti economici di ricavo** → CONTO_ECONOMICO
4. **Determinazione utile/perdita** → UTILE_ESERCIZIO o PERDITA_ESERCIZIO
5. **Chiusura conti patrimoniali attivi** → STATO_PATRIMONIALE
6. **Chiusura conti patrimoniali passivi** → STATO_PATRIMONIALE
7. **Riapertura conti patrimoniali** (1 gennaio anno successivo)
8. **Storno ratei e risconti**

---

## 5. Viste di Consultazione

### 5.1 Libro Giornale (`/bilancio/libro-giornale`)

Vista cronologica di tutte le ScrittureContabili con i relativi MovimentiContabili.

**Funzionalita:**
- Filtri: periodo, causale, tipo scrittura, stato
- Paginazione con numero articolo progressivo
- Totali progressivi dare/avere per pagina
- Contatore registrazioni per calcolo bollo (€16 ogni 2.500)
- Export PDF conforme (intestazione societa, numerazione pagine, anno)
- Click su operazione collegata → apre il dettaglio operazione

**Visibilita:** Nascosto in Semplice, sola lettura in Avanzata, completo in Commercialista.

### 5.2 Libro Mastro (`/bilancio/libro-mastro`)

Vista per singolo conto con saldo progressivo.

**Funzionalita:**
- Selettore conto (ricerca per codice o descrizione)
- Filtro periodo
- Saldo iniziale (da saldi di apertura)
- Saldo progressivo riga per riga
- Click su numero articolo → apre scrittura nel libro giornale
- Export PDF/Excel

**Visibilita:** Nascosto in Semplice, sola lettura in Avanzata, completo in Commercialista.

### 5.3 Bilancio di Verifica (`/bilancio/bilancio-verifica`)

Tutti i conti con totali dare/avere e saldo finale.

**Funzionalita:**
- Filtro data (saldi alla data X)
- Raggruppamento per classe (Attivita/Passivita/Costi/Ricavi)
- Opzione: mostra solo conti con saldo != 0
- Indicatore quadratura (totale dare = totale avere)
- Export PDF/Excel

**Visibilita:** Nascosto in Semplice, visualizzabile in Avanzata, completo in Commercialista.

### 5.4 Form Scrittura Manuale (solo Commercialista)

Accessibile da `/bilancio/libro-giornale` con pulsante "Nuova scrittura".

**Funzionalita:**
- Data registrazione e competenza
- Descrizione/causale
- Tabella righe dare/avere con selettore conto
- Validazione quadratura in tempo reale
- Aggiunta/rimozione righe dinamica
- Salvataggio come MANUALE

---

## 6. Migrazione Dati Esistenti

### 6.1 Strategia

Script di migrazione (`prisma/migrations/seed-scritture.ts`) che:

1. Itera tutte le Operazioni esistenti ordinate per data
2. Per ogni operazione, chiama il motore di generazione
3. Salva le scritture con `tipoScrittura = AUTO`, `stato = DEFINITIVA`
4. Se il conto non e risolvibile → `stato = PROVVISORIA` con warning
5. Produce report finale: N scritture generate, N provvisorie, quadratura

### 6.2 Pre-requisiti

Prima della migrazione:
1. Aggiungere i nuovi conti al Piano dei Conti di default
2. Popolare `contoDefaultId` su tutte le CategorieSpesa predefinite
3. Creare la tabella CausaleContabile con i dati di seed

### 6.3 Reversibilita

La migrazione e additiva — non modifica dati esistenti. In caso di problemi, si possono eliminare tutte le ScrittureContabili e MovimentiContabili e ripetere.

---

## 7. Impatto sulle API

### 7.1 API modificate

**POST /api/operazioni** — Aggiunta generazione scrittura nella transazione.
**PUT /api/operazioni/[id]** — Rigenera la scrittura collegata.
**DELETE /api/operazioni/[id]** — Soft-delete anche della scrittura collegata.

### 7.2 Nuove API

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/libro-giornale` | GET | Lista scritture con filtri e paginazione |
| `/api/libro-giornale/export` | GET | Export PDF libro giornale |
| `/api/libro-mastro` | GET | Movimenti per conto con saldo progressivo |
| `/api/bilancio-verifica` | GET | Saldi di tutti i conti alla data |
| `/api/scritture-contabili` | POST | Creazione scrittura manuale (solo Commercialista) |
| `/api/scritture-contabili/[id]` | PUT | Modifica scrittura (solo Commercialista, solo PROVVISORIA o MANUALE) |
| `/api/scritture-contabili/[id]` | DELETE | Eliminazione scrittura manuale |
| `/api/scritture-contabili/rigenera/[operazioneId]` | POST | Rigenera scrittura da operazione |

---

## 8. Test

### 8.1 Unit test per ogni generatore

Ogni generatore deve avere test che verificano:
- Correttezza dei conti movimentati
- Correttezza degli importi dare/avere
- Quadratura (sum dare = sum avere)
- Gestione dei casi limite (IVA 0%, importo 0, ecc.)

### 8.2 Test di integrazione

- Creazione operazione → verifica scrittura generata
- Modifica operazione → verifica rigenerazione scrittura
- Eliminazione operazione → verifica soft-delete scrittura
- Migrazione dati esistenti → verifica quadratura complessiva

### 8.3 Test di quadratura globale

- Bilancio di verifica deve sempre quadrare (totale dare = totale avere)
- Dopo chiusura esercizio: tutti i conti economici a saldo zero
- Dopo riapertura: saldi patrimoniali corrispondono a chiusura anno precedente

---

## 9. Piano dei Conti — Modifiche

### 9.1 Conti da rinominare

| Codice | Descrizione attuale | Nuova descrizione | Motivo |
|---|---|---|---|
| 130.001 | Erario c/IVA | **Erario c/IVA a credito** | Disambiguare da IVA a debito (220.001) |

### 9.2 Nuovi conti da aggiungere

| Codice | Descrizione | Tipo | voceSp | voceCe | Natura | Note |
|---|---|---|---|---|---|---|
| 170.004 | Impianti generici | PATRIMONIALE_ATTIVO | B.II.2 | — | DARE | Immobilizzazione |
| 170.005 | Attrezzature | PATRIMONIALE_ATTIVO | B.II.3 | — | DARE | Immobilizzazione |
| 170.101 | F.do amm.to impianti | PATRIMONIALE_ATTIVO | B.II.2 | — | AVERE | Rettifica |
| 170.102 | F.do amm.to attrezzature | PATRIMONIALE_ATTIVO | B.II.3 | — | AVERE | Rettifica |
| 220.005 | INPS c/contributi da versare | PATRIMONIALE_PASSIVO | D.13 | — | AVERE | Debiti previdenziali |
| 220.006 | Erario c/IVA (liquidazione) | PATRIMONIALE_PASSIVO | D.12 | — | AVERE | Risultato liquidazione IVA |
| 220.010 | IVA c/reverse charge | PATRIMONIALE_PASSIVO | D.12 | — | AVERE | Transitorio doppia registrazione |
| 250.002 | Fondo TFM | PATRIMONIALE_PASSIVO | B.1 | — | AVERE | Trattamento fine mandato |
| 340.011 | Amm.to impianti | ECONOMICO_COSTO | — | B.10.b | DARE | |
| 340.012 | Amm.to attrezzature | ECONOMICO_COSTO | — | B.10.b | DARE | |
| 370.009 | Sanzioni tributarie | ECONOMICO_COSTO | — | B.14 | DARE | Indeducibile IRES (art. 99 TUIR) |
| 370.010 | Minusvalenze da alienazione | ECONOMICO_COSTO | — | B.14 | DARE | Art. 101 TUIR |
| 420.010 | Rimborso bolli a clienti | ECONOMICO_RICAVO | — | A.5 | AVERE | Bollo addebitato in fattura |
| 900.001 | Conto Economico (transitorio) | ORDINE | — | — | DARE | Solo per chiusura |
| 900.002 | Stato Patrimoniale (transitorio) | ORDINE | — | — | DARE | Solo per chiusura |

### 9.3 Conti gia esistenti — nessuna modifica necessaria

| Codice | Descrizione | Utilizzato come |
|---|---|---|
| 230.003 | Debiti verso amministratori per compensi | DEBITI_AMMINISTRATORI |
| 270.009 | Utili/perdite portati a nuovo | UTILI_A_NUOVO |
| 270.010 | Utile/perdita d'esercizio | UTILE_ESERCIZIO (A.IX, puo' essere negativo) |

### 9.4 Relazioni Prisma da aggiungere

Su `PianoDeiConti`:
- `movimentiContabili MovimentoContabile[]` — back-reference per i movimenti

---

## 10. Decisioni Architetturali

| Decisione | Motivazione |
|---|---|
| ScritturaContabile separata da Operazione | Permette scritture manuali senza operazione (Commercialista) |
| Saldi calcolati dinamicamente, non duplicati su PianoDeiConti | Evita problemi di sincronizzazione, source of truth unico |
| Decimal(12,2) per importi | Supporta importi fino a 9.999.999.999,99 |
| Causale come stringa, non enum | Estensibile senza migration |
| Conto transitorio per reverse charge | Pattern standard italiano per la doppia registrazione |
| Conti 900.xxx per chiusura/apertura | Separati dai conti operativi, non inquinano il bilancio |
| operazioneId nullable su ScritturaContabile | Supporta scritture manuali |
| totaleDare/totaleAvere denormalizzati su ScritturaContabile | Performance per il libro giornale (evita SUM su ogni query) |
| Causale senza FK a CausaleContabile | La tabella CausaleContabile e' informativa; validazione applicativa. Evita dipendenze circolari e permette causali custom senza seed. |
| societaId denormalizzato su MovimentoContabile | Performance per Libro Mastro: query per conto senza JOIN a ScritturaContabile |
| 270.010 per utile E perdita | Prassi italiana standard: voce A.IX puo' essere negativa. Nessun conto separato per la perdita |
| STORNO aggiunto a TipoScrittura | Distingue lo storno ratei/risconti (STORNO) dalle rettifiche contabili (RETTIFICA) |
| Protocollo con SELECT FOR UPDATE | Previene race condition sulla numerazione progressiva in ambienti concorrenti |

---

## 11. Concorrenza — Numerazione Protocollo

La numerazione progressiva del protocollo deve essere priva di buchi. In ambiente concorrente, due richieste simultanee potrebbero leggere lo stesso MAX e produrre duplicati.

**Strategia:** `SELECT MAX(numeroProtocollo) ... FOR UPDATE` dentro la transazione Prisma. La riga viene bloccata fino al commit, serializzando le numerazioni.

```typescript
// Dentro la transazione Prisma:
const [{ max }] = await tx.$queryRaw`
  SELECT MAX(numeroProtocollo) as max
  FROM scritture_contabili
  WHERE societaId = ${societaId} AND anno = ${anno}
  FOR UPDATE
`
const numeroProtocollo = (max ?? 0) + 1
```

Il vincolo `@@unique([societaId, anno, numeroProtocollo])` funge da safety net aggiuntivo.

---

## 12. Esempio Numerico — Fattura Professionista con Cassa Previdenziale

Per chiarire la quadratura della scrittura con ritenuta + cassa previdenziale:

**Fattura avvocato:**
- Compenso: €3.000
- Cassa Forense 4%: €120 (soggetta a IVA, non soggetta a ritenuta)
- Imponibile IVA: €3.120 (compenso + cassa)
- IVA 22%: €686,40
- Ritenuta d'acconto 20% su €3.000 (solo compenso): €600
- Totale fattura: €3.806,40
- Netto a pagare: €3.806,40 - €600 = €3.206,40

**Scrittura generata:**
```
Dare:  310.001 Consulenze professionali    €3.120,00  (compenso + cassa = costo)
Dare:  130.001 IVA c/acquisti                €686,40  (IVA detraibile)
Avere: 200.001 Debiti v/fornitori          €3.206,40  (netto a pagare)
Avere: 220.004 Erario c/ritenute             €600,00  (da versare con F24)

Quadratura: 3.120 + 686,40 = 3.806,40
            3.206,40 + 600 = 3.806,40  ✓
```

**NOTA:** Nel modello dati, `importoImponibile` dell'Operazione include gia la cassa previdenziale (il form la somma all'imponibile). La Ritenuta e' calcolata sul solo compenso (esclusa cassa) tramite il modulo `calcoli-ritenuta.ts`.
