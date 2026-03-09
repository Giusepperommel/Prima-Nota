# Specifica Tecnica - Applicativo Gestione Multi-Socio SRL

**Versione:** 1.0  
**Data:** 13 Febbraio 2025  
**Tipo Progetto:** Web Application (PWA) - Gestionale contabile per SRL con gestione parasociale

---

## 1. PANORAMICA PROGETTO

### 1.1 Obiettivo

Sviluppare un'applicazione web per la gestione contabile e amministrativa di una SRL con più soci, che tenga traccia di:
- Fatturati (comuni e individuali per socio)
- Costi e spese (comuni e individuali)
- Deducibilità fiscale secondo normativa italiana
- Ammortamenti pluriennali
- Ripartizione utili/perdite secondo quote societarie e accordi parasociali

### 1.2 Utenti Target

- **Primario:** 4 soci di una SRL italiana
- **Futuro:** Prodotto rivendibile a più società (architettura multi-tenant)

### 1.3 Requisiti Non Funzionali

- **Piattaforma:** Web application accessibile da browser desktop e mobile
- **Tecnologia:** Progressive Web App (PWA) per funzionalità mobile-like
- **Scalabilità:** Architettura predisposta per multi-tenant futuro
- **Sicurezza:** Autenticazione utenti, log attività, HTTPS
- **Performance:** Tempi risposta < 2 secondi per operazioni comuni
- **Compliance:** GDPR (dati EU), normativa fiscale italiana

---

## 2. REQUISITI FUNZIONALI

### 2.1 Gestione Utenti e Permessi

#### 2.1.1 Ruoli Utente

**Admin:**
- Configurazione società e soci
- Accesso completo a tutte le operazioni (proprie e altrui)
- Gestione categorie spesa
- Accesso log attività
- Generazione report globali
- Gestione permessi utenti

**Socio Standard:**
- Visualizzazione dati societari aggregati
- Inserimento/modifica solo operazioni proprie individuali
- Visualizzazione operazioni comuni (sola lettura)
- Visualizzazione quote personali su operazioni comuni
- Generazione report personali
- Dashboard personalizzata

#### 2.1.2 Log Attività (Solo Admin)

Tracciamento automatico e immutabile di:
- Timestamp operazione
- Utente esecutore
- Tipo azione (INSERT, UPDATE, DELETE)
- Entità modificata (tabella/record)
- Valori prima/dopo modifiche (formato JSON)
- Indirizzo IP sorgente

**Funzionalità UI Log:**
- Ricerca e filtri (utente, data, tipo azione, tabella)
- Ordinamento cronologico
- Export CSV
- Visualizzazione drill-down singola operazione
- Solo lettura (no modifica/cancellazione)

### 2.2 Gestione Società e Soci

#### 2.2.1 Anagrafica Società

Campi richiesti:
- Ragione sociale
- Partita IVA
- Codice fiscale
- Indirizzo sede legale
- Regime fiscale/contabile
- Data costituzione

#### 2.2.2 Anagrafica Soci

Campi per ogni socio:
- Nome e cognome
- Codice fiscale
- Email (per accesso sistema)
- Quota societaria (percentuale) - DECIMALE
- Ruolo utente (Admin/Standard)
- Data ingresso società
- Flag attivo/cessato

**Vincoli:**
- Somma quote tutti soci attivi = 100%
- Quote configurabili con decimali (es. 33.33%)
- Numero soci variabile (attualmente 4, ma parametrico)

### 2.3 Gestione Operazioni Contabili

#### 2.3.1 Tipi di Operazione

- **Fattura Attiva** (ricavo)
- **Fattura Passiva / Costo**
- **Spesa**
- **Acquisto Cespite** (bene ammortizzabile)

#### 2.3.2 Campi Comuni Operazione

- **Data operazione** (data documento)
- **Numero documento** (es. numero fattura)
- **Tipo operazione** (enum: fattura_attiva, costo, spesa, cespite)
- **Descrizione** testuale
- **Importo totale** (€)
- **Categoria spesa** (FK → tabella categorie)
- **Importo deducibile** (calcolato automaticamente da categoria)
- **Percentuale deducibilità** (ereditata da categoria, modificabile manualmente)
- **Flag modifica manuale deducibilità** (boolean)
- **Note** (campo testo libero opzionale)
- **File allegato** (opzionale - es. PDF fattura)
- **File XML** (opzionale - per import fattura elettronica)
- **Utente creatore** (FK → utente)
- **Timestamp creazione/modifica**

#### 2.3.3 Ripartizione tra Soci

Ogni operazione deve specificare come viene ripartita tra i soci:

**Modalità ripartizione (3 tipi):**

1. **COMUNE** - Ripartizione automatica secondo quote societarie
   - Sistema calcola automaticamente importo per socio
   - Socio A (40%) → 40% dell'importo totale
   - Socio B (30%) → 30% dell'importo totale
   - Socio C (20%) → 20% dell'importo totale
   - Socio D (10%) → 10% dell'importo totale

2. **SINGOLO SOCIO** - Attribuzione 100% a un socio specifico
   - Selezione socio da dropdown
   - Importo totale = 100% al socio selezionato
   - Altri soci = 0%

3. **CUSTOM** - Ripartizione personalizzata manuale
   - Input percentuale per ogni socio
   - Validazione: somma percentuali = 100%
   - Possibilità di coinvolgere solo alcuni soci (altri a 0%)

**Dati memorizzati (tabella ripartizioni):**
- Operazione_ID (FK)
- Socio_ID (FK)
- Percentuale assegnata (DECIMAL)
- Importo calcolato (€) = Importo_totale × Percentuale / 100

**Esempio pratico:**

```
Affitto ufficio: €1200
Modalità: COMUNE
→ Socio A (40%): €480
→ Socio B (30%): €360
→ Socio C (20%): €240
→ Socio D (10%): €120

Consulenza IT: €5000
Modalità: SINGOLO
→ Socio A: €5000
→ Altri: €0

Progetto condiviso: €2000
Modalità: CUSTOM
→ Socio A (50%): €1000
→ Socio C (50%): €1000
→ Socio B e D: €0
```

### 2.4 Gestione Categorie Spesa e Deducibilità

#### 2.4.1 Database Categorie

Ogni categoria contiene:
- **Nome categoria** (es. "Carburante auto", "Telefonia", "Formazione")
- **Percentuale deducibilità fiscale** (0-100%)
- **Descrizione/Note** (regole applicazione, riferimenti normativi)
- **Tipo categoria** (per raggruppamenti nei report)
- **Flag attiva** (per storicità - categorie obsolete restano ma non selezionabili)

#### 2.4.2 Categorie Precaricate (Standard Italiano)

Elenco minimo da precaricare:

| Categoria | % Deducibilità | Note |
|-----------|----------------|------|
| Carburante auto | 20% | Art. 164 TUIR |
| Telefonia mobile | 80% | Uso promiscuo |
| Telefonia fissa ufficio | 100% | Uso esclusivo |
| Formazione professionale | 100% | |
| Cancelleria e materiale ufficio | 100% | |
| Software e licenze | 100% | Deducibile o ammortizzabile |
| Hardware / Computer | 100% | Ammortizzabile |
| Affitto ufficio | 100% | |
| Utenze ufficio | 100% | |
| Consulenze professionali | 100% | |
| Rappresentanza | VARIABILE | Limiti art. 108 TUIR |
| Manutenzione auto | 20% | Coerente con carburante |
| Assicurazione auto | 20% | |
| Mobili e arredi | 100% | Ammortizzabile |
| Spese bancarie | 100% | |

#### 2.4.3 Funzionalità Categorie

