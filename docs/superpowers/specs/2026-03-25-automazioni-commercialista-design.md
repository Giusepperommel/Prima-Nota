# Automazioni Commercialista — Design Spec

**Data:** 2026-03-25
**Obiettivo:** Creare un sistema di automazioni all-in-one che renda Prima Nota indispensabile per i commercialisti, coprendo input automatico, controlli proattivi, gestione adempimenti e comunicazione col cliente.
**Target:** Studi piccoli (1-3 persone), medi (5-15), e tech-forward — il sistema si adatta a tutti.
**Filosofia AI:** Mix pragmatico — regole deterministiche dove il comportamento è prevedibile, Claude AI dove serve intelligenza flessibile.

---

## Struttura del progetto

Il progetto è diviso in 5 sub-project incrementali, ciascuno con il proprio ciclo spec → plan → implementazione:

| Sub-project | Nome | Dipendenze |
|-------------|------|------------|
| 0 | Architettura Fondazionale | Nessuna |
| 1 | Input Automatico | Sub-project 0 |
| 2 | Controlli Proattivi | Sub-project 0, 1 |
| 3 | Copilota Adempimenti | Sub-project 0, 2 |
| 4 | Comunicazione Cliente | Sub-project 0, 3 |

Ogni layer si appoggia sul precedente: i controlli proattivi funzionano meglio se l'input è automatizzato, il copilota scadenze funziona meglio se i controlli sono attivi, la comunicazione col cliente funziona meglio se scadenze e controlli sono in ordine.

---

## Convenzioni codebase

Tutti i modelli dati seguono le convenzioni esistenti del progetto:

- **ID:** `Int @id @default(autoincrement())` — coerente con tutti i 60+ modelli esistenti
- **Mapping campi:** ogni campo camelCase ha `@map("snake_case")` (es. `societaId Int @map("societa_id")`)
- **Mapping tabelle:** ogni modello ha `@@map("nome_tabella_snake_case")`
- **Tipi DB espliciti:** `@db.VarChar(N)`, `@db.Text`, `@db.Decimal(P, S)` su ogni campo stringa/numerico
- **Timestamps:** `createdAt DateTime @default(now()) @map("created_at")` e `updatedAt DateTime @updatedAt @map("updated_at")` su tutti i modelli mutabili
- **Indexes:** `@@index` su campi usati frequentemente in query (minimo `societaId` + campo filtro principale)
- **Relazioni polimorfiche:** `entityType String @db.VarChar(50)` + `entityId Int` (tipo numerico coerente con ID del codebase). Convenzione: `entityType` usa il nome del modello Prisma (es. "Operazione", "MovimentoBancario")
- **Relazione con Societa:** ogni modello con `societaId` richiede l'aggiunta del corrispondente array di relazione sul modello `Societa`

---

## Migrazione modelli esistenti

### ConfigurazioneProvider → evoluzione

Il modello `ConfigurazioneProvider` esistente (riga 1349 dello schema) gestisce solo il provider di fatturazione elettronica con vincolo `@unique` su `societaId` (una config per società). Il nuovo sistema necessita di supportare più provider per società (uno per fatture, uno per banca).

**Strategia:** rinominare il modello esistente in `ConfigurazioneProviderFe` (fatturazione elettronica) e creare il nuovo `ProviderConfig` con scope più ampio. Il codice esistente che usa `ConfigurazioneProvider` verrà aggiornato per usare il nuovo nome. In alternativa, se il modello esistente è usato solo per il provider FE, può essere migrato come record `tipo=FATTURE` nel nuovo `ProviderConfig` con una migration Prisma.

### AlertAzienda e ScadenzaAzienda → coesistenza e migrazione graduale

- **AlertAzienda** (riga 1237) → diventa un sottoinsieme di `Notifica`. Il nuovo sistema di notifiche lo sostituisce progressivamente. Durante la transizione: il codice che crea `AlertAzienda` creerà anche una `Notifica` corrispondente. Una volta che tutte le UI sono migrate, `AlertAzienda` viene rimosso.
- **ScadenzaAzienda** (riga 1216) → è per scadenze manuali create dall'utente. Coesiste con `ScadenzaFiscale` che è per scadenze auto-generate dal calendario fiscale. Sono complementari: `ScadenzaAzienda` = "ricordami di fare X", `ScadenzaFiscale` = "il sistema sa che devi fare X entro Y".

---

## Sub-project 0: Architettura Fondazionale

### 0.1 Provider/Adapter Pattern

Pattern centrale che permette di partire con import file e passare a connessioni dirette (SDI, Open Banking) senza modificare il codice a valle.

```
┌─────────────────────────────────────────────────┐
│                  UI / Wizard                     │
│  (configurazione provider, stato connessione)    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              Provider Manager                    │
│  (registry dei provider attivi per società)      │
└──────────┬───────────────────────┬──────────────┘
           │                       │
┌──────────▼──────────┐  ┌────────▼──────────────┐
│  Fatture Provider    │  │  Banca Provider        │
│  (interfaccia comune)│  │  (interfaccia comune)  │
└──────────┬──────────┘  └────────┬──────────────┘
     ┌─────┴─────┐          ┌────┴──────┐
     │           │          │           │
  FileXML    Aruba      FileCSV     Fabrick
  Adapter    Adapter    Adapter     Adapter
```

**Interfacce Provider:**

