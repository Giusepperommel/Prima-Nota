# Pain-Point Driven Features — Design Spec

**Data:** 2026-03-26
**Approccio:** Onion Layers (dal nucleo dati verso l'esterno)
**Sotto-progetti:** SP11, SP12, SP13, SP14

---

## 1. Contesto e Motivazione

### Scouting Pain Point

Ricerca condotta su recensioni e feedback di: TeamSystem, Zucchetti (Ago Infinity), Wolters Kluwer (Genya), Passepartout (Passcom), Fatture in Cloud, Danea Easyfatt, GBsoftware, Ranocchi GIS, Sistemi S.p.A. — da Trustpilot, Capterra, FiscoeTasse, forum commercialisti, articoli di settore.

### Pain Point Identificati

#### 1.1 Performance e Stabilità
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Lentezza cronica — passaggio tra moduli fino a 2 minuti | GBsoftware, Passcom, Sistemi | Critica |
| Crash e blocchi quotidiani | GBsoftware, Ranocchi GIS | Critica |
| Rallentamento con grandi dataset | Sistemi S.p.A., Zucchetti | Alta |
| Tecnologia obsoleta — VB6, Delphi, FoxPro, COBOL | TeamSystem, vari ERP | Alta |

#### 1.2 UX / Interfaccia
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Interfaccia confusionaria — percorsi macchinosi | Zucchetti, Sistemi, Passcom | Critica |
| Non intuitivo — operazioni semplici richiedono guida telefonica | Zucchetti (Beddy), Passcom Welcome | Alta |
| Popup invasivi non modali | Vari ERP italiani | Media |
| Non responsive/mobile | Vari ERP italiani | Alta |
| Assenza di to-do/dashboard intelligenti per ruolo | Tutti | Media |

#### 1.3 Costi e Modello Commerciale
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Canone in aumento costante — raddoppio in 4 anni | Danea, Fatture in Cloud, Zucchetti | Alta |
| Costi nascosti (TCO) — implementazione, personalizzazioni, canoni variabili | Tutti i vendor enterprise | Alta |
| Vendor lock-in — migrazione dati difficile/impossibile | Tutti | Critica |
| Riduzione retroattiva dei limiti senza preavviso | Fatture in Cloud | Alta |
| Rimozione metodi di pagamento a favore di sistemi proprietari | Danea/TeamSystem | Media |

#### 1.4 Assistenza e Supporto
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Supporto inesistente o lentissimo — fino a una settimana | Profis, Sistemi, Passcom, Zucchetti | Critica |
| Chat assistenza rimossa | Fatture in Cloud | Alta |
| Nessun supporto telefonico — solo ticket | Fatture in Cloud, vari | Alta |
| Assistenza ciclica — 50+ richieste/anno per stessi problemi | GBsoftware | Critica |
| Casa madre irreperibile — supporto solo tramite reseller | Tutti i vendor enterprise | Alta |

#### 1.5 Funzionalità e Flessibilità
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Rigidità operativa — scritture automatiche non modificabili | Ranocchi GIS, vari | Alta |
| Mancanza di matching automatico fatture/merce | Gestionale Open, vari | Alta |
| Reportistica carente — solo pivot Excel basilari | Tutti | Alta |
| Sviluppo stagnante — solo fix fatturazione elettronica | Danea Easyfatt | Alta |
| Errori nei calcoli — IRPEF e TFR errati | Passcom, vari | Critica |

#### 1.6 Integrazione e Collaborazione
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Frammentazione — N interfacce diverse, no all-in-one | Tutti | Alta |
| Portale clienti rudimentale — solo upload/download | Maggioranza | Alta |
| Incompatibilità tra sistemi | Tutti | Alta |
| Conversioni dati problematiche tra software | Zucchetti | Alta |

#### 1.7 Onboarding e Aggiornamenti
| Pain Point | Software coinvolti | Gravità |
|---|---|---|
| Implementazione complessa — tempo e risorse significative | Tutti enterprise | Alta |
| Upgrade costosi — paragonabili all'investimento iniziale | Tutti enterprise | Alta |
| Documentazione scarsa | Ranocchi GIS, vari | Media |

### Cosa Prima Nota risolve già
- Performance/lentezza → web app moderna Next.js
- UI confusionaria → 3 modalità adattive (semplice/avanzata/commercialista)
- Tecnologia obsoleta → stack moderno (React, Prisma, TypeScript)
- Fatturazione elettronica → SP3 implementato
- Partita doppia → SP1 implementato
- Multi-azienda → SP2 implementato
- Registri IVA/LIPE → SP4 implementato
- Riconciliazione bancaria → SP9 implementato
- Portale clienti → parziale (login + dashboard base in SP4)

### Cosa manca (oggetto di questo design)
- Export/import universale + API pubblica (vendor lock-in, portabilità)
- Intelligenza proattiva (alert, to-do, dashboard smart)
- BI/Reportistica avanzata (KPI, grafici, analisi comparativa)
- Portale clienti full (self-service, chat, prima nota semplificata)

---

## 2. Approccio: Onion Layers

Costruzione a strati concentrici, dal nucleo dati verso l'esterno:

1. **Strato 1 — SP11: Apertura Dati e API Pubblica** — fondazione per tutto il resto
2. **Strato 2 — SP12: Intelligenza Proattiva** — alert, to-do, dashboard smart
3. **Strato 3 — SP13: Reportistica e BI** — KPI, grafici, analisi comparativa
4. **Strato 4 — SP14: Portale Clienti Full** — consumer di tutti gli strati precedenti

Ogni strato è utile anche da solo, ma abilita il successivo. L'API (strato 1) è la fondazione su cui tutto si appoggia. Il portale clienti (strato 4) è il consumer naturale dell'API + BI + Intelligence.

---

## 3. Strato 1 — SP11: Apertura Dati e API Pubblica

### 3.1 Export Engine
- Path: `src/lib/export/`
- Formati: CSV, Excel (xlsx), PDF, JSON per ogni entità
- Pattern: `exportEngine.export(entità, filtri, formato)` → file scaricabile
- Entità esportabili: operazioni, scritture contabili, piano dei conti, anagrafiche, fatture elettroniche, registri IVA, liquidazioni, F24, CU, cespiti, movimenti bancari, scadenzario
- Export massivo: backup completo azienda in ZIP strutturato
- UI: bottone "Esporta" contestuale su ogni lista + pagina `/esportazioni` per export massivi

### 3.2 Import Engine
- Path: `src/lib/import/`
- Wizard multi-step: scelta software origine → upload file → mapping campi → preview → conferma
- Software supportati inizialmente:
  - **TeamSystem** (CSV/TXT)
  - **Zucchetti** (CSV)
  - **Passcom** (CSV)
  - **Fatture in Cloud** (CSV export nativo)
  - **Danea Easyfatt** (XML)
- Import di: piano dei conti, anagrafiche, operazioni/scritture, saldi iniziali
- Validazione pre-import con report errori dettagliato
- Modalità dry run per preview senza scrivere nel DB
- UI: `/importazione` con wizard guidato

### 3.3 API REST Pubblica
- Path: `src/lib/api/`
- Middleware che wrappa le route esistenti
- Autenticazione: API key per società (hashate bcrypt, scope granulari)
- Versionamento: `/api/v1/` namespace dedicato
- Rate limiting: configurabile per key e per endpoint (default 1000 req/h globale, sliding window). Rate limit per-endpoint per evitare che chiamate a endpoint economici esauriscano il budget per quelli critici
- Endpoint CRUD per tutte le entità principali + ricerca con filtri
- Documentazione OpenAPI/Swagger auto-generata
- CORS: configurazione origini consentite per società (default: nessuna, whitelist esplicita)
- Webhook: notifiche push su eventi (nuova operazione, scadenza, etc.) con HMAC signature
  - Retry policy: exponential backoff (1min, 5min, 30min, 2h, 12h), max 5 tentativi
  - Dopo 5 fallimenti consecutivi: webhook disabilitato, notifica in-app all'admin
  - Endpoint `/api/v1/webhook-deliveries` per consultare storico consegne e ri-triggerare manualmente
  - Rotazione secret: possibilità di generare nuovo secret con periodo di overlap (vecchio valido per 24h)
- UI admin: `/configurazione/api` per gestire chiavi, usage, docs

### 3.4 Modello dati

```
ApiKey {
  id, societaId, nome, key (hash bcrypt),
  scopes[], rateLimitPerHour, rateLimitPerEndpoint (JSON),
  attiva, ultimoUtilizzo, lastRotatedAt,
  createdAt, expiresAt
}
// Rotazione: creare nuova key → periodo overlap (vecchia valida 24h) → revoca vecchia

WebhookEndpoint {
  id, societaId, url, eventi[], secret (HMAC),
  secretRotazioneAt, secretPrecedenteValidoFinoA,
  attivo, ultimaConsegna, consecutiviFalliti
}

WebhookDelivery {
  id, webhookEndpointId, evento, payload (JSON),
  statoHttp, risposta, tentativo (1-5),
  prossimoTentativoAt, stato (CONSEGNATO/FALLITO/PENDING),
  createdAt
}

ImportJob {
  id, societaId, utenteId, softwareOrigine, stato,
  fileOriginale, mappingCampi (JSON),
  righeProcessate, righeErrore, errori (JSON),
  createdAt, completatoAt
}

ExportJob {
  id, societaId, utenteId, tipo, formato, filtri (JSON),
  stato, fileUrl, createdAt
}
// Export grandi dataset: streaming chunked per CSV, limite 100k righe per Excel con paginazione
```

### 3.5 Sicurezza
- API key hashate, mai esposte in chiaro dopo creazione
- Rotazione key: creare nuova → overlap 24h → revoca vecchia (campo `lastRotatedAt`)
- Scope granulari: `read:operazioni`, `write:operazioni`, `read:anagrafiche`, etc.
- Audit log su ogni chiamata API
- Webhook con HMAC signature per verifica autenticità + rotazione secret con overlap
- Rate limiting con sliding window, globale + per-endpoint
- CORS whitelist per società

---

## 4. Strato 2 — SP12: Intelligenza Proattiva

### 4.0 Relazione con modelli esistenti
- **`Anomalia` (SP2)**: il modello esistente viene mantenuto come *fonte dati* per l'alert engine. L'alert engine legge le anomalie e genera `AlertGenerato` di tipo "anomalia contabile". `Anomalia` non viene deprecato — continua a funzionare come detection layer, mentre `AlertGenerato` è il delivery layer.
- **`HealthScore` (SP2)**: viene consumato direttamente dalla Dashboard Smart (sezione "stato di salute") e dal portale clienti (SP14). Non viene duplicato — il KPI Engine (SP13) può estendere il calcolo con KPI aggiuntivi, ma l'HealthScore rimane la fonte per il semaforo sintetico.
- **`ScadenzaFiscale` / `ChecklistAdempimento` (SP3)**: l'alert engine li usa come fonte per gli alert di tipo "scadenza". Le to-do li usano come fonte per "adempimenti da completare".
- **`Notifica` (esistente)**: le notifiche in-app generate dagli alert usano il sistema `Notifica` esistente. `AlertGenerato` non duplica le notifiche — genera una `Notifica` quando il canale è "in-app".
- **Esecuzione periodica**: Vercel Cron (o equivalente) per batch notturno + trigger on-write per alert real-time post-registrazione.

### 4.1 Alert Engine
- Path: `src/lib/intelligence/alert-engine.ts`
- Esecuzione periodica (Vercel Cron per batch notturno) + trigger on-write per alert real-time
- Categorie:

| Categoria | Esempi | Trigger |
|---|---|---|
| Scadenze | IVA trimestrale tra 7gg, F24 tra 3gg, CU da generare | Tempo + stato adempimento |
| Anomalie contabili | Sbilancio dare/avere, conto con saldo anomalo, scritture mancanti | Post-registrazione + batch notturno |
| Cash flow | Saldo cassa previsto negativo entro 15gg, incassi in ritardo >30gg | Simulazione cassa giornaliera |
| Compliance | Fattura elettronica non inviata da >5gg, LIPE trimestre scaduto | Stato documenti + calendario |
| Confronto | Ricavi -20% vs anno precedente, costi anomali | Analisi comparativa periodica |
| Riconciliazione | Movimenti non riconciliati da >7gg, differenza saldo >X€ | Stato riconciliazione |

- Regole: soglia configurabile, gravità (INFO/WARNING/CRITICAL), destinatari per ruolo, canale (in-app, email)
- Seed di default, personalizzabili per società
- Anti-spam: raggruppamento alert simili, snooze, digest giornaliero opzionale

### 4.2 Smart To-Do
- Path: `src/lib/intelligence/todo-engine.ts`
- Lista giornaliera ordinata per priorità, diversa per ruolo:

| Ruolo | To-do tipiche |
|---|---|
| Modalità Semplice | "Hai 3 fatture da registrare", "Scadenza IVA tra 5 giorni" |
| Modalità Avanzata | + "2 scritture da rivedere", "Riconciliazione: 12 movimenti pending" |
| Commercialista | + "Cliente Rossi: bilancio da chiudere", "5 clienti con anomalie", "3 CU da generare" |

- Fonti: scadenze fiscali, bozze, riconciliazione pending, anomalie, documenti portale, fatture da inviare
- Deep link: ogni to-do è un link diretto alla pagina/azione pertinente
- Stato: da fare → in corso → completata (tracking automatico)
- Snapshot giornaliero per storico produttività

### 4.3 Dashboard Smart
- Evoluzione della dashboard attuale, layout adattivo per modalità
- **Sezione superiore — Stato di salute**: health score con trend, semaforo per aree (contabilità, IVA, scadenze, cassa), drill-down su click
- **Sezione centrale — To-do del giorno**: lista prioritizzata con completamento inline, vista multi-cliente per commercialista
- **Sezione inferiore — Timeline proattiva**: calendario rolling 30gg con scadenze, pagamenti, azioni pianificate, codice colore per urgenza

### 4.4 Modello dati

```
RegolaAlert {
  id, societaId (null = globale), categoria, codice,
  descrizione, sogliaValore, sogliaGiorni,
  gravita (INFO/WARNING/CRITICAL),
  attiva, canali[], ruoliDestinatari[],
  createdAt, updatedAt
}

AlertGenerato {
  id, societaId, regolaId, utenteDestinatarioId,
  tipo, messaggio, gravita, datiContexto (JSON),
  linkAzione, stato (NUOVO/VISTO/SNOOZED/RISOLTO),
  snoozeFinoA, risoltoAt, createdAt
}
// Un AlertGenerato per ogni utente destinatario (denormalizzato per query efficiente)

TodoGenerato {
  id, societaId, utenteId, data, titolo,
  descrizione, priorita (1-5), linkAzione,
  fonte (SCADENZA/ANOMALIA/BOZZA/RICONCILIAZIONE/...),
  stato (DA_FARE/IN_CORSO/COMPLETATA/SALTATA),
  completataAt, createdAt
}
```

### 4.5 Integrazione con Strato 1
- Alert e to-do esposti via API pubblica (`/api/v1/alert`, `/api/v1/todo`)
- Webhook su nuovi alert critici
- Configurazione regole/soglie via API

---

## 5. Strato 3 — SP13: Reportistica e Business Intelligence

### 5.1 KPI Engine
- Path: `src/lib/bi/kpi-engine.ts`
- Calcolo on-demand o cached con invalidazione smart
- KPI predefiniti:

| Categoria | KPI |
|---|---|
| Economici | Ricavi, Costi, Margine lordo, EBITDA, Utile netto |
| Finanziari | Liquidità corrente, Quick ratio, DSO, DPO, Cash burn rate |
| Fiscali | Debito IVA cumulato, Credito IVA, Carico fiscale stimato, Aliquota effettiva |
| Operativi | N. fatture emesse/ricevute, Tempo medio incasso, Tasso insoluti |
| Crescita | Variazione ricavi YoY, Variazione costi YoY, Trend margine |

- Ogni KPI: valore corrente, variazione % vs periodo precedente, trend, soglie alert
- KPI personalizzabili basati su conti specifici del piano dei conti
- Cache: batch notturno + invalidazione on-write

### 5.2 Analisi Comparativa
- Path: `src/lib/bi/comparativa.ts`
- Dimensioni:

| Confronto | Descrizione |
|---|---|
| Periodo vs Periodo | Mese/trimestre/anno corrente vs precedente |
| Budget vs Consuntivo | Obiettivi vs dati reali (modello Budget) |
| Azienda vs Azienda | Confronto KPI tra clienti (per commercialista) |
| ~~Benchmark settoriale~~ | ~~Valori riferimento ISTAT/camere di commercio~~ — **DIFFERITO a fase successiva** (richiede sourcing dati complesso) |

- Output: tabelle comparative, delta assoluto/percentuale, evidenziazione scostamenti

### 5.3 Grafici Interattivi
- Libreria: Recharts (React, leggera, SSR-friendly)
- Tipi fase 1: Line, Bar, Stacked bar, Pie/Donut, Area
- Tipi differiti: Waterfall, Heatmap (aggiungere su richiesta utenti)
- Interattività: zoom, drill-down, tooltip, filtri inline
- Responsive: mobile/tablet/desktop
- Esportabile: PNG/SVG + dati CSV

### 5.4 Report Builder
- Path: `src/lib/bi/report-builder.ts`
- Report predefiniti:

| Report | Contenuto | Destinatario |
|---|---|---|
| Cruscotto mensile | KPI + trend + alert | Titolare/Socio |
| Report IVA trimestrale | Riepilogo + liquidazione + previsione | Commercialista/Titolare |
| Analisi costi | Breakdown per categoria + confronto | Titolare |
| Situazione clienti/fornitori | Aging, insoluti, scaduto, previsione | Commercialista |
| Report annuale | CE + SP + KPI + trend + confronto | Assemblea soci |
| Multi-cliente | Dashboard aggregata con semafori | Commercialista |

- Output: schermo, PDF (@react-pdf/renderer), email schedulata
- Schedulazione: Vercel Cron (o equivalente) esegue batch giornaliero che controlla `ReportTemplate.schedulazione` e genera i report dovuti. Settimanale/mensile/trimestrale automatica
- AI narrative: integrazione con report-generator esistente (Claude Haiku)
- **Nota**: report custom con composizione sezioni da catalogo è differito a fase successiva. Si parte con i report predefiniti.

### 5.5 Modello dati

```
KpiDefinizione {
  id, societaId (null = predefinito), codice, nome,
  categoria, formula (JSON), contiRiferimento[],
  sogliaSemaforo (JSON: {verde, giallo, rosso}),
  attivo, ordine, createdAt
}

KpiValore {
  id, societaId, kpiId, periodo,
  periodoTipo (MESE/TRIMESTRE/ANNO),
  valore, valorePrec, variazione, trend,
  calcolatoAt
  @@unique([societaId, kpiId, periodo, periodoTipo])
}

Budget {
  id, societaId, anno, nome,
  stato (BOZZA/APPROVATO),
  approvatoDa, approvatoAt,
  createdAt, updatedAt
}

BudgetRiga {
  id, budgetId, contoId, mese (1-12), importo
}

ReportTemplate {
  id, societaId (null = predefinito), nome,
  sezioni (JSON: [{tipo, config}]),
  formato, schedulazione, destinatari[],
  attivo, createdAt
}

ReportGeneratoBI {
  id, societaId, templateId, periodo,
  dati (JSON), narrativaAI, fileUrl,
  stato, generatoAt
}
```

### 5.6 Integrazione con strati precedenti
- Ogni grafico/tabella ha bottone export (Strato 1)
- API `/api/v1/kpi`, `/api/v1/report` espone tutto programmaticamente (Strato 1)
- KPI alimentano regole alert (Strato 2)
- Report schedulati nelle to-do (Strato 2)
- Budget usa strutture piano dei conti esistente

---

## 6. Strato 4 — SP14: Portale Clienti Full

### 6.1 Dashboard KPI Cliente
- Evoluzione dashboard `/portale` esistente
- Sezioni:

| Sezione | Contenuto | Dati da |
|---|---|---|
| Stato di salute | Semaforo + health score semplificato | Strato 2 (HealthScore) |
| Numeri chiave | Ricavi, Costi, Margine, Liquidità + trend | Strato 3 (KPI Engine) |
| Grafici | Andamento 12 mesi, cash flow previsto | Strato 3 (Recharts) |
| Scadenze | Prossime 5 con countdown e stato | Scadenzario esistente |
| Alert | Alert attivi filtrati per gravità | Strato 2 (AlertGenerato) |

- Commercialista configura quali KPI sono visibili per ciascun cliente
- Visualizzazione semplificata: no gergo tecnico, label chiare, tooltip esplicativi

### 6.2 Area Documenti Evoluta
- Evoluzione di `/portale/documenti` e `/portale/richieste`

| Funzionalità | Descrizione |
|---|---|
| Upload proattivo | Cliente carica documenti categorizzati (fattura, nota spese, estratto conto) |
| OCR automatico | Upload → OCR (provider: engine `/api/ocr` già esistente nel progetto, basato su servizio esterno configurabile — default Google Vision API per supporto lingua italiana e formati fiscali P.IVA/CF) → estrazione dati → bozza operazione auto-generata |
| Stato documento | Pipeline: Caricato → In lavorazione → Registrato → Archiviato |
| Cartelle tematiche | Organizzazione per anno/tipo |
| ~~Firma digitale~~ | ~~Firma FEA direttamente nel portale~~ — **DIFFERITO a sotto-progetto dedicato** (richiede compliance eIDAS/AgID) |
| Notifica bidirezionale | Commercialista notificato su upload, cliente su documento pronto |

### 6.3 Prima Nota Semplificata
- Nuova sezione `/portale/prima-nota`
- Interfaccia ultra-semplificata:

| Azione | Dettaglio |
|---|---|
| Registra incasso | Importo, cliente, data, metodo pagamento → genera scritture |
| Registra pagamento | Importo, fornitore, data, categoria → genera scritture |
| Carica fattura | Upload → OCR → compilazione auto → conferma 1-click |
| Segna come pagato | Lista scadenze aperte → click per marcare |

- Ogni operazione entra come **bozza** — il commercialista valida o corregge
- Commercialista configura quali azioni il cliente può compiere (per cliente)
- Audit trail: ogni azione loggata e distinguibile

### 6.4 Messaggistica e Collaborazione
- Path: `src/lib/portale/chat.ts`
- Conversazioni contestuali legate a: documento, scadenza, operazione, alert, o libere

| Funzionalità | Descrizione |
|---|---|
| Thread contestuali | Messaggio legato a entità specifica |
| Allegati | Documenti allegati in conversazione |
| Stato lettura | Letto/non letto per entrambe le parti |
| Notifica | Email + in-app su nuovo messaggio |
| Ricerca | Full-text nelle conversazioni |
| Storico | Archivio completo filtrabile |

- Commercialista: inbox unificata multi-cliente ordinata per urgenza

### 6.5 Self-Service Fiscale
- Sezioni read-only (o con interazione limitata):

| Sezione | Contenuto | Interazione |
|---|---|---|
| Situazione IVA | Riepilogo per periodo, debito/credito | Solo lettura |
| Scadenzario | Scadenze con aging | Segna come pagato |
| Fatture emesse | Lista con stato (emessa/inviata/incassata) | Download XML/PDF |
| Fatture ricevute | Lista con stato registrazione | Upload nuove |
| F24 | Storico con importi e date | Download, segna pagato |
| Bilancio semplificato | CE/SP comprensibile | Solo lettura |
| Report | Report commercialista + AI narrative | Download PDF |

- Commercialista configura quali sezioni sono visibili per ciascun cliente

### 6.6 Configurazione Portale Avanzata
- Evoluzione di `/portale-config`, nuovo pannello `/configurazione/portale`:

| Configurazione | Descrizione |
|---|---|
| Profilo portale | Logo studio, colori, messaggio benvenuto, footer |
| Permessi per cliente | Matrice: chi vede/fa cosa |
| Notifiche | Regole: quando avvisare il cliente |
| Template richieste | Richieste predefinite riutilizzabili |
| Onboarding | Email invito personalizzabile, guida primo accesso |
| ~~Firma digitale~~ | ~~Configurazione provider FEA~~ — **DIFFERITO** |

### 6.7 Modello dati

```
MessaggioPortale {
  id, societaId, accessoClienteId,
  mittenteTipo (CLIENTE/COMMERCIALISTA), mittenteId,
  testo,
  contestoTipo (DOCUMENTO/SCADENZA/OPERAZIONE/ALERT/LIBERO),
  contestoId, threadId,
  letto, lettoAt, createdAt
}

AllegatoMessaggio {
  id, messaggioId, nome, mimeType, dimensione,
  fileUrl, documentoCondivisoId (ref opzionale a DocumentoCondiviso),
  createdAt
}
// Relazione esplicita invece di JSON blob — permette query "tutti i documenti in conversazione X"

ThreadPortale {
  id, societaId, accessoClienteId, oggetto,
  contestoTipo, contestoId,
  stato (APERTO/CHIUSO),
  createdAt, ultimoMessaggioAt
}

OperazionePortale {
  id, societaId, accessoClienteId,
  tipo (INCASSO/PAGAMENTO/FATTURA),
  dati (JSON), documentoAllegato,
  stato (BOZZA/VALIDATA/RIFIUTATA),
  operazioneId (ref dopo validazione),
  noteCommercialista, validataAt, createdAt
}
// Schema JSON per `dati` discriminato per tipo:
//   INCASSO: {importo, clienteId?, descrizione, data, metodoPagamento}
//   PAGAMENTO: {importo, fornitoreId?, descrizione, data, categoriaId}
//   FATTURA: {ocrData, importo, fornitoreId?, numero, data}

PermessoPortale {
  id, accessoClienteId,
  sezione (KPI/PRIMA_NOTA/DOCUMENTI/CHAT/IVA/SCADENZARIO/FATTURE/F24/BILANCIO/REPORT),
  lettura, scrittura, createdAt
}

// FirmaDocumento — DIFFERITO a sotto-progetto FEA dedicato
```

### 6.8 Migrazione modelli esistenti
- **`RichiestaDocumento` / `DomandaCliente`** (SP4): vengono deprecati. I dati esistenti vengono migrati a `ThreadPortale` + `MessaggioPortale` con uno script di migrazione. Le nuove richieste usano esclusivamente il sistema thread/messaggi. I vecchi endpoint `/portale/richieste` restano attivi in sola lettura per 3 mesi, poi rimossi.
- **`ConfigurazionePortale` (boolean fields)**: i campi booleani esistenti (`clientePuoCaricareFatture`, `clienteVedeSituazioneIva`, etc.) vengono sostituiti da `PermessoPortale` granulare per cliente. Migrazione: i valori booleani attuali vengono applicati come default a tutti i `PermessoPortale` generati per i clienti esistenti. I campi booleani vengono deprecati nel modello.

### 6.9 Sicurezza Portale
- **Il portale usa JWT (sistema esistente), NON API key.** Le API key (SP11) sono per integrazioni esterne terze parti. Il portale chiama endpoint interni Next.js con JWT scoped al cliente — non passa per `/api/v1/`.
- JWT con scope granulare basato su PermessoPortale
- Verifica accesso a sezione e società su ogni richiesta
- Operazioni cliente sempre come bozza — mai scrittura diretta
- Rate limiting dedicato
- Audit log completo
- Sessione: timeout assoluto 8h + idle timeout 30 minuti di inattività (app finanziaria)

### 6.10 Note tecniche
- **Ricerca full-text messaggi**: MySQL FULLTEXT index su `MessaggioPortale.testo`. Sufficiente per volumi attesi (centinaia/migliaia di messaggi per società). Se i volumi crescono significativamente, valutare migrazione a search engine esterno.

### 6.11 Integrazione con tutti gli strati

| Strato | Integrazione |
|---|---|
| Strato 1 (API) | Il portale riusa la stessa business logic dell'API ma con endpoint interni dedicati. OCR upload usa l'engine OCR esistente. I dati del portale sono esposti via API pubblica per integrazioni terze. |
| Strato 2 (Intelligence) | Alert filtrati per cliente in dashboard. To-do commercialista include "Cliente X ha caricato N documenti". |
| Strato 3 (BI) | KPI e grafici filtrati e semplificati. Report schedulati pubblicati automaticamente. |

---

## 7. Target Utenti

L'intero design sfrutta le 3 modalità esistenti:
- **Modalità Semplice (PMI)**: dashboard semplificata, to-do essenziali, portale come punto di contatto col commercialista
- **Modalità Avanzata (PMI evoluta)**: KPI completi, analisi comparativa, export avanzati, prima nota portale
- **Modalità Commercialista**: vista multi-cliente, inbox unificata, configurazione granulare portale, BI aggregata, API management

---

## 8. Fonti Scouting

- [Clac - Lista problemi software gestionale](https://www.clac.it/la-lista-di-problemi-del-software-gestionale-che-usi-e-come-risolverli)
- [Rizzetto - Gestionali ERP italiani panorama deludente](https://www.rizzetto.com/Blog/post/Gestionali-Erp-italiani_un-panorama-tecnologico-deludente)
- [FiscoeTasse - Forum software contabile/fiscale](https://www.fiscoetasse.com/forum/threads/software-contabile-fiscale.91890/)
- [FiscoeTasse - Forum gestionale contabilità](https://www.fiscoetasse.com/forum/threads/gestionale-contabilit%C3%A0.120643/)
- [Trustpilot - TeamSystem](https://www.trustpilot.com/review/teamsystem.com)
- [Trustpilot - Fatture in Cloud](https://www.trustpilot.com/review/fattureincloud.it)
- [Trustpilot - Passepartout](https://www.trustpilot.com/review/passepartout.net)
- [Trustpilot - Zucchetti](https://it.trustpilot.com/review/www.zucchetti.it)
- [Capterra - Contabilità GB](https://www.capterra.com/p/200583/Contabilita-GB/)
- [Qonto - 6 migliori software commercialisti](https://qonto.com/it/blog/gestione-aziendale/contabilita/software-per-commercialisti)
- [Companeo - Prezzi software contabilità](https://www.companeo.it/software-contabilita/guide/prezzo-software-contabilita)
- [PITV - Confronto 3 gestionali](https://www.pitv.it/commercialista-del-futuro/miglior-software-commercialisti/)
- [Professionista Digitale - Trend 2026](https://www.professionista-digitale.it/consulenza/contabilita-e-gestione-fiscale-trend-2026/)