- **CRUD categorie** (solo Admin)
- **Disattivazione** (non cancellazione) per storicità
- **Modifica % deducibilità** (applica solo a nuove operazioni)
- **Import/Export** categorie per replicabilità multi-tenant

#### 2.4.4 Calcolo Deducibilità su Operazione

**Logica automatica:**
1. Utente seleziona categoria durante inserimento operazione
2. Sistema legge % deducibilità da categoria
3. Calcola: `importo_deducibile = importo_totale × (percentuale / 100)`
4. Pre-compila campo importo_deducibile

**Override manuale:**
- Utente può modificare % o importo deducibile
- Sistema imposta flag "modifica_manuale = true"
- Nei report, evidenziare operazioni con deducibilità custom

### 2.5 Gestione Ammortamenti

#### 2.5.1 Registro Cespiti

Campi per ogni bene ammortizzabile:

**Dati acquisizione:**
- Descrizione bene
- Data acquisto
- Valore di acquisto (€)
- Categoria cespite (FK → categorie_cespiti)
- Fornitore
- Numero documento acquisto
- Note

**Dati ammortamento:**
- Tipo ammortamento (enum: ORDINARIO, ANTICIPATO, RIDOTTO_PRIMO_ANNO)
- Percentuale ammortamento annuo (%) - da categoria o custom
- Coefficiente ammortamento (da tabelle ministeriali)
- Valore residuo attuale (€) - calcolato

**Ripartizione soci:**
- Stessa logica ripartizione operazioni (COMUNE/SINGOLO/CUSTOM)
- Quote ammortamento annuale ripartite tra soci

**Stato:**
- Flag attivo (in uso/dismesso)
- Data dismissione (opzionale)

#### 2.5.2 Categorie Cespiti (Coefficienti Ministeriali)

Tabella categorie cespiti precaricata:

| Categoria | Coefficiente % | Anni Ammortamento |
|-----------|----------------|-------------------|
| Computer e hardware | 20% | 5 anni |
| Software applicativo | 50% | 2 anni |
| Software sistema operativo | 33.33% | 3 anni |
| Mobili e arredi ufficio | 12% | ~8 anni |
| Impianti e macchinari | 15% | ~7 anni |
| Autovetture | 25% | 4 anni |
| Telefonia e smartphone | 20% | 5 anni |
| Attrezzature elettroniche | 20% | 5 anni |

**Fonte:** Tabelle coefficienti ammortamento D.M. 31/12/1988

#### 2.5.3 Calcolo Ammortamento

**Logica di calcolo annuale:**

```
Primo anno (opzionale riduzione 50%):
  Se tipo_ammortamento = RIDOTTO_PRIMO_ANNO:
    quota_anno_1 = valore_acquisto × (percentuale / 100) × 0.5
  Altrimenti:
    quota_anno_1 = valore_acquisto × (percentuale / 100)

Anni successivi:
  quota_anno_N = valore_acquisto × (percentuale / 100)
  (fino a valore_residuo = 0 o dismissione)

Calcoli correlati:
  fondo_ammortamento_anno_N = SUM(quote_anni_precedenti)
  valore_residuo_anno_N = valore_acquisto - fondo_ammortamento_anno_N
```

**Esempio pratico:**

```
Computer acquistato: €2000
Categoria: Hardware (20% annuo)
Tipo: Ordinario con riduzione primo anno

Anno 1 (2025): quota = 2000 × 0.20 × 0.5 = €200
  Fondo ammortamento: €200
  Valore residuo: €1800

Anno 2 (2026): quota = 2000 × 0.20 = €400
  Fondo ammortamento: €600
  Valore residuo: €1400

Anno 3 (2027): quota = €400
  Fondo ammortamento: €1000
  Valore residuo: €1000

Anno 4 (2028): quota = €400
  Fondo ammortamento: €1400
  Valore residuo: €600

Anno 5 (2029): quota = €400
  Fondo ammortamento: €1800
  Valore residuo: €200

Anno 6 (2030): quota = €200 (ultima)
  Fondo ammortamento: €2000
  Valore residuo: €0
```

#### 2.5.4 Piano di Ammortamento

**Tabella quote annuali (auto-generata):**
- Cespite_ID (FK)
- Anno fiscale
- Quota ammortamento anno (€)
- Fondo ammortamento progressivo (€)
- Valore residuo fine anno (€)
- Flag maturata (boolean) - indica se anno concluso

**Generazione automatica:**
- Alla creazione cespite, sistema genera piano completo fino a ammortamento totale
- Ricalcolo automatico se modificati parametri (%, tipo ammortamento)

### 2.6 Import Fatture Elettroniche (XML)

#### 2.6.1 Funzionalità Upload XML

**Formato supportato:** XML fattura elettronica standard SDI (Sistema di Interscambio)

**Flusso operativo:**
1. Utente seleziona "Nuova operazione" → Upload XML
2. Sistema effettua parsing file XML
3. Estrae campi rilevanti:
   - Tipo documento (fattura attiva/passiva)
   - Numero fattura
   - Data emissione
   - Cedente/Prestatore (fornitore o cliente)
   - Importo imponibile
   - Importo IVA
   - Totale documento
   - Descrizione beni/servizi
4. Pre-compila form inserimento operazione
5. Utente completa dati mancanti:
   - Categoria spesa
   - Modalità ripartizione soci
   - Note aggiuntive
6. Conferma e salvataggio

**Campi XML da parsare (mapping):**

```xml
<!-- Esempio struttura XML fattura passiva -->
<FatturaElettronica>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Numero>123</Numero>
        <Data>2025-01-15</Data>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <Descrizione>Consulenza IT</Descrizione>
      <ImponibileImporto>4000.00</ImponibileImporto>
      <Aliquota>22.00</Aliquota>
      <Imposta>880.00</Imposta>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</FatturaElettronica>
```

**Mapping campi:**
- `Numero` → numero_documento
- `Data` → data_operazione
- `Descrizione` → descrizione
- `ImponibileImporto + Imposta` → importo_totale
- File XML salvato in campo `file_xml` per riferimento

#### 2.6.2 Gestione File

- Storage file XML allegati
- Possibilità scaricare XML originale da dettaglio operazione
- Upload multiplo (batch import)
- Validazione formato XML (schema XSD fattura PA)

### 2.7 Gestione Multi-Anno e Storico

#### 2.7.1 Anno Fiscale

**Configurazione:**
- Anno fiscale = anno solare (01/01 - 31/12)
- Possibilità filtrare/visualizzare dati per anno specifico
- Confronti multi-anno (ultimi 3-5 anni)

#### 2.7.2 Dati Storici

**Conservazione:**
- Tutte le operazioni mantenute indefinitamente
- Nessuna cancellazione fisica (solo flag logico)
- Modifiche tracciate in log attività

**Analisi temporali:**
- Trend fatturato anno su anno
- Evoluzione costi per categoria
- Confronto performance per socio
- Grafici andamento temporale

### 2.8 Dashboard e Reporting

#### 2.8.1 Dashboard Admin

**KPI principali:**
- Fatturato totale periodo (comune + individuale tutti soci)
- Costi totali periodo
- Utile/Perdita lordo
- Breakdown per socio (tabella):
  - Fatturato proprio individuale
  - Quota fatturato comune
  - Costi propri
  - Quota costi comuni
  - Utile/Perdita netto socio

**Visualizzazioni:**
- Grafici a torta: ripartizione fatturato per socio
- Grafici a barre: confronto costi per categoria
- Timeline andamento mensile fatturato/costi

**Operazioni recenti:**
- Lista ultime 10-20 operazioni inserite
- Link rapido a dettaglio/modifica

#### 2.8.2 Dashboard Socio Standard