```typescript
interface FattureProvider {
  importaFatturePassive(files?: File[]): Promise<FatturaImportata[]>
  inviaFatturaAttiva(fattura: FatturaElettronica): Promise<StatoInvio>
  getStatoFattura(id: string): Promise<StatoFattura>
  sync?(): Promise<SyncResult>  // solo per provider con connessione diretta
}

interface BancaProvider {
  getMovimenti(dateRange: DateRange): Promise<MovimentoBancario[]>
  getSaldo(iban: string): Promise<SaldoBancario>
  getConti(): Promise<ContoBancario[]>
  sync?(): Promise<SyncResult>  // solo per provider con connessione diretta
}
```

**Provider disponibili (oggi e domani):**

| Tipo | Provider | Stato | Note |
|------|----------|-------|------|
| Fatture | FileXML | Implementare ora | Upload XML/ZIP FatturaPA |
| Fatture | Aruba | Futuro | API REST, ~€0.10-0.30/fattura |
| Fatture | InfoCert | Futuro | API REST, alternativa ad Aruba |
| Banca | FileCSV | Già esistente (potenziare) | Upload CSV/OFX |
| Banca | Fabrick (CBI) | Futuro | PSD2, copre quasi tutte le banche IT |
| Banca | Nordigen/GoCardless | Futuro | PSD2, alternativa europea |

**Modello dati:**

```prisma
model ProviderConfig {
  id            Int            @id @default(autoincrement())
  societaId     Int            @map("societa_id")
  tipo          ProviderTipo   @map("tipo")
  provider      ProviderNome   @map("provider")
  credenziali   Json?          @map("credenziali")  // encrypted, provider-specific
  stato         ProviderStato  @default(CONFIGURAZIONE) @map("stato")
  ultimoSync    DateTime?      @map("ultimo_sync")
  configExtra   Json?          @map("config_extra")  // es. IBAN per banca, codice destinatario per SDI
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  societa       Societa        @relation(fields: [societaId], references: [id])

  @@unique([societaId, tipo, provider])
  @@index([societaId, tipo])
  @@map("provider_config")
}

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
```

**Wizard di configurazione:**
Ogni provider avrà un wizard guidato con screenshot che accompagna l'utente passo passo nella configurazione (creazione account, ottenimento API key, configurazione endpoint). Il wizard è progettato per essere estendibile: aggiungere un nuovo provider significa aggiungere un nuovo adapter + una nuova sequenza di step nel wizard.

---

### 0.2 AI Pipeline

Pattern per l'uso di Claude AI: deterministico dove possibile, AI dove serve flessibilità, sempre con supervisione umana per i casi incerti.

```
Input ──▶ Regole Deterministiche ──▶ Output certo? ──SÌ──▶ Applica diretto
                                          │
                                         NO
                                          │
                                   Claude AI classifica/suggerisce
                                          │
                                   Confidence > soglia?
                                     │           │
                                    SÌ          NO
                                     │           │
                               Applica con    Coda review
                               tag "AI"       umano
```

**Tre livelli di decisione:**

1. **Automatico** — regole deterministiche (calcolo IVA 22%, scadenza F24 il 16 del mese). Nessun margine di errore.
2. **AI con auto-apply** — Claude classifica con confidence > 90% (es. "questa fattura è un costo telefonico" basato su fornitore noto). Applica e tagga come "classificato da AI".
3. **AI con review umano** — confidence < 90%. Va in coda di approvazione con highlight dei campi incerti e motivazione dell'AI.

**Modello dati:**

```prisma
model AiSuggestion {
  id            Int                @id @default(autoincrement())
  societaId     Int                @map("societa_id")
  tipo          AiSuggestionTipo   @map("tipo")
  entityType    String             @map("entity_type") @db.VarChar(50)   // "Operazione", "MovimentoBancario", "FatturaElettronica"
  entityId      Int                @map("entity_id")
  suggestion    Json               @map("suggestion")
  confidence    Float              @map("confidence")                     // 0.0 - 1.0
  stato         AiSuggestionStato  @default(PENDING) @map("stato")
  motivazione   String?            @map("motivazione") @db.Text
  tokensUsati   Int?               @map("tokens_usati")                  // tracking costi AI
  reviewedBy    Int?               @map("reviewed_by")
  reviewedAt    DateTime?          @map("reviewed_at")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  societa       Societa            @relation(fields: [societaId], references: [id])

  @@index([societaId, stato])
  @@index([entityType, entityId])
  @@map("ai_suggestions")
}

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
```

**Principi d'uso dell'AI:**
- Claude non decide mai da solo su importi, calcoli fiscali o registrazioni definitive
- Ogni azione AI è tracciata e reversibile
- Il commercialista può disabilitare l'auto-apply e richiedere review manuale per tutto
- I costi API sono contenuti: Claude viene chiamato solo quando le regole deterministiche non bastano
- `tokensUsati` su ogni suggestion permette di monitorare i costi per società/mese
- Se il provider AI non è raggiungibile, il sistema degrada gracefully a regole deterministiche (nessun suggerimento AI, ma le operazioni procedono normalmente)

---

### 0.3 Sistema Notifiche e Alert

Motore unico di notifiche che alimenta tutti i layer. Sostituisce progressivamente `AlertAzienda`.

```
Event Bus ──▶ Rule Engine ──▶ In-App Alert
              (chi, come,     Email (Resend)
               quando)        Portale Cliente
```

**Priorità e canali:**

| Priorità | Esempio | In-App | Email | Portale |
|----------|---------|--------|-------|---------|
| CRITICA | Fattura scartata da SDI, F24 scaduto | Immediato | Immediato | — |
| ALTA | Scadenza tra 3 giorni, anomalia IVA | Immediato | Digest giornaliero | — |
| MEDIA | Documenti mancanti, suggestion AI da approvare | Badge | Digest settimanale | Notifica |
| BASSA | Report pronto, sync completato | Badge | — | — |

**Modello dati:**

