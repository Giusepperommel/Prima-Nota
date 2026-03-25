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
  id            String   @id @default(cuid())
  societaId     String
  tipo          ProviderTipo     // FATTURE | BANCA
  provider      ProviderNome     // FILE | ARUBA | INFOCERT | FABRICK | NORDIGEN
  credenziali   Json?            // encrypted, provider-specific
  stato         ProviderStato    // ATTIVO | CONFIGURAZIONE | ERRORE
  ultimoSync    DateTime?
  configExtra   Json?            // es. IBAN per banca, codice destinatario per SDI
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  societa       Societa  @relation(fields: [societaId], references: [id])

  @@unique([societaId, tipo, provider])
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
  id            String   @id @default(cuid())
  societaId     String
  tipo          AiSuggestionTipo    // CLASSIFICAZIONE | ANOMALIA | RICONCILIAZIONE | NARRATIVA
  entityType    String              // OPERAZIONE | MOVIMENTO_BANCARIO | FATTURA
  entityId      String
  suggestion    Json                // il suggerimento strutturato
  confidence    Float               // 0.0 - 1.0
  stato         AiSuggestionStato   // PENDING | APPROVED | REJECTED | AUTO_APPLIED
  motivazione   String?  @db.Text   // spiegazione leggibile dell'AI
  reviewedBy    String?
  reviewedAt    DateTime?
  createdAt     DateTime @default(now())

  societa       Societa  @relation(fields: [societaId], references: [id])
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

---

### 0.3 Sistema Notifiche e Alert

Motore unico di notifiche che alimenta tutti i layer.

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
  id              String   @id @default(cuid())
  societaId       String
  destinatarioId  String              // utente o cliente portale
  tipo            NotificaTipo        // SCADENZA | ANOMALIA | DOCUMENTO | SYNC | ADEMPIMENTO | AI_REVIEW
  priorita        NotificaPriorita    // CRITICA | ALTA | MEDIA | BASSA
  titolo          String
  messaggio       String   @db.Text
  entityType      String?
  entityId        String?
  canale          NotificaCanale      // IN_APP | EMAIL | PORTALE
  stato           NotificaStato       // NON_LETTA | LETTA | ARCHIVIATA
  scheduledAt     DateTime?
  sentAt          DateTime?
  createdAt       DateTime @default(now())

  societa         Societa  @relation(fields: [societaId], references: [id])
}

model PreferenzaNotifica {
  id              String   @id @default(cuid())
  utenteId        String
  tipoEvento      String
  canale          String
  abilitato       Boolean  @default(true)
  digestFrequency DigestFrequency     // IMMEDIATO | GIORNALIERO | SETTIMANALE

  @@unique([utenteId, tipoEvento, canale])
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
  id            String   @id @default(cuid())
  societaId     String
  tipo          AnomaliaTipo       // QUADRATURA | DUPLICATO | IMPORTO_ANOMALO | COMPLIANCE | DOCUMENTALE | SCADENZA
  sorgente      AnomaliaSorgente   // REGOLA | PATTERN | AI
  priorita      NotificaPriorita   // CRITICA | ALTA | MEDIA | BASSA (riusa enum notifiche)
  titolo        String
  descrizione   String   @db.Text
  entityType    String?
  entityId      String?
  stato         AnomaliaStato      // APERTA | RISOLTA | IGNORATA | FALSO_POSITIVO
  risoltaDa     String?
  risoltaAt     DateTime?
  metadati      Json?              // dati specifici del controllo
  createdAt     DateTime @default(now())

  societa       Societa  @relation(fields: [societaId], references: [id])
}

model HealthScore {
  id                  String   @id @default(cuid())
  societaId           String
  anno                Int
  mese                Int
  areaContabilita     Int      // 0-100
  areaIva             Int
  areaScadenze        Int
  areaDocumentale     Int
  areaBanca           Int
  scoreComplessivo    Int
  calcolatoAt         DateTime

  societa             Societa  @relation(fields: [societaId], references: [id])

  @@unique([societaId, anno, mese])
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

---

## Sub-project 3: Copilota Adempimenti

### 3.1 Calendario Fiscale Intelligente

Il sistema genera automaticamente le scadenze per ogni società in base alle sue caratteristiche (regime fiscale, periodicità IVA, tipo società, presenza ritenute/cespiti). Nessuna configurazione manuale.

**Template scadenze nazionali:**

| Scadenza | Frequenza | Giorno | Condizione |
|----------|-----------|--------|------------|
| F24 ritenute | Mensile | 16 | Se ha operazioni con ritenuta |
| F24 IVA | Mensile/Trim. | 16 | Basato su periodicità IVA società |
| LIPE | Trimestrale | Fine mese+45gg | Sempre |
| CU invio | Annuale | 16/03 | Se ha ritenute nell'anno |
| Dichiarazione IVA | Annuale | 30/04 | Sempre |
| Redditi SC/SP | Annuale | 30/11 | Basato su tipo società |
| IRAP | Annuale | 30/11 | Sempre |
| Bilancio deposito | Annuale | 30gg da approvazione | Solo società di capitali |
| Acconto IVA | Annuale | 27/12 | Sempre |
| Conservazione sostitutiva | Annuale | 3 mesi da dichiarazione | Se ha documenti |

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
  id                        String   @id @default(cuid())
  societaId                 String
  tipo                      ScadenzaFiscaleTipo
  anno                      Int
  periodo                   Int?     // mese o trimestre
  scadenza                  DateTime
  stato                     ScadenzaFiscaleStato
  percentualeCompletamento  Int      @default(0)
  entityGenerataId          String?  // link all'F24/LIPE/CU generato
  bloccataDa                String?  // descrizione del blocco
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  societa                   Societa  @relation(fields: [societaId], references: [id])
  checklist                 ChecklistAdempimento[]
}