**KPI personali:**
- Fatturato proprio individuale
- Quota su fatturato comune
- Totale entrate
- Costi propri
- Quota su costi comuni
- Utile/Perdita netto personale

**Operazioni personali:**
- Lista operazioni individuali (modificabili)
- Lista operazioni comuni con quota personale (sola lettura)

#### 2.8.3 Report PDF

**Tipi di report generabili:**

1. **Rendiconto Societario**
   - Periodo: selezionabile
   - Contenuto:
     - Riepilogo ricavi (comuni + individuali)
     - Riepilogo costi (comuni + individuali)
     - Dettaglio ammortamenti anno
     - Utile/Perdita
     - Ripartizione per socio
   - Livello dettaglio: sintetico o analitico (con lista operazioni)

2. **Report per Socio**
   - Socio: selezionabile
   - Periodo: selezionabile
   - Contenuto:
     - Fatturato individuale socio
     - Quote su operazioni comuni
     - Costi individuali
     - Quote su costi comuni
     - Ammortamenti di competenza
     - Utile/Perdita netto socio

3. **Report Fiscale (per commercialista)**
   - Periodo: anno fiscale
   - Contenuto:
     - Totale operazioni
     - Breakdown deducibile/indeducibile
     - Elenco categorie con importi
     - Piano ammortamenti anno
     - Dettaglio operazioni con deducibilità custom

4. **Piano Ammortamenti**
   - Elenco cespiti attivi
   - Quote ammortamento anno corrente
   - Proiezione anni futuri
   - Valori residui
   - Ripartizione per socio

5. **Report Comparativo Multi-Anno**
   - Anni: selezionabili (es. 2023-2025)
   - Contenuto:
     - Confronto fatturato anno su anno
     - Confronto costi anno su anno
     - Trend utile/perdita
     - Breakdown per categoria principali
   - Visualizzazione: tabella + grafici

**Parametri comuni report:**
- Periodo (data inizio - data fine)
- Socio specifico (opzionale)
- Livello dettaglio (sintetico/analitico)
- Filtri categoria (opzionale)

**Output:**
- Anteprima HTML
- Download PDF
- (Futuro) Export Excel/CSV

---

## 3. SCHEMA DATABASE

### 3.1 Entità Principali

#### Tabella: `societa`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | Identificativo univoco |
| ragione_sociale | VARCHAR(255) | NOT NULL | Nome società |
| partita_iva | VARCHAR(11) | NOT NULL, UNIQUE | P.IVA italiana |
| codice_fiscale | VARCHAR(16) | NOT NULL | CF società |
| indirizzo | TEXT | NULL | Sede legale |
| regime_fiscale | VARCHAR(100) | NULL | Regime contabile |
| data_costituzione | DATE | NULL | Data costituzione |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

**Note:** In ottica multi-tenant futuro, tutte le altre tabelle avranno FK `societa_id`

---

#### Tabella: `soci`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| societa_id | INT | FK → societa(id) | |
| nome | VARCHAR(100) | NOT NULL | |
| cognome | VARCHAR(100) | NOT NULL | |
| codice_fiscale | VARCHAR(16) | NOT NULL | |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Per login |
| quota_percentuale | DECIMAL(5,2) | NOT NULL, CHECK (0-100) | Es. 33.33 |
| ruolo | ENUM | 'admin', 'standard' | Ruolo utente |
| data_ingresso | DATE | NULL | |
| attivo | BOOLEAN | DEFAULT TRUE | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

**Vincolo business logic:** SUM(quota_percentuale) WHERE attivo=TRUE = 100.00

---

#### Tabella: `utenti`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| socio_id | INT | FK → soci(id), UNIQUE | Un socio = un utente |
| email | VARCHAR(255) | NOT NULL, UNIQUE | |
| password_hash | VARCHAR(255) | NOT NULL | Hash bcrypt |
| ultimo_accesso | TIMESTAMP | NULL | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### Tabella: `categorie_spesa`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| societa_id | INT | FK → societa(id) | Per multi-tenant |
| nome | VARCHAR(100) | NOT NULL | Es. "Carburante auto" |
| percentuale_deducibilita | DECIMAL(5,2) | NOT NULL, CHECK (0-100) | |
| descrizione | TEXT | NULL | Note, riferimenti normativi |
| tipo_categoria | VARCHAR(50) | NULL | Per raggruppamenti |
| attiva | BOOLEAN | DEFAULT TRUE | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

---

#### Tabella: `operazioni`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| societa_id | INT | FK → societa(id) | |
| tipo_operazione | ENUM | 'fattura_attiva', 'costo', 'spesa', 'cespite' | |
| data_operazione | DATE | NOT NULL | Data documento |
| numero_documento | VARCHAR(50) | NULL | Numero fattura/doc |
| descrizione | TEXT | NOT NULL | |
| importo_totale | DECIMAL(10,2) | NOT NULL | € |
| categoria_id | INT | FK → categorie_spesa(id) | |
| importo_deducibile | DECIMAL(10,2) | NOT NULL | Calcolato o custom |
| percentuale_deducibilita | DECIMAL(5,2) | NOT NULL | Da categoria o custom |
| deducibilita_custom | BOOLEAN | DEFAULT FALSE | Flag modifica manuale |
| tipo_ripartizione | ENUM | 'comune', 'singolo', 'custom' | |
| note | TEXT | NULL | |
| file_allegato | VARCHAR(255) | NULL | Path file |
| file_xml | TEXT | NULL | Contenuto XML fattura |
| created_by_user_id | INT | FK → utenti(id) | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

---

#### Tabella: `ripartizioni_operazione`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| operazione_id | INT | FK → operazioni(id), ON DELETE CASCADE | |
| socio_id | INT | FK → soci(id) | |
| percentuale | DECIMAL(5,2) | NOT NULL, CHECK (0-100) | |
| importo_calcolato | DECIMAL(10,2) | NOT NULL | importo_totale × perc |

**Vincolo:** Per ogni operazione_id, SUM(percentuale) = 100.00

---

#### Tabella: `categorie_cespiti`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| nome | VARCHAR(100) | NOT NULL | Es. "Computer e hardware" |
| coefficiente_percentuale | DECIMAL(5,2) | NOT NULL | Es. 20.00 |
| descrizione | TEXT | NULL | |
| attiva | BOOLEAN | DEFAULT TRUE | |

**Precaricata con coefficienti ministeriali standard**

---

#### Tabella: `cespiti`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| societa_id | INT | FK → societa(id) | |
| descrizione | VARCHAR(255) | NOT NULL | |
| data_acquisto | DATE | NOT NULL | |
| valore_acquisto | DECIMAL(10,2) | NOT NULL | € |
| categoria_cespite_id | INT | FK → categorie_cespiti(id) | |
| fornitore | VARCHAR(255) | NULL | |
| numero_documento | VARCHAR(50) | NULL | |
| tipo_ammortamento | ENUM | 'ordinario', 'anticipato', 'ridotto_primo_anno' | |
| percentuale_ammortamento | DECIMAL(5,2) | NOT NULL | Da categoria o custom |
| valore_residuo | DECIMAL(10,2) | NOT NULL | Calcolato |
| tipo_ripartizione | ENUM | 'comune', 'singolo', 'custom' | |
| attivo | BOOLEAN | DEFAULT TRUE | In uso/dismesso |
| data_dismissione | DATE | NULL | |
| note | TEXT | NULL | |
| created_by_user_id | INT | FK → utenti(id) | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | ON UPDATE NOW() | |

---

#### Tabella: `ripartizioni_cespite`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| cespite_id | INT | FK → cespiti(id), ON DELETE CASCADE | |
| socio_id | INT | FK → soci(id) | |
| percentuale | DECIMAL(5,2) | NOT NULL | |