```prisma
model Notifica {
  id                      Int              @id @default(autoincrement())
  societaId               Int              @map("societa_id")
  utenteDestinatarioId    Int?             @map("utente_destinatario_id")
  clienteDestinatarioId   Int?             @map("cliente_destinatario_id")
  tipo                    NotificaTipo     @map("tipo")
  priorita                NotificaPriorita @map("priorita")
  titolo                  String           @db.VarChar(255)
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
  clienteDestinatario     AccessoCliente?  @relation("NotificheCliente", fields: [clienteDestinatarioId], references: [id])

  @@index([societaId, stato])
  @@index([utenteDestinatarioId, stato])
  @@index([clienteDestinatarioId, stato])
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

  utente          Utente           @relation(fields: [utenteId], references: [id])

  @@unique([utenteId, tipoEvento, canale])
  @@map("preferenze_notifica")
}

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
```

---

## Sub-project 1: Input Automatico

### 1.1 Import Fatture Passive XML (SDI)

**Flusso:**

```
Upload XML/ZIP ──▶ Parser FatturaPA ──▶ Mapping automatico
                                              │
                              ┌────────────────┤
                              │                │
                        Fornitore noto?   Fornitore nuovo?
                              │                │
                        Applica categoria, Claude AI classifica
                        conto, ripartizione + crea anagrafica
                        precedenti             │
                              │                │
                              └───────┬────────┘
                                      │
                               Operazione in BOZZA
                                      │
                              Confidence > 90%?
                                │          │
                               SÌ         NO
                                │          │
                          Auto-conferma  Coda review
                          (tag AI)       (highlight campi incerti)
```

**Capacità del parser:**
- Legge XML FatturaPA (formato standard Agenzia delle Entrate)
- Estrae: cedente (fornitore), data, numero, righe dettaglio, aliquote IVA, totali, modalità pagamento, scadenze
- Gestisce tutti i TipoDocumento SDI: TD01 (fattura), TD04 (nota credito), TD05 (nota debito), TD16-TD28 (autofatture/integrazioni)
- Batch import: upload ZIP con multiple fatture, processate in parallelo

**Idempotenza:** ogni fattura XML ha un `IdentificativoSdI` e `NomeFile` univoci. Il sistema controlla se una fattura con lo stesso identificativo è già stata importata. In caso di duplicato: skip silenzioso con log, nessuna sovrascrittura. L'utente vede il conteggio "N skippate (già importate)" nel report di import.

**Mapping intelligente:**
- **Fornitore noto** — cerca in anagrafica per P.IVA/CF, recupera categoria e conto usati l'ultima volta, applica stesse ripartizioni
- **Fornitore nuovo** — Claude analizza ragione sociale, codice ATECO (se presente), descrizione righe → suggerisce categoria, conto, tipo merce, crea anagrafica
- **Multi-riga** — fattura con righe ad aliquote diverse: crea operazione con aliquota prevalente oppure suggerisce split (configurabile)

### 1.2 OCR Fatture PDF (potenziato)

Potenziamento dell'OCR esistente (Tesseract.js) con Claude AI come layer di interpretazione semantica.

```
Upload PDF/IMG ──▶ Tesseract OCR ──▶ Testo grezzo ──▶ Claude AI estrae dati strutturati
                                                              │
                                                       Stessa pipeline
                                                       del parser XML
```

**Differenza dall'attuale:** oggi Tesseract estrae testo e fa parsing regex. Con Claude, il testo grezzo viene interpretato semanticamente — funziona anche con fatture estere, formati non standard, ricevute scansionate male.

### 1.3 Import Movimenti Bancari (potenziato)

Potenziamento della riconciliazione esistente con matching AI a 3 livelli.

```
Upload CSV/OFX ──────▶ Parser multi-formato ──▶ Normalizzazione
(oggi)                                                │
                                            ┌─────────▼──────────┐
Sync API ──▶ Fabrick/Nordigen ─────────────▶│ Matching Engine     │
(domani)     Adapter                        │ (potenziato)        │
                                            │                     │
                                            │ 1. Match esatto     │
                                            │    (importo+data)   │
                                            │ 2. Match fuzzy      │
                                            │    (nome+importo±2%)│
                                            │ 3. Claude AI        │
                                            │    (causale banca)  │
                                            └────────┬────────────┘
                                                     │
                                              Per ogni movimento:
                                              - Riconciliato
                                              - Suggerito
                                              - Non trovato
```

**Tre livelli di matching:**
1. **Esatto** — importo identico + data entro 3 giorni → match automatico
2. **Fuzzy** — importo simile (±2%) + nome fornitore/cliente in descrizione → suggerimento con confidence
3. **AI** — Claude legge la causale bancaria (es. "BONIFICO A FAVORE DI ROSSI SRL PER FT 123/2026") → identifica fornitore + fattura

**Movimenti senza match:** il sistema suggerisce di creare una nuova operazione, pre-compilata con i dati del movimento bancario + classificazione AI.

### 1.4 Dashboard "Centro Import"

Pagina unica di gestione di tutti gli import, con coda review e azioni batch.

```
┌─────────────────────────────────────────────────┐
│  Centro Import                    [Società X]    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Fatture passive     [12 nuove] [3 da review]   │
│  Movimenti banca     [47 importati] [5 senza match]│
│  Documenti OCR       [2 in elaborazione]         │
│                                                  │
│  ┌─ Azioni rapide ─────────────────────────┐    │
│  │ [Importa XML/ZIP] [Importa CSV banca]   │    │
│  │ [Scansiona documento] [Sync provider]    │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─ Coda Review ───────────────────────────┐    │
│  │ FT 2026/0142 - Rossi SRL   [85%] [✓][✗]│    │
│  │ FT 2026/0143 - ???         [62%] [✓][✗] │    │
│  │ Mov. 15/03 - €1.250,00    [Match?][+]   │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  [Conferma tutti >90%]  [Rivedi incerti]        │
└─────────────────────────────────────────────────┘
```