model ChecklistAdempimento {
  id                    String   @id @default(cuid())
  scadenzaFiscaleId     String
  ordine                Int
  descrizione           String
  verificaAutomatica    Boolean  @default(false)
  queryVerifica         String?  // come verificare (es. "contaFattureMancanti")
  completata            Boolean  @default(false)
  completataAt          DateTime?

  scadenzaFiscale       ScadenzaFiscale @relation(fields: [scadenzaFiscaleId], references: [id], onDelete: Cascade)
}

enum ScadenzaFiscaleTipo {
  F24_IVA
  F24_RITENUTE
  LIPE
  CU
  DICHIARAZIONE_IVA
  REDDITI
  IRAP
  BILANCIO_DEPOSITO
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

```prisma
model ConfigurazionePortale {
  id                        String   @id @default(cuid())
  societaId                 String   @unique
  portaleAttivo             Boolean  @default(false)
  clientePuoCaricareFatture Boolean  @default(true)
  clienteVedeSituazioneIva  Boolean  @default(true)
  clienteVedeSaldo          Boolean  @default(false)
  clienteVedeScadenze       Boolean  @default(true)
  reportAutomatici          Boolean  @default(false)
  invioEmailAutomatico      Boolean  @default(false)
  firmaEmail                String?
  logoUrl                   String?

  societa                   Societa  @relation(fields: [societaId], references: [id])
}
```

### 4.6 Modello dati

```prisma
model AccessoCliente {
  id              String   @id @default(cuid())
  societaId       String
  nome            String
  email           String
  passwordHash    String
  ruolo           RuoloCliente     // TITOLARE | DELEGATO
  ultimoAccesso   DateTime?
  createdAt       DateTime @default(now())

  societa         Societa  @relation(fields: [societaId], references: [id])
  richieste       RichiestaDocumento[]
  documenti       DocumentoCondiviso[]

  @@unique([societaId, email])
}

model RichiestaDocumento {
  id                        String   @id @default(cuid())
  societaId                 String
  accessoClienteId          String
  tipo                      RichiestaDocumentoTipo  // FATTURE_MANCANTI | CONFERMA_DATI | DOMANDA | GENERICO
  titolo                    String
  messaggio                 String   @db.Text
  scadenza                  DateTime?
  stato                     RichiestaDocumentoStato // INVIATA | VISTA | RISPOSTA | SCADUTA
  risposta                  String?  @db.Text
  rispostaAt                DateTime?
  applicataAutomaticamente  Boolean  @default(false)
  entityType                String?
  entityId                  String?
  createdAt                 DateTime @default(now())

  societa                   Societa  @relation(fields: [societaId], references: [id])
  accessoCliente            AccessoCliente @relation(fields: [accessoClienteId], references: [id])
  domande                   DomandaCliente[]
}

model DomandaCliente {
  id                      String   @id @default(cuid())
  richiestaDocumentoId    String
  testo                   String
  opzioni                 Json     // [{label, value, azione?}]
  rispostaSelezionata     String?
  azioneEseguita          Boolean  @default(false)

  richiestaDocumento      RichiestaDocumento @relation(fields: [richiestaDocumentoId], references: [id], onDelete: Cascade)
}

model ReportCliente {
  id                  String   @id @default(cuid())
  societaId           String
  tipo                ReportClienteTipo     // IVA_TRIMESTRALE | ANDAMENTO | PRE_SCADENZA | ANNUALE
  periodo             String
  contenutoGenerato   String   @db.LongText  // markdown generato da Claude
  contenutoApprovato  String?  @db.LongText  // dopo revisione commercialista
  stato               ReportClienteStato    // GENERATO | APPROVATO | INVIATO
  inviatoVia          NotificaCanale?
  inviatoAt           DateTime?
  createdAt           DateTime @default(now())

  societa             Societa  @relation(fields: [societaId], references: [id])
}

model DocumentoCondiviso {
  id                String   @id @default(cuid())
  societaId         String
  accessoClienteId  String
  nome              String
  tipo              DocumentoCondivisoTipo  // BILANCIO | CU | F24 | REPORT | ALTRO
  fileUrl           String
  condivisoAt       DateTime @default(now())

  societa           Societa  @relation(fields: [societaId], references: [id])
  accessoCliente    AccessoCliente @relation(fields: [accessoClienteId], references: [id])
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

| Modello | Sub-project | Scopo |
|---------|-------------|-------|
| ProviderConfig | 0 | Configurazione provider per società |
| AiSuggestion | 0 | Tracciamento suggerimenti AI |
| Notifica | 0 | Notifiche multi-canale |
| PreferenzaNotifica | 0 | Preferenze utente per notifiche |
| Anomalia | 2 | Anomalie rilevate dai controlli |
| HealthScore | 2 | Score salute mensile per società |
| ScadenzaFiscale | 3 | Scadenze fiscali generate |
| ChecklistAdempimento | 3 | Checklist per ogni scadenza |
| ConfigurazionePortale | 4 | Configurazione portale per società |
| AccessoCliente | 4 | Accesso cliente al portale |
| RichiestaDocumento | 4 | Richieste documenti al cliente |
| DomandaCliente | 4 | Domande rapide con opzioni |
| ReportCliente | 4 | Report narrativi AI |
| DocumentoCondiviso | 4 | Documenti condivisi col cliente |

**Totale: 14 nuovi modelli Prisma.**