**Vincolo:** Per ogni cespite_id, SUM(percentuale) = 100.00

---

#### Tabella: `quote_ammortamento`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| cespite_id | INT | FK → cespiti(id), ON DELETE CASCADE | |
| anno_fiscale | INT | NOT NULL | Es. 2025 |
| quota_annua | DECIMAL(10,2) | NOT NULL | € quota anno |
| fondo_ammortamento | DECIMAL(10,2) | NOT NULL | € progressivo |
| valore_residuo | DECIMAL(10,2) | NOT NULL | € residuo |
| maturata | BOOLEAN | DEFAULT FALSE | Anno concluso |

**Generata automaticamente** alla creazione cespite

---

#### Tabella: `log_attivita`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| user_id | INT | FK → utenti(id) | |
| azione | ENUM | 'INSERT', 'UPDATE', 'DELETE' | |
| tabella | VARCHAR(50) | NOT NULL | Nome tabella modificata |
| record_id | INT | NOT NULL | ID record modificato |
| valori_prima | JSON | NULL | Stato precedente |
| valori_dopo | JSON | NULL | Stato nuovo |
| ip_address | VARCHAR(45) | NULL | IPv4 o IPv6 |
| timestamp | TIMESTAMP | DEFAULT NOW() | |

**Immutabile:** No UPDATE/DELETE su questa tabella

---

### 3.2 Relazioni

```
societa 1---N soci
soci 1---1 utenti
societa 1---N categorie_spesa
societa 1---N operazioni
operazioni N---N soci (via ripartizioni_operazione)
operazioni N---1 categorie_spesa
operazioni N---1 utenti (created_by)
societa 1---N cespiti
cespiti N---1 categorie_cespiti
cespiti N---N soci (via ripartizioni_cespite)
cespiti 1---N quote_ammortamento
utenti 1---N log_attivita
```

---

## 4. INTERFACCIA UTENTE

### 4.1 Struttura Navigazione

**Menu principale (sidebar):**

**Per tutti gli utenti:**
- Dashboard
- Operazioni
  - Lista operazioni
  - Nuova operazione
  - Import XML
- Cespiti
  - Registro cespiti
  - Nuovo cespite
  - Piano ammortamenti
- Report
  - Rendiconto societario
  - Report per socio
  - Report fiscale
  - Piano ammortamenti
  - Comparativo multi-anno
- Profilo utente

**Solo Admin:**
- Configurazione
  - Gestione società
  - Gestione soci
  - Categorie spesa
  - Log attività

### 4.2 Schermate Principali

#### 4.2.1 Dashboard

**Layout:**
- Header: Periodo selezionato (dropdown: Mese corrente / Anno corrente / Custom)
- Sezione KPI (cards):
  - Fatturato totale
  - Costi totali
  - Utile/Perdita
  - Ammortamenti anno
- Grafico andamento mensile (fatturato vs costi)
- Tabella breakdown per socio (se admin) / KPI personali (se socio standard)
- Lista ultime operazioni (10 righe)

#### 4.2.2 Lista Operazioni

**Filtri:**
- Periodo (date picker range)
- Tipo operazione (dropdown multi-select)
- Categoria (dropdown multi-select)
- Socio (dropdown - admin only)
- Ripartizione (comune/singolo/custom)
- Cerca per descrizione/numero documento

**Tabella colonne:**
- Data
- Numero doc
- Descrizione
- Tipo
- Categoria
- Importo totale
- Importo deducibile
- Ripartizione (badge: comune/singolo/custom)
- Azioni (visualizza/modifica/elimina)

**Paginazione:** 20 righe per pagina

**Azioni bulk:**
- Export CSV selezione
- (Futuro) Elimina multipli

#### 4.2.3 Form Nuova Operazione

**Sezione 1: Dati documento**
- Tipo operazione (radio buttons)
- Data operazione (date picker)
- Numero documento (text input)
- Descrizione (textarea)
- Upload file allegato (opzionale)
- **Bottone "Import da XML"** → apre modale upload

**Sezione 2: Importi**
- Importo totale (€ input)
- Categoria spesa (dropdown searchable)
- % Deducibilità (auto-compilata, editabile)
- Importo deducibile (calcolato, editabile)
- Checkbox "Deducibilità personalizzata" (attiva edit manuale)

**Sezione 3: Ripartizione soci**
- Radio buttons:
  - [ ] Comune (quote societarie)
  - [ ] Singolo socio → dropdown socio
  - [ ] Custom → tabella input % per ogni socio

**Se Custom:**
Tabella con righe per ogni socio:
| Socio | Quota societaria | % Assegnata | Importo |
|-------|------------------|-------------|---------|
| Socio A | 40% | [input] | [calcolato] |
| Socio B | 30% | [input] | [calcolato] |
| ... | | | |
| **TOTALE** | **100%** | **[somma]** | **[totale]** |

**Validazione:** Somma % assegnate = 100%

**Sezione 4: Note**
- Note aggiuntive (textarea opzionale)

**Bottoni:**
- Salva
- Salva e duplica (per operazioni simili)
- Annulla

#### 4.2.4 Modale Import XML

**Step 1: Upload**
- Drag & drop area o bottone "Seleziona file"
- Accetta solo .xml
- Possibilità upload multiplo

**Step 2: Preview dati estratti**
Per ogni file:
- Nome file
- Dati parsati:
  - Tipo (fattura attiva/passiva)
  - Numero, Data
  - Fornitore/Cliente
  - Importo
- Checkbox "Importa questo documento"
- Bottone "Modifica manualmente" (se parsing parziale)

**Step 3: Conferma**
- Bottone "Importa selezionati"
- Per ogni documento importato, apre form operazione pre-compilato

#### 4.2.5 Registro Cespiti

**Filtri:**
- Categoria cespite
- Attivo / Dismesso / Tutti
- Anno acquisto
- Socio (admin only)

**Tabella:**
- Descrizione
- Data acquisto
- Valore acquisto
- Categoria
- % Ammortamento
- Valore residuo
- Stato (badge: Attivo/Dismesso)
- Azioni (visualizza piano / modifica / dismetti)

**Bottone:** + Nuovo cespite

#### 4.2.6 Dettaglio Cespite - Piano Ammortamento

**Header:**
- Descrizione bene
- Data acquisto
- Valore acquisto
- Categoria e % ammortamento

**Ripartizione soci:**
- Tabella con quote per socio (se ripartito)

**Piano ammortamento:**
Tabella anni:
| Anno | Quota annua | Fondo ammortamento | Valore residuo | Stato |
|------|-------------|--------------------|--------------|----|
| 2025 | €200 | €200 | €1800 | Maturata |
| 2026 | €400 | €600 | €1400 | In corso |
| 2027 | €400 | €1000 | €1000 | Futura |
| ... | | | | |

**Grafico:** Andamento valore residuo nel tempo

#### 4.2.7 Report - Configurazione

**Form selezione parametri:**
- Tipo report (dropdown)
- Periodo:
  - Anno fiscale (dropdown)
  - Custom (date picker range)
- Socio (se report per socio)
- Livello dettaglio (radio: Sintetico / Analitico)
- Filtri categoria (opzionale)

**Bottoni:**
- Anteprima HTML (apre in modale o nuova tab)
- Scarica PDF
- (Futuro) Esporta Excel

#### 4.2.8 Log Attività (Solo Admin)

**Filtri:**
- Periodo (date picker range)
- Utente (dropdown)
- Tipo azione (INSERT/UPDATE/DELETE)
- Tabella modificata (dropdown)
- Cerca per record_id

**Tabella:**
- Timestamp
- Utente
- Azione
- Tabella
- Record ID
- IP
- Azioni (visualizza dettaglio)