**Feature chiave:** "Conferma tutti >90%" — un click conferma tutte le fatture e riconciliazioni ad alta confidence. Il commercialista rivede solo gli incerti.

---

## Sub-project 2: Controlli Proattivi

### 2.1 Anomaly Engine

```
Trigger Events ──▶ Check Pipeline ──▶ Anomalia classificata + priorità ──▶ Sistema Notifiche
(operazione salvata,    │
 sync banca,            ├─ 1. Regole deterministiche → risultato certo
 import fattura,        ├─ 2. Pattern statistici → deviazione rilevata
 cron giornaliero)      └─ 3. Claude AI → anomalia semantica
```

### 2.2 Catalogo Controlli

**Regole deterministiche (sempre attive):**

| Controllo | Cosa verifica | Priorità |
|-----------|--------------|----------|
| Quadratura IVA | IVA vendite vs acquisti vs liquidazione coerenti | CRITICA |
| Dare/Avere | Ogni scrittura contabile è bilanciata | CRITICA |
| Protocollo IVA | Numerazione registri senza buchi | ALTA |
| Fatture senza registrazione | Fatture importate ma non registrate nel registro IVA | ALTA |
| Scadenze scoperte | F24/LIPE/CU con scadenza < 7gg e stato non completato | CRITICA |
| Cassa negativa | Saldo cassa < 0 | ALTA |
| Ritenute non versate | Ritenute operate ma non versate entro il 16 del mese successivo | ALTA |
| Plafond sforato | Utilizzo plafond > disponibilità | CRITICA |
| Ammortamenti mancanti | Cespiti attivi senza quota ammortamento per l'anno corrente | MEDIA |
| Anagrafiche incomplete | Fornitore/cliente senza P.IVA o CF | MEDIA |

**Pattern statistici:**

| Controllo | Cosa rileva | Esempio |
|-----------|------------|---------|
| Categoria anomala | Operazione classificata diversamente dal pattern storico | "Fattura Rossi SRL in 'Consulenze' — storico sempre in 'Manutenzioni'" |
| Doppia fattura | Stesso fornitore + stesso importo + stessa data | "Possibile duplicato: FT 142 e FT 143 da Bianchi SRL" |

**Claude AI (analisi semantica):**

| Controllo | Cosa rileva | Esempio |
|-----------|------------|---------|
| Incoerenza descrizione/categoria | La descrizione non corrisponde alla classificazione | "Descrizione 'Riparazione server' in categoria 'Cancelleria'" |
| Regime IVA sospetto | Natura IVA potenzialmente errata | "Fornitore tedesco con IVA 22% — dovrebbe essere reverse charge?" |
| Rischio compliance | Pattern che potrebbe attirare controlli | "Alto volume di autofatture nello stesso trimestre" |

### 2.3 Dashboard "Salute Azienda"

```
┌─────────────────────────────────────────────────────┐
│  Salute Contabile              [Società X] [2026]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Contabilità      ██████████░░  85%  [2 alert]      │
│  IVA              ████████████  100% [OK]            │
│  Scadenze         ████████░░░░  70%  [1 critica]    │
│  Documentale      ██████░░░░░░  55%  [5 mancanti]   │
│  Banca            █████████░░░  80%  [3 da riconc]  │
│                                                      │
│  Score complessivo:  78/100                          │
│                                                      │
│  ┌─ Azioni richieste (per priorità) ──────────┐    │
│  │ CRITICA: F24 IRES scade tra 2gg — non       │    │
│  │   generato [Genera ora]                      │    │
│  │ ALTA: 3 fatture passive senza registrazione  │    │
│  │   IVA [Vedi]                                 │    │
│  │ ALTA: Possibile duplicato FT 142/143 [Verif.]│   │
│  │ MEDIA: 5 anagrafiche senza P.IVA [Completa] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Vista multi-azienda ──────────────────────┐    │
│  │ Società A  92/100  ●●●○  [OK]              │    │
│  │ Società B  78/100  ●●○○  [2 alert]         │    │
│  │ Società C  45/100  ●○○○  [URGENTE]         │    │
│  │ Società D  88/100  ●●●○  [1 alert]         │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Differenziatore:** la vista multi-azienda. Il commercialista con 30 clienti vede in un colpo d'occhio chi ha bisogno di attenzione.

### 2.4 Modello dati

```prisma
model Anomalia {
  id            Int                @id @default(autoincrement())
  societaId     Int                @map("societa_id")
  tipo          AnomaliaTipo       @map("tipo")
  sorgente      AnomaliaSorgente   @map("sorgente")
  priorita      NotificaPriorita   @map("priorita")   // riusa enum notifiche
  titolo        String             @map("titolo") @db.VarChar(255)
  descrizione   String             @map("descrizione") @db.Text
  entityType    String?            @map("entity_type") @db.VarChar(50)
  entityId      Int?               @map("entity_id")
  stato         AnomaliaStato      @default(APERTA) @map("stato")
  risoltaDa     Int?               @map("risolta_da")
  risoltaAt     DateTime?          @map("risolta_at")
  metadati      Json?              @map("metadati")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  societa       Societa            @relation(fields: [societaId], references: [id])

  @@index([societaId, stato])
  @@index([entityType, entityId])
  @@map("anomalie")
}

