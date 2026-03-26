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
- Rate limiting: configurabile per key (default 1000 req/h, sliding window)
- Endpoint CRUD per tutte le entità principali + ricerca con filtri
- Documentazione OpenAPI/Swagger auto-generata
- Webhook: notifiche push su eventi (nuova operazione, scadenza, etc.) con HMAC signature
- UI admin: `/configurazione/api` per gestire chiavi, usage, docs

### 3.4 Modello dati

```
ApiKey {
  id, societaId, nome, key (hash bcrypt),
  scopes[], rateLimitPerHour, attiva,
  ultimoUtilizzo, createdAt, expiresAt
}

WebhookEndpoint {
  id, societaId, url, eventi[], secret (HMAC),
  attivo, ultimaConsegna, consecutiviFalliti
}

ImportJob {
  id, societaId, softwareOrigine, stato,
  fileOriginale, mappingCampi (JSON),
  righeProcessate, righeErrore, errori (JSON),
  createdAt, completatoAt
}

ExportJob {
  id, societaId, tipo, formato, filtri (JSON),
  stato, fileUrl, createdAt
}
```

### 3.5 Sicurezza
- API key hashate, mai esposte in chiaro dopo creazione
- Scope granulari: `read:operazioni`, `write:operazioni`, `read:anagrafiche`, etc.
- Audit log su ogni chiamata API
- Webhook con HMAC signature per verifica autenticità
- Rate limiting con sliding window

---

## 4. Strato 2 — SP12: Intelligenza Proattiva

### 4.1 Alert Engine
- Path: `src/lib/intelligence/alert-engine.ts`
- Esecuzione periodica (cron o on-demand) con batteria di controlli configurabili
- Categorie:

| Categoria | Esempi | Trigger |
|---|---|---|
| Scadenze | IVA trimestrale tra 7gg, F24 tra 3gg, CU da generare | Tempo + stato adempimento |
| Anomalie contabili | Sbilancio dare/avere, conto con saldo anomalo, scritture mancanti | Post-registrazione + batch notturno |
| Cash flow | Saldo cassa previsto negativo entro 15gg, incassi in ritardo >30gg | Simulazione cassa giornaliera |
| Compliance | Fattura elettronica non inviata da >5gg, LIPE trimestre scaduto | Stato documenti + calendario |
| Confronto | Ricavi -20% vs anno precedente, costi anomali | Analisi comparativa periodica |
| Riconciliazione | Movimenti non riconciliati da >7gg, differenza saldo >X€ | Stato riconciliazione |

- Regole: soglia configurabile, gravità (INFO/WARNING/CRITICAL), destinatari per ruolo, canale (in-app, email, push)
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
  id, societaId, regolaId, tipo, messaggio,
  gravita, datiContexto (JSON), linkAzione,
  stato (NUOVO/VISTO/SNOOZED/RISOLTO),
  snoozeFinoA, risoltoAt, createdAt
}

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
| Benchmark settoriale | Valori riferimento ISTAT/camere di commercio |

- Output: tabelle comparative, delta assoluto/percentuale, evidenziazione scostamenti

### 5.3 Grafici Interattivi
- Libreria: Recharts (React, leggera, SSR-friendly)
- Tipi: Line, Bar, Stacked bar, Pie/Donut, Area, Waterfall, Heatmap
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

- Report custom: composizione sezioni da catalogo
- Output: schermo, PDF (@react-pdf/renderer), email schedulata
- Schedulazione: settimanale/mensile/trimestrale automatica
- AI narrative: integrazione con report-generator esistente (Claude Haiku)

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
}

Budget {
  id, societaId, anno, nome,
  stato (BOZZA/APPROVATO),
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
| OCR automatico | Upload → OCR → estrazione dati → bozza operazione auto-generata |
| Stato documento | Pipeline: Caricato → In lavorazione → Registrato → Archiviato |
| Cartelle tematiche | Organizzazione per anno/tipo |
| Firma digitale | Firma FEA direttamente nel portale |
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
| Firma digitale | Configurazione provider FEA |

### 6.7 Modello dati

```
MessaggioPortale {
  id, societaId, accessoClienteId,
  mittenteTipo (CLIENTE/COMMERCIALISTA), mittenteId,
  testo, allegati (JSON),
  contestoTipo (DOCUMENTO/SCADENZA/OPERAZIONE/ALERT/LIBERO),
  contestoId, threadId,
  letto, lettoAt, createdAt
}

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

PermessoPortale {
  id, accessoClienteId,
  sezione (KPI/PRIMA_NOTA/DOCUMENTI/CHAT/IVA/SCADENZARIO/FATTURE/F24/BILANCIO/REPORT),
  lettura, scrittura, createdAt
}

FirmaDocumento {
  id, societaId, accessoClienteId, documentoId,
  stato (RICHIESTA/FIRMATO/RIFIUTATO),
  firmaDati (JSON), firmatoAt, createdAt
}
```

### 6.8 Sicurezza Portale
- JWT con scope granulare basato su PermessoPortale
- Verifica accesso a sezione e società su ogni richiesta
- Operazioni cliente sempre come bozza — mai scrittura diretta
- Rate limiting dedicato
- Audit log completo
- Sessione con timeout configurabile (default 8h)

### 6.9 Integrazione con tutti gli strati

| Strato | Integrazione |
|---|---|
| Strato 1 (API) | Portale è consumer API pubblica. Ogni endpoint chiama `/api/v1/*` con token scoped. OCR upload usa import engine. |
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