**Dettaglio log entry (modale):**
- JSON diff prima/dopo (se UPDATE)
- Highlighting campi modificati

---

## 5. LOGICHE DI BUSINESS

### 5.1 Calcoli Automatici

#### 5.1.1 Importo Deducibile

```
Quando utente seleziona categoria:
  1. Leggi categoria.percentuale_deducibilita
  2. Calcola: importo_deducibile = importo_totale × (percentuale / 100)
  3. Pre-compila campo importo_deducibile
  4. Abilita modifica manuale se utente vuole override

Se utente modifica manualmente:
  1. Imposta flag deducibilita_custom = TRUE
  2. Ricalcola percentuale effettiva = (importo_deducibile / importo_totale) × 100
  3. Salva percentuale custom
```

#### 5.1.2 Ripartizione Operazione

```
Se tipo_ripartizione = 'comune':
  Per ogni socio ATTIVO:
    percentuale = socio.quota_percentuale
    importo_calcolato = operazione.importo_totale × (percentuale / 100)
    Inserisci riga in ripartizioni_operazione

Se tipo_ripartizione = 'singolo':
  socio_selezionato → percentuale = 100
  importo_calcolato = operazione.importo_totale
  Inserisci riga singola in ripartizioni_operazione

Se tipo_ripartizione = 'custom':
  Valida: SUM(percentuali_input) = 100
  Per ogni socio con percentuale > 0:
    importo_calcolato = operazione.importo_totale × (percentuale / 100)
    Inserisci riga in ripartizioni_operazione
```

#### 5.1.3 Piano Ammortamento

```
Alla creazione cespite:
  1. Leggi categoria_cespite.coefficiente_percentuale
  2. Determina anni_ammortamento = 100 / coefficiente (arrotondato up)
  3. Per anno = anno_acquisto TO anno_acquisto + anni_ammortamento:
     
     Se anno = anno_acquisto AND tipo_ammortamento = 'ridotto_primo_anno':
       quota_annua = valore_acquisto × (coefficiente / 100) × 0.5
     Altrimenti:
       quota_annua = valore_acquisto × (coefficiente / 100)
     
     Se ultimo anno (residuo < quota normale):
       quota_annua = valore_residuo_precedente
     
     fondo_ammortamento = fondo_precedente + quota_annua
     valore_residuo = valore_acquisto - fondo_ammortamento
     
     Inserisci riga quote_ammortamento (anno, quota, fondo, residuo)
     
     Se valore_residuo = 0:
       BREAK (ammortamento completo)

  4. Aggiorna cespite.valore_residuo = valore_residuo_finale
```

### 5.2 Validazioni

#### 5.2.1 Validazioni Operazione

- Data operazione non futura (warning, non blocking)
- Importo totale > 0
- Se tipo_ripartizione = 'custom': SUM(percentuali) = 100
- Categoria obbligatoria
- Numero documento univoco per società (warning duplicati)

#### 5.2.2 Validazioni Soci

- Email univoca
- SUM(quota_percentuale) soci attivi = 100.00
- Quote decimali ammesse (fino a 2 cifre)
- Almeno un admin per società

#### 5.2.3 Validazioni Cespiti

- Data acquisto non futura
- Valore acquisto > 0
- Se tipo_ripartizione = 'custom': SUM(percentuali) = 100

### 5.3 Permessi e Autorizzazioni

#### Matrice permessi per entità:

| Entità | Admin | Socio Standard |
|--------|-------|----------------|
| **Società** | CRUD | Read only |
| **Soci** | CRUD | Read only (tutti), Update (solo proprio profilo) |
| **Categorie spesa** | CRUD | Read only |
| **Operazioni comuni** | CRUD (tutte) | Read only |
| **Operazioni proprie** | CRUD (tutte) | CRUD (solo proprie) |
| **Cespiti** | CRUD | Read only |
| **Report societari** | Generate | No access |
| **Report personali** | Generate (per tutti) | Generate (solo propri) |
| **Log attività** | Read only | No access |

#### Logica check permessi:

```
Prima di ogni operazione WRITE:
  1. Verifica autenticazione utente
  2. Identifica ruolo (admin/standard)
  
  Se operazione su entità specifica (es. operazione_id):
    Se ruolo = standard:
      Verifica: operazione.created_by_user_id = current_user.id
        OR tipo_ripartizione = 'singolo' AND ripartizione.socio_id = current_user.socio_id
      Se NO → HTTP 403 Forbidden
  
  Se azione richiede ruolo admin (es. modifica società):
    Se ruolo != admin → HTTP 403 Forbidden

Prima di ogni operazione READ:
  Se ruolo = standard:
    Filtra risultati solo per dati accessibili (propri o comuni)
```

---

## 6. FLUSSI OPERATIVI PRINCIPALI

### 6.1 Flusso Inserimento Fattura Attiva (con XML)

1. Admin/Socio clicca "Nuova operazione"
2. Seleziona "Upload XML"
3. Seleziona file XML fattura emessa
4. Sistema parsa XML ed estrae:
   - Numero: FA-2025-042
   - Data: 15/01/2025
   - Cliente: Acme SRL
   - Importo: €5.000
5. Form si pre-compila automaticamente
6. Utente completa:
   - Tipo operazione: Fattura attiva
   - Categoria: "Consulenza IT" (100% deducibile)
   - Ripartizione: "Singolo socio" → Socio A
7. Sistema calcola:
   - Importo deducibile: €5.000 (100%)
   - Ripartizione: Socio A 100% = €5.000
8. Utente clicca "Salva"
9. Sistema:
   - Inserisce record in `operazioni`
   - Inserisce record in `ripartizioni_operazione`
   - Inserisce log in `log_attivita`
10. Redirect a dettaglio operazione con messaggio successo

### 6.2 Flusso Inserimento Spesa Comune

1. Admin inserisce spesa affitto ufficio
2. Compila form:
   - Data: 01/02/2025
   - Numero doc: Ricevuta-02-2025
   - Descrizione: "Affitto ufficio febbraio"
   - Importo: €1.200
   - Categoria: "Affitto ufficio" (100% deducibile)
   - Ripartizione: "Comune"
3. Sistema calcola automaticamente:
   - Importo deducibile: €1.200
   - Ripartizione:
     - Socio A (40%): €480
     - Socio B (30%): €360
     - Socio C (20%): €240
     - Socio D (10%): €120
4. Mostra anteprima ripartizione
5. Admin conferma
6. Salvataggio + log

### 6.3 Flusso Acquisto e Ammortamento Cespite

1. Admin va su "Cespiti" → "Nuovo cespite"
2. Compila:
   - Descrizione: "MacBook Pro 14''"
   - Data acquisto: 10/01/2025
   - Valore: €2.500
   - Categoria: "Computer e hardware" (20% annuo)
   - Fornitore: "Apple Store"
   - Tipo ammortamento: "Ridotto primo anno"
   - Ripartizione: "Singolo socio" → Socio A
3. Sistema genera automaticamente piano:
   - 2025: €250 (2.500 × 20% × 50%)
   - 2026: €500
   - 2027: €500
   - 2028: €500
   - 2029: €500
   - 2030: €250 (residuo)
   - Totale: €2.500
4. Salva cespite + quote_ammortamento + ripartizione
5. Cespite appare in registro con valore residuo €2.250 (al 2025)

### 6.4 Flusso Generazione Report Rendiconto

1. Admin va su "Report" → "Rendiconto societario"
2. Seleziona parametri:
   - Periodo: Anno 2025
   - Livello dettaglio: Sintetico