model HealthScore {
  id                  Int      @id @default(autoincrement())
  societaId           Int      @map("societa_id")
  anno                Int      @map("anno")
  mese                Int      @map("mese")
  areaContabilita     Int      @map("area_contabilita")     // 0-100
  areaIva             Int      @map("area_iva")
  areaScadenze        Int      @map("area_scadenze")
  areaDocumentale     Int      @map("area_documentale")
  areaBanca           Int      @map("area_banca")
  scoreComplessivo    Int      @map("score_complessivo")
  calcolatoAt         DateTime @map("calcolato_at")

  societa             Societa  @relation(fields: [societaId], references: [id])

  @@unique([societaId, anno, mese])
  @@index([societaId])
  @@map("health_scores")
}

enum AnomaliaTipo {
  QUADRATURA
  DUPLICATO
  COMPLIANCE
  DOCUMENTALE
  SCADENZA
  CATEGORIA_ANOMALA
  REGIME_IVA_SOSPETTO
  INCOERENZA_SEMANTICA
}

enum AnomaliaSorgente {
  REGOLA
  PATTERN
  AI
}

enum AnomaliaStato {
  APERTA
  RISOLTA
  IGNORATA
  FALSO_POSITIVO
}
```

**HealthScore — strategia di refresh:**
Lo score viene ricalcolato da un cron job giornaliero (notturno). Le pagine dashboard leggono l'ultimo score salvato. Quando un evento rilevante accade (operazione creata, anomalia risolta), il campo `calcolatoAt` viene confrontato con l'ultimo evento — se stale, viene ricalcolato on-demand (con cache di 5 minuti per evitare ricalcoli multipli su azioni batch).

---

## Sub-project 3: Copilota Adempimenti

### 3.1 Calendario Fiscale Intelligente

Il sistema genera automaticamente le scadenze per ogni società in base alle sue caratteristiche (regime fiscale, periodicità IVA, tipo società, presenza ritenute/cespiti). Nessuna configurazione manuale.

**Template scadenze nazionali:**

| Scadenza | Frequenza | Giorno | Condizione |
|----------|-----------|--------|------------|
| F24 ritenute | Mensile | 16 | Se ha operazioni con ritenuta |
| F24 IVA | Mensile/Trim. | 16 | Basato su periodicità IVA società |
| F24 acconto IRES/IRPEF | Annuale | 30/06 e 30/11 | Basato su tipo società |
| LIPE | Trimestrale | Fine mese+45gg | Sempre |
| CU invio | Annuale | 16/03 | Se ha ritenute nell'anno |
| Dichiarazione IVA | Annuale | 30/04 | Sempre |
| Dichiarazione 770 | Annuale | 31/10 | Se ha ritenute |
| Redditi SC/SP | Annuale | 30/11 | Basato su tipo società |
| IRAP | Annuale | 30/11 | Sempre |
| Bilancio deposito | Annuale | 30gg da approvazione | Solo società di capitali |
| Diritto annuale CCIAA | Annuale | 30/06 | Sempre |
| Acconto IVA | Annuale | 27/12 | Sempre |
| Conservazione sostitutiva | Annuale | 3 mesi da dichiarazione | Se ha documenti |

**Nota:** `ScadenzaFiscale` (auto-generata) coesiste con `ScadenzaAzienda` esistente (manuale). La UI le mostra entrambe nel calendario, con indicazione visiva di quale è automatica e quale manuale.

### 3.2 Workflow con Checklist

Ogni scadenza è un workflow con checklist auto-verificata:

```
Scadenza: F24 IVA Marzo 2026 — Società X
Scade: 16/04/2026
Stato: ██████░░░░ 60% — IN PREPARAZIONE

Checklist:
  ✅ Tutte le fatture marzo registrate
  ✅ Registri IVA marzo quadrano
  ⬜ Liquidazione IVA marzo calcolata
  ⬜ F24 generato
  ⬜ F24 pagato/inviato

[Prossima azione: Calcola liquidazione IVA →]
```

Il sistema sa cosa manca perché conosce i dati. Se tutte le fatture sono registrate e i registri quadrano, il bottone "Calcola liquidazione" è già pronto. Se mancano fatture, lo segnala come blocco.

**`queryVerifica` — pattern di verifica:**
Il campo `queryVerifica` su `ChecklistAdempimento` contiene un identificatore di funzione da un registry predefinito. Ogni identificatore corrisponde a una funzione TypeScript che esegue una query e restituisce `{completata: boolean, dettaglio?: string}`.

Funzioni disponibili:
- `fattureMeseRegistrate` — conta fatture del periodo e verifica che tutte abbiano dataRegistrazione
- `registriIvaQuadrano` — esegue quadratura IVA vendite/acquisti per il periodo
- `liquidazioneCalcolata` — verifica esistenza LiquidazioneIva per il periodo
- `f24Generato` — verifica esistenza F24Versamento per il periodo
- `f24Pagato` — verifica stato PAGATO su F24Versamento
- `ritenuteVersate` — verifica che tutte le ritenute del periodo siano versate
- `cuGenerata` — verifica esistenza CertificazioneUnica per l'anno
- `lipeGenerata` — verifica esistenza LipeInvio per il trimestre
- `bilancioGenerato` — verifica esistenza BilancioGenerato per l'anno

Il registry è estendibile: aggiungere un nuovo check significa implementare una funzione e registrarla con il suo identificatore.

### 3.3 Vista Copilota

```
┌──────────────────────────────────────────────────────┐
│  Copilota Adempimenti                  Marzo 2026    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─ Questa settimana ──────────────────────────┐    │
│  │  16/04 — F24 IVA (12 società)               │    │
│  │    8 pronte [Genera tutti]                   │    │
│  │    3 quasi pronte (manca liquidazione)       │    │
│  │    1 bloccata (fatture mancanti)             │    │
│  │                                              │    │
│  │  16/04 — F24 Ritenute (5 società)           │    │
│  │    5 pronte [Genera tutti]                   │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Prossime 2 settimane ─────────────────────┐    │
│  │  30/04 — Dichiarazione IVA annuale          │    │
│  │    10 da preparare [Inizia preparazione]     │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Azioni batch ──────────────────────────────┐    │
│  │ [Genera tutti F24 pronti]                    │    │
│  │ [Calcola tutte liquidazioni mancanti]        │    │
│  │ [Invia reminder clienti doc mancanti]        │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Riepilogo per società ─────────────────────┐    │
│  │ Società A  ████████████ 4/4 completati      │    │
│  │ Società B  ████████░░░░ 2/3 completati      │    │
│  │ Società C  ████░░░░░░░░ 1/4 — bloccata      │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Killer feature:**
- **Azioni batch multi-società** — "Genera tutti gli F24 pronti" con un click per tutte le società
- **Stato bloccante visibile** — non solo "scade il 16" ma "manca X per poterlo completare"
- **Preparazione anticipata** — segnalazione 30 giorni prima, non 3