3. Clicca "Anteprima"
4. Sistema:
   - Query tutte operazioni anno 2025
   - Aggrega fatture attive (ricavi)
   - Aggrega costi/spese
   - Somma ammortamenti anno 2025
   - Calcola utile/perdita = ricavi - costi - ammortamenti
   - Ripartisce per socio secondo quote
5. Genera HTML anteprima
6. Admin verifica e clicca "Scarica PDF"
7. Sistema genera PDF e trigger download

### 6.5 Flusso Consultazione Log (Admin)

1. Admin va su "Configurazione" → "Log attività"
2. Filtra:
   - Periodo: ultima settimana
   - Utente: Socio B
3. Vede lista operazioni:
   - 12/02/2025 14:32 - Socio B - INSERT - operazioni - ID 145
   - 11/02/2025 10:15 - Socio B - UPDATE - operazioni - ID 142
4. Clicca su UPDATE ID 142
5. Modale mostra:
   ```json
   PRIMA:
   {
     "importo_totale": 300.00,
     "descrizione": "Spesa carburante"
   }
   
   DOPO:
   {
     "importo_totale": 350.00,
     "descrizione": "Spesa carburante + pedaggi"
   }
   ```
6. Admin verifica modifica legittima

---

## 7. REQUISITI TECNICI SVILUPPO

### 7.1 Architettura Applicazione

**Tipo:** Progressive Web App (PWA)

**Pattern:** 
- Backend: API RESTful
- Frontend: Single Page Application (SPA)
- Database: Relazionale (PostgreSQL / MySQL)

**Struttura progetto:**
```
/backend
  /api
    /controllers  (logica business)
    /models       (ORM entities)
    /routes       (endpoint API)
    /middleware   (auth, logging, validazione)
  /database
    /migrations   (schema evolution)
    /seeders      (dati iniziali)
  /services       (logiche riusabili)
  /utils          (helpers)

/frontend
  /src
    /components   (UI riusabili)
    /views        (pagine app)
    /store        (state management)
    /services     (chiamate API)
    /utils        (helpers)
    /assets       (CSS, immagini)

/docs
  /api            (documentazione endpoint)
  /user-manual    (manuale utente)
```

### 7.2 Stack Tecnologico Suggerito

**Backend:**
- **Framework:** Laravel (PHP) / Django (Python) / Express (Node.js)
- **Database:** PostgreSQL (preferito) o MySQL
- **ORM:** Eloquent / Django ORM / Sequelize
- **Authentication:** JWT (JSON Web Tokens)
- **PDF Generation:** TCPDF / wkhtmltopdf / Puppeteer

**Frontend:**
- **Framework:** Vue.js 3 / React
- **UI Library:** Vuetify / Material-UI / Bootstrap 5
- **State Management:** Vuex / Redux / Pinia
- **HTTP Client:** Axios
- **Charts:** Chart.js / Recharts
- **Date Picker:** Vuetify Date Picker / React Datepicker
- **PWA:** Workbox (service workers)

**DevOps:**
- **Version Control:** Git
- **Hosting:** VPS (DigitalOcean / Hetzner / AWS Lightsail)
- **Web Server:** Nginx
- **Process Manager:** PM2 (Node) / Supervisor (Python) / PHP-FPM
- **SSL:** Let's Encrypt (certbot)
- **Backup:** Automatizzati DB + files (cron + rsync)

### 7.3 API Endpoints (Esempi)

**Autenticazione:**
- POST `/api/auth/login` - Login utente
- POST `/api/auth/logout` - Logout
- GET `/api/auth/me` - Info utente corrente

**Operazioni:**
- GET `/api/operazioni` - Lista operazioni (con filtri query params)
- GET `/api/operazioni/:id` - Dettaglio operazione
- POST `/api/operazioni` - Crea nuova operazione
- PUT `/api/operazioni/:id` - Modifica operazione
- DELETE `/api/operazioni/:id` - Elimina operazione
- POST `/api/operazioni/import-xml` - Upload e parsing XML

**Soci:**
- GET `/api/soci` - Lista soci
- GET `/api/soci/:id` - Dettaglio socio
- POST `/api/soci` - Crea socio (admin only)
- PUT `/api/soci/:id` - Modifica socio (admin only)
- DELETE `/api/soci/:id` - Disattiva socio (admin only)

**Categorie:**
- GET `/api/categorie-spesa` - Lista categorie
- POST `/api/categorie-spesa` - Crea categoria (admin only)
- PUT `/api/categorie-spesa/:id` - Modifica categoria (admin only)

**Cespiti:**
- GET `/api/cespiti` - Lista cespiti
- GET `/api/cespiti/:id` - Dettaglio + piano ammortamento
- POST `/api/cespiti` - Crea cespite
- PUT `/api/cespiti/:id` - Modifica cespite
- GET `/api/cespiti/:id/piano-ammortamento` - Piano dettagliato

**Report:**
- POST `/api/report/rendiconto` - Genera rendiconto (body: parametri)
- POST `/api/report/socio` - Report per socio
- POST `/api/report/fiscale` - Report fiscale
- POST `/api/report/ammortamenti` - Piano ammortamenti
- POST `/api/report/comparativo` - Multi-anno

**Dashboard:**
- GET `/api/dashboard/kpi` - KPI periodo (query params: data_inizio, data_fine)
- GET `/api/dashboard/breakdown-soci` - Ripartizione per socio
- GET `/api/dashboard/trend-mensile` - Andamento mensile

**Log (admin only):**
- GET `/api/log-attivita` - Lista log (con filtri)
- GET `/api/log-attivita/:id` - Dettaglio log entry

### 7.4 Sicurezza

**Autenticazione:**
- JWT con refresh token
- Password hasching bcrypt (cost factor 12)
- Rate limiting login (5 tentativi / 15 min)

**Autorizzazione:**
- Middleware verifica ruolo per ogni endpoint protetto
- Check ownership su operazioni (socio può modificare solo proprie)

**Input Validation:**
- Validazione lato server SEMPRE (mai fidarsi client)
- Sanitizzazione input (XSS prevention)
- Prepared statements (SQL injection prevention)

**HTTPS:**
- Obbligatorio in produzione
- HSTS header
- Cookie secure + httpOnly

**File Upload:**
- Validazione tipo file (whitelist: .xml, .pdf)
- Limite dimensione (es. 10MB)
- Rename file random (evitare sovrascrittura)
- Storage fuori webroot o con .htaccess deny

**CORS:**
- Configurare allowed origins
- Credentials: true se necessario

### 7.5 Performance

**Database:**
- Indici su FK e campi ricerca frequenti (societa_id, socio_id, data_operazione, categoria_id)
- Query ottimizzate (no N+1)
- Eager loading relazioni
- Pagination (default 20 righe)

**Cache:**
- Cache categorie spesa (poco mutevoli)
- Cache quote soci (cambia raramente)
- Invalidazione cache su update

**Frontend:**
- Lazy loading routes
- Code splitting
- Minify/uglify production
- Service worker per offline (PWA)
- Cache API responses (strategia stale-while-revalidate)

**Immagini/Assets:**
- CDN per librerie esterne
- Compression (gzip/brotli)
- Lazy loading immagini

### 7.6 Testing

**Backend:**
- Unit tests logiche business (calcolo ammortamenti, ripartizioni)
- Integration tests endpoint API
- Test validazioni e autorizzazioni

**Frontend:**
- Unit tests componenti riusabili
- E2E tests flussi critici (login, inserimento operazione, generazione report)

**Tool suggeriti:**
- PHPUnit / pytest / Jest (secondo stack)
- Cypress / Playwright (E2E)

### 7.7 Deployment