### 3.4 Modello dati

```prisma
model ScadenzaFiscale {
  id                        Int                  @id @default(autoincrement())
  societaId                 Int                  @map("societa_id")
  tipo                      ScadenzaFiscaleTipo  @map("tipo")
  anno                      Int                  @map("anno")
  periodo                   Int?                 @map("periodo")   // mese o trimestre
  scadenza                  DateTime             @map("scadenza") @db.Date
  stato                     ScadenzaFiscaleStato @default(NON_INIZIATA) @map("stato")
  percentualeCompletamento  Int                  @default(0) @map("percentuale_completamento")
  entityGenerataId          Int?                 @map("entity_generata_id")  // link all'F24/LIPE/CU generato
  entityGenerataTipo        String?              @map("entity_generata_tipo") @db.VarChar(50)
  bloccataDa                String?              @map("bloccata_da") @db.VarChar(500)
  createdAt                 DateTime             @default(now()) @map("created_at")
  updatedAt                 DateTime             @updatedAt @map("updated_at")

  societa                   Societa              @relation(fields: [societaId], references: [id])
  checklist                 ChecklistAdempimento[]

  @@unique([societaId, tipo, anno, periodo])
  @@index([societaId, scadenza])
  @@index([stato])
  @@map("scadenze_fiscali")
}

model ChecklistAdempimento {
  id                    Int      @id @default(autoincrement())
  scadenzaFiscaleId     Int      @map("scadenza_fiscale_id")
  ordine                Int      @map("ordine")
  descrizione           String   @map("descrizione") @db.VarChar(255)
  verificaAutomatica    Boolean  @default(false) @map("verifica_automatica")
  queryVerifica         String?  @map("query_verifica") @db.VarChar(100)  // identificatore funzione registry
  completata            Boolean  @default(false) @map("completata")
  completataAt          DateTime? @map("completata_at")

  scadenzaFiscale       ScadenzaFiscale @relation(fields: [scadenzaFiscaleId], references: [id], onDelete: Cascade)

  @@index([scadenzaFiscaleId])
  @@map("checklist_adempimenti")
}

enum ScadenzaFiscaleTipo {
  F24_IVA
  F24_RITENUTE
  F24_ACCONTO_IRES
  F24_ACCONTO_IRPEF
  LIPE
  CU
  DICHIARAZIONE_IVA
  DICHIARAZIONE_770
  REDDITI
  IRAP
  BILANCIO_DEPOSITO
  DIRITTO_CCIAA
  ACCONTO_IVA
  CONSERVAZIONE
}

enum ScadenzaFiscaleStato {
  NON_INIZIATA
  IN_PREPARAZIONE
  PRONTA
  COMPLETATA
  SCADUTA
}
```

---

## Sub-project 4: Comunicazione Cliente

### 4.1 Portale Cliente

Area riservata dove il cliente del commercialista accede con credenziali proprie. Vista minimale, zero complessità contabile.

```
┌──────────────────────────────────────────────────────┐
│  Portale [Nome Società]          Benvenuto, Mario    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─ Da fare ───────────────────────────────────┐    │
│  │  Carica fatture passive marzo (scade 5/04)  │    │
│  │    [Carica file]                             │    │
│  │  Conferma dati CU 2025 [Rivedi e conferma]  │    │
│  │  Il tuo commercialista chiede:               │    │
│  │    "Fattura Rossi SRL €3.200 — è un cespite │    │
│  │     o un costo?" [Cespite] [Costo] [Non so] │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Situazione ────────────────────────────────┐    │
│  │  IVA trimestre corrente: credito €2.340     │    │
│  │  Prossima scadenza: F24 16/04 — €1.850     │    │
│  │  [Vedi report trimestrale]                   │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Documenti ─────────────────────────────────┐    │
│  │  Bilancio 2025          [Scarica PDF]        │    │
│  │  CU 2025               [Scarica PDF]         │    │
│  │  F24 Marzo 2026        [Scarica PDF]         │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─ Messaggi ──────────────────────────────────┐    │
│  │  22/03 — "Situazione IVA Q1 2026" [Leggi]  │    │
│  │  15/03 — "Promemoria documenti" [Leggi]     │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Principio:** il cliente non vede contabilità — vede azioni da fare, la sua situazione in linguaggio semplice, e i documenti pronti.

**Architettura autenticazione portale:**
Il portale cliente usa un sistema di autenticazione separato da NextAuth (che gestisce utenti/soci):
- Route group dedicato `/portale/[...]` con layout e middleware separati
- Autenticazione JWT stateless con token firmato contenente `{accessoClienteId, societaId, ruolo}`
- Login via email + password (bcrypt), con endpoint `/api/portale/auth/login`
- Password reset via token email (Resend), endpoint `/api/portale/auth/reset-password`
- Rate limiting su endpoint login (max 5 tentativi / 15 minuti per IP)
- CSRF protection via SameSite cookie + header check
- Nessuna condivisione di sessione con il sistema principale — il cliente non può accedere alle route del commercialista

### 4.2 Richieste Documenti Automatiche

Il sistema incrocia movimenti bancari non riconciliati con fatture mancanti e genera richieste specifiche.

```
Checklist adempimento (Layer 3) + Documenti mancanti rilevati
        │
        ▼
  Claude AI genera messaggio personalizzato
        │
        ├──▶ Portale (notifica)
        └──▶ Email (se configurato)
```

**Esempio messaggio generato:**

> Buongiorno Mario,
>
> per completare gli adempimenti IVA del primo trimestre 2026 mi servirebbero le fatture di acquisto di marzo. In particolare risultano mancanti rispetto ai movimenti bancari:
> - Pagamento €450 del 12/03 (possibile fornitore: Enel Energia)
> - Pagamento €1.200 del 18/03 (non identificato)
>
> Puoi caricarle direttamente dal portale oppure inviarle in risposta a questa email.
>
> Grazie, Studio Bianchi

### 4.3 Report Narrativi AI

Claude trasforma dati contabili in testo comprensibile per il cliente.

| Report | Contenuto | Frequenza |
|--------|-----------|-----------|
| Situazione IVA | Credito/debito, andamento, previsione | Trimestrale |
| Andamento economico | Ricavi vs costi, margine, confronto anno precedente | Mensile/Trimestrale |
| Pre-scadenza | Cosa si paga, quanto, perché | Prima di ogni F24 |
| Riepilogo annuale | Sintesi anno fiscale, risultato, punti di attenzione | Annuale |

**Flusso:** Claude genera → commercialista rivede/modifica → approva → invio al cliente. Mai invio automatico senza approvazione.

### 4.4 Domande Rapide al Cliente

Domande con opzioni predefinite, risposte applicabili automaticamente.

**Esempi:**
- "La fattura X è un cespite o un costo?" → [Cespite] [Costo] [Non so]
- "L'auto aziendale è ad uso promiscuo o esclusivo?" → [Promiscuo] [Esclusivo]
- "Confermi che questo bonifico da €5.000 è un prestito soci?" → [Sì] [No, è...]

Se il cliente clicca "Cespite", l'operazione viene riclassificata automaticamente.

### 4.5 Controllo del Commercialista

Il commercialista ha pieno controllo su ciò che il cliente vede e riceve.

### 4.6 Modello dati

```prisma
model ConfigurazionePortale {
  id                        Int      @id @default(autoincrement())
  societaId                 Int      @unique @map("societa_id")
  portaleAttivo             Boolean  @default(false) @map("portale_attivo")
  clientePuoCaricareFatture Boolean  @default(true) @map("cliente_puo_caricare_fatture")
  clienteVedeSituazioneIva  Boolean  @default(true) @map("cliente_vede_situazione_iva")
  clienteVedeSaldo          Boolean  @default(false) @map("cliente_vede_saldo")
  clienteVedeScadenze       Boolean  @default(true) @map("cliente_vede_scadenze")
  reportAutomatici          Boolean  @default(false) @map("report_automatici")
  invioEmailAutomatico      Boolean  @default(false) @map("invio_email_automatico")
  firmaEmail                String?  @map("firma_email") @db.VarChar(500)
  logoUrl                   String?  @map("logo_url") @db.VarChar(500)
  createdAt                 DateTime @default(now()) @map("created_at")
  updatedAt                 DateTime @updatedAt @map("updated_at")

  societa                   Societa  @relation(fields: [societaId], references: [id])

  @@map("configurazione_portale")
}

model AccessoCliente {
  id              Int            @id @default(autoincrement())
  societaId       Int            @map("societa_id")
  nome            String         @map("nome") @db.VarChar(100)
  email           String         @map("email") @db.VarChar(255)
  passwordHash    String         @map("password_hash") @db.VarChar(255)
  ruolo           RuoloCliente   @map("ruolo")
  ultimoAccesso   DateTime?      @map("ultimo_accesso")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  societa         Societa        @relation(fields: [societaId], references: [id])
  richieste       RichiestaDocumento[]
  documenti       DocumentoCondiviso[]
  notifiche       Notifica[]     @relation("NotificheCliente")

  @@unique([societaId, email])
  @@map("accessi_cliente")
}

model RichiestaDocumento {
  id                        Int                      @id @default(autoincrement())
  societaId                 Int                      @map("societa_id")
  accessoClienteId          Int                      @map("accesso_cliente_id")
  tipo                      RichiestaDocumentoTipo   @map("tipo")
  titolo                    String                   @map("titolo") @db.VarChar(255)
  messaggio                 String                   @map("messaggio") @db.Text
  scadenza                  DateTime?                @map("scadenza") @db.Date
  stato                     RichiestaDocumentoStato  @default(INVIATA) @map("stato")
  risposta                  String?                  @map("risposta") @db.Text
  rispostaAt                DateTime?                @map("risposta_at")
  applicataAutomaticamente  Boolean                  @default(false) @map("applicata_automaticamente")
  entityType                String?                  @map("entity_type") @db.VarChar(50)
  entityId                  Int?                     @map("entity_id")
  createdAt                 DateTime                 @default(now()) @map("created_at")
  updatedAt                 DateTime                 @updatedAt @map("updated_at")

  societa                   Societa                  @relation(fields: [societaId], references: [id])
  accessoCliente            AccessoCliente           @relation(fields: [accessoClienteId], references: [id])
  domande                   DomandaCliente[]

  @@index([societaId, stato])
  @@index([accessoClienteId])
  @@map("richieste_documento")
}