**Ambiente produzione:**
1. VPS con Ubuntu Server 22.04 LTS
2. Nginx come reverse proxy
3. Database managed PostgreSQL o installazione locale con backup
4. SSL Let's Encrypt
5. Firewall (ufw) - solo porte 80, 443, 22
6. Fail2ban per protezione SSH

**CI/CD (opzionale futuro):**
- GitHub Actions / GitLab CI
- Auto-deploy su push branch main
- Run tests automatici pre-deploy

**Backup:**
- Database: dump giornaliero automatico
- Files: backup incrementale
- Retention: 30 giorni
- Test restore mensile

---

## 8. ROADMAP SVILUPPO

### Fase 1 - MVP (Durata stimata: 6-8 settimane)

**Sprint 1-2: Setup e Core (2-3 settimane)**
- Setup repository e struttura progetto
- Database schema + migrations
- Sistema autenticazione (JWT)
- CRUD soci
- CRUD categorie spesa (con seed dati standard)
- Sistema permessi base (admin/standard)

**Sprint 3-4: Operazioni (2-3 settimane)**
- CRUD operazioni
- Form inserimento con ripartizione (comune/singolo/custom)
- Calcolo automatico deducibilità
- Lista operazioni con filtri e paginazione
- Validazioni e check permessi

**Sprint 5-6: Dashboard e Report Base (2 settimane)**
- Dashboard KPI semplice
- Report rendiconto PDF base
- Report per socio PDF
- Log attività (insert automatico su operazioni)
- UI log attività (solo admin)

**Deliverable Fase 1:**
- Applicazione funzionante con operazioni base
- Gestione utenti e permessi
- Report PDF essenziali
- Deploy su VPS test

---

### Fase 2 - Ammortamenti e Import XML (Durata: 4-5 settimane)

**Sprint 7-8: Cespiti e Ammortamenti (2-3 settimane)**
- CRUD cespiti
- Categorie cespiti (seed coefficienti ministeriali)
- Generazione automatica piano ammortamento
- UI piano ammortamento multi-anno
- Calcolo valore residuo

**Sprint 9: Import XML (1-2 settimane)**
- Parsing XML fattura elettronica
- Pre-compilazione form da XML
- Upload multiplo XML
- Gestione errori parsing

**Sprint 10: Report Avanzati (1 settimana)**
- Report fiscale con deducibilità
- Report piano ammortamenti
- Miglioramenti grafici dashboard

**Deliverable Fase 2:**
- Gestione completa cespiti con ammortamenti
- Import facilitato fatture XML
- Suite completa report PDF

---

### Fase 3 - Multi-Anno e Ottimizzazioni (Durata: 3-4 settimane)

**Sprint 11: Multi-Anno (1-2 settimane)**
- Filtri temporali avanzati
- Report comparativo multi-anno
- Grafici trend temporali
- Storico modifiche operazioni

**Sprint 12: UI/UX Refinement (1 settimana)**
- Responsive ottimizzazione mobile
- PWA manifest e service workers
- Miglioramenti usabilità form
- Onboarding utente (tour guidato)

**Sprint 13: Performance e Testing (1 settimana)**
- Ottimizzazione query DB
- Caching strategico
- Test suite completo
- Bug fixing

**Deliverable Fase 3:**
- Sistema completo produzione-ready
- Analisi multi-anno
- PWA installabile mobile
- Test coverage >70%

---

### Fase 4 - Prodotto Rivendibile (Durata: 6-8 settimane) - FUTURO

**Sprint 14-15: Multi-Tenant (3-4 settimane)**
- Isolamento dati per società
- Sistema registrazione nuove società
- Gestione abbonamenti/licenze
- Billing (integrazione Stripe/PayPal)

**Sprint 16-17: Configurabilità (2-3 settimane)**
- Branding personalizzabile per cliente
- Configurazione parametri fiscali per cliente
- Template report personalizzabili
- White-label UI

**Sprint 18: Admin Panel Rivendita (1 settimana)**
- Dashboard super-admin (gestione clienti)
- Monitoring uso risorse
- Fatturazione automatica clienti
- Supporto ticketing

**Deliverable Fase 4:**
- Prodotto SaaS multi-tenant
- Sistema gestione clienti
- Pricing e billing automatizzato

---

## 9. DATI DI ESEMPIO (Seed Database)

### 9.1 Categorie Spesa Standard

```sql
INSERT INTO categorie_spesa (nome, percentuale_deducibilita, descrizione) VALUES
('Carburante auto', 20.00, 'Art. 164 comma 1 TUIR - Uso promiscuo'),
('Telefonia mobile', 80.00, 'Uso promiscuo professionale/personale'),
('Telefonia fissa ufficio', 100.00, 'Uso esclusivo professionale'),
('Formazione e aggiornamento professionale', 100.00, 'Corsi, seminari, libri tecnici'),
('Cancelleria e materiale ufficio', 100.00, ''),
('Software e licenze', 100.00, 'Abbonamenti cloud, licenze software'),
('Hardware e computer', 100.00, 'Beni ammortizzabili'),
('Affitto ufficio', 100.00, ''),
('Utenze ufficio (luce, gas, acqua)', 100.00, ''),
('Pulizie ufficio', 100.00, ''),
('Consulenze professionali', 100.00, 'Commercialista, legale, tecnici'),
('Spese bancarie e commissioni', 100.00, ''),
('Assicurazioni professionali', 100.00, ''),
('Marketing e pubblicità', 100.00, ''),
('Rappresentanza', 75.00, 'Limiti art. 108 TUIR - percentuale indicativa'),
('Manutenzione auto', 20.00, 'Coerente con uso promiscuo carburante'),
('Assicurazione auto', 20.00, 'Coerente con uso promiscuo'),
('Mobili e arredi', 100.00, 'Beni ammortizzabili'),
('Viaggi e trasferte', 100.00, 'Se documentati e inerenti attività'),
('Vitto e alloggio trasferte', 75.00, 'Limiti fiscali secondo normativa');
```

### 9.2 Categorie Cespiti

```sql
INSERT INTO categorie_cespiti (nome, coefficiente_percentuale, descrizione) VALUES
('Computer e hardware', 20.00, 'PC, laptop, server'),
('Software applicativo', 50.00, 'Software gestionali, applicazioni'),
('Software sistema operativo', 33.33, 'Sistemi operativi'),
('Mobili e arredi ufficio', 12.00, 'Scrivanie, sedie, armadi'),
('Impianti generici', 15.00, 'Impianti condizionamento, allarme'),
('Autovetture', 25.00, 'Auto aziendali'),
('Telefonia e smartphone', 20.00, 'Cellulari, centralini'),
('Attrezzature elettroniche', 20.00, 'Stampanti, scanner, proiettori'),
('Macchinari specifici', 15.00, 'Secondo settore attività');
```

### 9.3 Società di Esempio

```sql
INSERT INTO societa (ragione_sociale, partita_iva, codice_fiscale, indirizzo, regime_fiscale, data_costituzione) VALUES
('Tech Solutions SRL', '12345678901', '12345678901', 'Via Roma 123, Milano MI', 'Regime ordinario', '2020-01-15');

INSERT INTO soci (societa_id, nome, cognome, codice_fiscale, email, quota_percentuale, ruolo, data_ingresso, attivo) VALUES
(1, 'Mario', 'Rossi', 'RSSMRA80A01H501Z', 'mario.rossi@example.com', 40.00, 'admin', '2020-01-15', TRUE),
(1, 'Laura', 'Bianchi', 'BNCLRA85M45F205W', 'laura.bianchi@example.com', 30.00, 'admin', '2020-01-15', TRUE),
(1, 'Giuseppe', 'Verdi', 'VRDGPP75C15L219K', 'giuseppe.verdi@example.com', 20.00, 'standard', '2020-01-15', TRUE),
(1, 'Anna', 'Neri', 'NRINNA90D50F839P', 'anna.neri@example.com', 10.00, 'standard', '2021-06-01', TRUE);
```

### 9.4 Utenti (Password: "password123" - hash bcrypt)

```sql
-- Password hash generato con bcrypt cost 12
INSERT INTO utenti (socio_id, email, password_hash) VALUES
(1, 'mario.rossi@example.com', '$2y$12$HASH_PLACEHOLDER_1'),
(2, 'laura.bianchi@example.com', '$2y$12$HASH_PLACEHOLDER_2'),
(3, 'giuseppe.verdi@example.com', '$2y$12$HASH_PLACEHOLDER_3'),
(4, 'anna.neri@example.com', '$2y$12$HASH_PLACEHOLDER_4');
```

---

## 10. CONSIDERAZIONI FINALI

### 10.1 Estensibilità Futura

**Features opzionali da considerare dopo MVP:**

1. **Gestione IVA completa**
   - Registri IVA (acquisti/vendite)
   - Liquidazioni periodiche
   - Dichiarazioni annuali

2. **Budget e Previsionale**
   - Definizione budget per categoria
   - Alert soglie budget
   - Confronto budget vs consuntivo
   - Proiezioni anno corrente

3. **Scadenzario**
   - Pagamenti fornitori
   - Incassi clienti
   - F24 e scadenze fiscali
   - Reminder automatici

4. **Integrazione bancaria avanzata**
   - API Open Banking
   - Riconciliazione automatica
   - Import movimenti automatico

5. **Export per commercialista**
   - Export CSV strutturato
   - Formato Telemaco
   - Integrazione software commercialisti

6. **App mobile nativa**
   - React Native / Flutter
   - Scan documenti OCR
   - Notifiche push

7. **Workflow approvazione**
   - Operazioni in bozza
   - Approvazione multi-livello
   - Notifiche email

8. **Analytics avanzate**
   - Dashboard interattive
   - Drill-down gerarchici
   - Export dati per BI esterni

### 10.2 Manutenzione e Aggiornamenti

**Ciclo aggiornamenti:**
- Aggiornamenti sicurezza: immediati
- Bug fix: settimanali (se critici) o mensili
- Nuove features: trimestrali
- Aggiornamento coefficienti ammortamento: annuale (secondo DM)

**Documentazione:**
- Manuale utente (PDF/HTML)
- Documentazione tecnica API
- Changelog versioni
- FAQ e knowledge base

### 10.3 Conformità Normativa

**GDPR:**
- Informativa privacy
- Cookie policy
- Consenso trattamento dati
- Diritto accesso/cancellazione dati
- Data retention policy
- Registro trattamenti

**Normativa Fiscale Italiana:**
- Aggiornamento categorie deducibilità secondo modifiche legislative
- Coefficienti ammortamento ministeriali (verifica annuale)
- Tracciabilità operazioni (7 anni conservazione)

### 10.4 Supporto e Training

**Per utenti interni (4 soci):**
- Sessione formazione iniziale (2-3 ore)
- Documentazione quick-start
- Video tutorial per task comuni

**Per prodotto rivendibile (futuro):**
- Onboarding guidato in-app
- Help contestuale
- Knowledge base pubblico
- Supporto ticket/email

---

## 11. DOMANDE APERTE E DECISIONI DA PRENDERE

### 11.1 Scelte Tecnologiche

- [ ] **Stack backend definitivo:** Laravel / Django / Express?
  - Criteri: familiarità sviluppatore, ecosistema, performance
  
- [ ] **Stack frontend definitivo:** Vue 3 / React?
  - Criteri: learning curve, community, librerie UI

- [ ] **Database:** PostgreSQL / MySQL?
  - Raccomandazione: PostgreSQL (migliori funzionalità JSON, più moderno)

- [ ] **Hosting iniziale:** Quale provider?
  - Opzioni: DigitalOcean, Hetzner, AWS Lightsail
  - Budget: ~50€/mese

### 11.2 Funzionalità Business

- [ ] **Gestione IVA:** Include in MVP o Fase 2?
  - Attuale: non inclusa
  - Valutare: necessità reale per accordi parasociali

- [ ] **Multi-valuta:** Solo EUR o prevedere altre valute?
  - Attuale: solo EUR
  - Futuro rivendibilità: potrebbe servire

- [ ] **Workflow approvazione operazioni:** Necessario?
  - Attuale: ogni utente inserisce definitivamente
  - Alternativa: bozze + approvazione admin

- [ ] **Notifiche email:** Implementare?
  - Eventi: nuova operazione, modifica dati, report generato
  - Pro: trasparenza
  - Contro: complessità aggiuntiva

### 11.3 UX/UI

- [ ] **Tema colori e branding:** Definire palette
  - Primario, secondario, accenti
  - Logo / nome app

- [ ] **Mobile-first o Desktop-first design?**
  - Raccomandazione: Desktop-first (uso ufficio prevalente)
  - Ma responsive per consultazioni mobile

- [ ] **Lingua interfaccia:** Solo italiano o multi-lingua?
  - MVP: solo italiano
  - Futuro: i18n per rivendibilità

---

## APPENDICE A - GLOSSARIO

**Termini tecnici:**

- **Ammortamento:** Ripartizione del costo di un bene durevole su più esercizi
- **Cespite:** Bene strumentale durevole soggetto ad ammortamento
- **Coefficiente ammortamento:** Percentuale annua di svalutazione fiscale
- **Deducibilità fiscale:** Percentuale di una spesa sottraibile dal reddito imponibile
- **Fondo ammortamento:** Somma delle quote di ammortamento accumulate
- **TUIR:** Testo Unico Imposte sui Redditi (DPR 917/1986)
- **PWA:** Progressive Web App - applicazione web installabile come app
- **JWT:** JSON Web Token - standard autenticazione stateless
- **ORM:** Object-Relational Mapping - astrazione database

**Acronimi:**

- SRL: Società a Responsabilità Limitata
- P.IVA: Partita IVA
- CF: Codice Fiscale
- SDI: Sistema di Interscambio (fatture elettroniche)
- CRUD: Create, Read, Update, Delete
- API: Application Programming Interface
- FK: Foreign Key (chiave esterna)
- PK: Primary Key (chiave primaria)

---

## APPENDICE B - RIFERIMENTI NORMATIVI

**Deducibilità fiscale:**
- Art. 108 TUIR - Spese di rappresentanza
- Art. 164 TUIR - Autoveicoli (20% uso promiscuo)
- D.M. 19/11/2008 - Limiti deducibilità spese vitto e alloggio

**Ammortamenti:**
- Art. 102 TUIR - Ammortamento beni materiali
- D.M. 31/12/1988 - Coefficienti ammortamento
- Art. 103 TUIR - Ammortamento beni immateriali

**Fatturazione elettronica:**
- D.Lgs. 127/2015 - Obbligo fatturazione elettronica B2B
- Provvedimento Agenzia Entrate 30/04/2018 - Specifiche tecniche

---

**FINE SPECIFICA TECNICA**

---

**Versione documento:** 1.0  
**Ultima modifica:** 13 Febbraio 2025  
**Autore:** Claude (Anthropic)  
**Destinatario:** Sviluppatore per implementazione con Claude Code

---

**Note per lo sviluppatore:**

Questa specifica è completa e dettagliata per iniziare lo sviluppo. Alcune decisioni tecniche (stack definitivo, hosting, branding) possono essere prese durante la fase di implementazione. Il documento è strutturato per essere aggiornato iterativamente con decisioni prese durante lo sviluppo.

Per domande o chiarimenti su requisiti, consultare la sezione appropriata o richiedere integrazione della specifica.