model DomandaCliente {
  id                      Int      @id @default(autoincrement())
  richiestaDocumentoId    Int      @map("richiesta_documento_id")
  testo                   String   @map("testo") @db.VarChar(500)
  opzioni                 Json     @map("opzioni")  // [{label, value, azione?}]
  rispostaSelezionata     String?  @map("risposta_selezionata") @db.VarChar(100)
  azioneEseguita          Boolean  @default(false) @map("azione_eseguita")
  updatedAt               DateTime @updatedAt @map("updated_at")

  richiestaDocumento      RichiestaDocumento @relation(fields: [richiestaDocumentoId], references: [id], onDelete: Cascade)

  @@index([richiestaDocumentoId])
  @@map("domande_cliente")
}

model ReportCliente {
  id                  Int                  @id @default(autoincrement())
  societaId           Int                  @map("societa_id")
  tipo                ReportClienteTipo    @map("tipo")
  periodo             String               @map("periodo") @db.VarChar(20)  // es. "2026-Q1", "2026-03"
  contenutoGenerato   String               @map("contenuto_generato") @db.LongText
  contenutoApprovato  String?              @map("contenuto_approvato") @db.LongText
  stato               ReportClienteStato   @default(GENERATO) @map("stato")
  inviatoVia          NotificaCanale?      @map("inviato_via")
  inviatoAt           DateTime?            @map("inviato_at")
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")

  societa             Societa              @relation(fields: [societaId], references: [id])

  @@index([societaId, stato])
  @@map("report_cliente")
}

model DocumentoCondiviso {
  id                Int                   @id @default(autoincrement())
  societaId         Int                   @map("societa_id")
  accessoClienteId  Int                   @map("accesso_cliente_id")
  nome              String                @map("nome") @db.VarChar(255)
  tipo              DocumentoCondivisoTipo @map("tipo")
  fileUrl           String                @map("file_url") @db.VarChar(500)
  condivisoAt       DateTime              @default(now()) @map("condiviso_at")

  societa           Societa               @relation(fields: [societaId], references: [id])
  accessoCliente    AccessoCliente        @relation(fields: [accessoClienteId], references: [id])

  @@index([societaId])
  @@index([accessoClienteId])
  @@map("documenti_condivisi")
}

enum RuoloCliente {
  TITOLARE
  DELEGATO
}

enum RichiestaDocumentoTipo {
  FATTURE_MANCANTI
  CONFERMA_DATI
  DOMANDA
  GENERICO
}

enum RichiestaDocumentoStato {
  INVIATA
  VISTA
  RISPOSTA
  SCADUTA
}

enum ReportClienteTipo {
  IVA_TRIMESTRALE
  ANDAMENTO
  PRE_SCADENZA
  ANNUALE
}

enum ReportClienteStato {
  GENERATO
  APPROVATO
  INVIATO
}

enum DocumentoCondivisoTipo {
  BILANCIO
  CU
  F24
  REPORT
  ALTRO
}
```

---

## Riepilogo modelli dati nuovi

| Modello | Sub-project | Scopo | Tabella DB |
|---------|-------------|-------|------------|
| ProviderConfig | 0 | Configurazione provider per società | provider_config |
| AiSuggestion | 0 | Tracciamento suggerimenti AI | ai_suggestions |
| Notifica | 0 | Notifiche multi-canale | notifiche |
| PreferenzaNotifica | 0 | Preferenze utente per notifiche | preferenze_notifica |
| Anomalia | 2 | Anomalie rilevate dai controlli | anomalie |
| HealthScore | 2 | Score salute mensile per società | health_scores |
| ScadenzaFiscale | 3 | Scadenze fiscali auto-generate | scadenze_fiscali |
| ChecklistAdempimento | 3 | Checklist per ogni scadenza | checklist_adempimenti |
| ConfigurazionePortale | 4 | Configurazione portale per società | configurazione_portale |
| AccessoCliente | 4 | Accesso cliente al portale | accessi_cliente |
| RichiestaDocumento | 4 | Richieste documenti al cliente | richieste_documento |
| DomandaCliente | 4 | Domande rapide con opzioni | domande_cliente |
| ReportCliente | 4 | Report narrativi AI | report_cliente |
| DocumentoCondiviso | 4 | Documenti condivisi col cliente | documenti_condivisi |

**Totale: 14 nuovi modelli Prisma.**

**Relazioni da aggiungere su Societa:**

```prisma
// Da aggiungere al modello Societa esistente
providerConfigs        ProviderConfig[]
aiSuggestions          AiSuggestion[]
notifiche              Notifica[]
anomalie               Anomalia[]
healthScores           HealthScore[]
scadenzeFiscali        ScadenzaFiscale[]
configurazionePortale  ConfigurazionePortale?
accessiCliente         AccessoCliente[]
richiesteDocumento     RichiestaDocumento[]
reportCliente          ReportCliente[]
documentiCondivisi     DocumentoCondiviso[]
```

**Relazioni da aggiungere su Utente:**

```prisma
// Da aggiungere al modello Utente esistente
notificheRicevute      Notifica[]            @relation("NotificheUtente")
preferenzeNotifica     PreferenzaNotifica[]
```
