# Frontend & Infrastruttura — Roadmap di Sviluppo Sequenziale

## Contesto

Il backend SP11-SP14 è completo (128 file, 761 test, 20 modelli Prisma, ~50 API routes). Questa roadmap copre tutto il lavoro rimanente: infrastruttura (cron, email, PDF), frontend per le nuove funzionalità, e configurazione avanzata.

**Approccio:** 6 fasi sequenziali, ognuna produce valore indipendente. Ogni fase diventa un piano implementativo separato.

---

## Fase 1: Infrastruttura Base

**Obiettivo:** Abilitare le funzionalità batch e asincrone che le fasi successive consumano.

### 1.1 Cron Batch Jobs
- **Percorso:** `src/app/api/cron/` (Vercel Cron compatibile)
- **Job alert giornaliero:** Chiama `generateAlerts(societaId)` per ogni società attiva. Esecuzione: ogni notte ore 2:00.
- **Job todo giornaliero:** Chiama `persistTodosForUser(societaId, utenteId)` per ogni utente attivo. Esecuzione: ogni mattina ore 6:00.
- **Job report schedulati:** Controlla `ReportTemplate.schedulazione` (weekly/monthly/quarterly), genera report per quelli dovuti. Esecuzione: ogni mattina ore 7:00.
- **Sicurezza:** Header `Authorization: Bearer CRON_SECRET` per proteggere endpoint cron.
- **Vercel config:** `vercel.json` con schedule cron expressions.

### 1.2 Sistema Email
- **Libreria:** `resend` o `nodemailer` (configurabile via env var `EMAIL_PROVIDER`)
- **Template email:** HTML inline per: alert critico, nuovo messaggio portale, report pronto, digest giornaliero
- **Percorso:** `src/lib/email/` con `send-email.ts`, `templates/`
- **Integrazione:** Dopo creazione alert con canale "EMAIL", invia email. Dopo nuovo messaggio portale, notifica controparte.
- **Preferenze:** Rispetta `PreferenzaNotifica` esistente per canale/frequenza.

### 1.3 PDF Report Rendering
- **Libreria:** `@react-pdf/renderer` (già installato)
- **Percorso:** `src/lib/bi/report/pdf-renderer.ts`
- **Layout:** Header (logo + nome società + periodo), sezioni KPI (tabella), grafici (snapshot immagine), narrativa AI (testo), footer (data generazione)
- **Integrazione:** `generateAndPersistReport()` produce dati JSON → `renderReportToPdf()` li converte in PDF → salva fileUrl.
- **API:** `GET /api/bi/report/[id]/pdf` restituisce il PDF generato.

---

## Fase 2: Dashboard Principale (Commercialista)

**Obiettivo:** Arricchire il dashboard esistente (`/`) con alert, todo e KPI in tempo reale.

### 2.1 Widget Alert/Todo
- **Centro notifiche:** Campanella in header con badge conteggio non letti. Dropdown con ultimi 10 alert (icona severità, messaggio, azione).
- **Todo del giorno:** Card nel dashboard con lista prioritizzata. Checkbox per completare inline. Link diretto all'azione.
- **Componenti:** `AlertBell.tsx`, `TodoWidget.tsx`, `AlertCard.tsx`
- **Dati:** `GET /api/alert?stato=NUOVO`, `GET /api/todo?data=oggi`

### 2.2 KPI Cards
- **Mini-cards:** 4-6 KPI principali nel dashboard (Ricavi, Costi, Margine, EBITDA) con sparkline Recharts.
- **Trend:** Freccia up/down/stable + percentuale variazione colorata (verde/rosso).
- **Componenti:** `KpiCard.tsx`, `KpiSparkline.tsx`
- **Dati:** `GET /api/bi/kpi?periodoTipo=MESE`

### 2.3 Report Viewer
- **Pagina:** Evoluzione di `/report` esistente
- **Lista report:** Tabella con nome, tipo, periodo, data generazione, azioni (visualizza, scarica PDF)
- **Dettaglio report:** Rendering sezioni (KPI summary, comparison table, health score, alert summary, narrativa)
- **Genera on-demand:** Bottone "Genera Report" con selezione tipo + periodo
- **Componenti:** `ReportList.tsx`, `ReportDetail.tsx`, `ReportSection.tsx`
- **Dati:** `GET /api/bi/report`, `POST /api/bi/report`, `GET /api/bi/report/[id]`

---

## Fase 3: BI & Reportistica Frontend

**Obiettivo:** Dashboard BI completa per analisi approfondita.

### 3.1 Dashboard KPI Completa
- **Pagina:** `/bi` (nuova)
- **Layout:** Griglia responsiva con tutti 12 KPI raggruppati per categoria (Economici, Finanziari, Fiscali, Operativi)
- **Filtri:** Selezione anno, periodo, tipo periodo (mese/trimestre/anno)
- **Semafori:** Verde/giallo/rosso basati su soglie KpiDefinizione.sogliaSemaforo
- **Componenti:** `KpiGrid.tsx`, `KpiDetailCard.tsx`, `PeriodSelector.tsx`

### 3.2 Analisi Comparativa
- **Sezione in `/bi`:** Tab "Confronto" con tabella comparativa
- **Grafici:** Bar chart confronto (Recharts BarChart), line chart trend 12 mesi
- **Interazione:** Hover tooltip, click per drill-down su singolo KPI
- **Componenti:** `ComparisonTable.tsx`, `TrendChart.tsx`, `ComparisonBarChart.tsx`
- **Dati:** `GET /api/bi/comparativa?anno=X&periodo=Y&periodoTipo=Z`

### 3.3 Budget Management
- **Pagina:** `/bi/budget` (nuova)
- **CRUD budget:** Crea budget annuale, inserisci importi per conto/mese (griglia editabile)
- **Visualizzazione scostamenti:** Tabella budget vs consuntivo con delta colorati, grafico stacked bar
- **Componenti:** `BudgetGrid.tsx`, `BudgetVsActualChart.tsx`, `BudgetForm.tsx`
- **Dati:** `GET/POST /api/bi/budget`, `GET /api/bi/budget/[id]?mese=X`

---

## Fase 4: Export/Import & Configurazione API

**Obiettivo:** Permettere export dati, import da competitor, gestione chiavi API.

### 4.1 Pagina Esportazioni
- **Pagina:** `/esportazioni` (nuova)
- **Layout:** Selezione entità (dropdown 12 tipi), selezione formato (CSV/JSON/Excel), filtri data opzionali, bottone "Esporta"
- **Backup completo:** Opzione "Esporta tutto (ZIP)" per backup società
- **Download:** Risposta diretta file dal server
- **Componenti:** `ExportForm.tsx`, `EntitySelector.tsx`
- **Dati:** `POST /api/esportazioni`, `GET /api/esportazioni` (lista entità/formati)

### 4.2 Wizard Importazione
- **Pagina:** `/importazione` (nuova)
- **Multi-step wizard:**
  1. Seleziona sorgente (TeamSystem, Zucchetti, Passcom, Fatture in Cloud, Danea) con logo/descrizione
  2. Upload file (drag & drop, validazione tipo)
  3. Mapping campi (tabella sorgente → destinazione con auto-mapping + override manuale)
  4. Preview risultati (prime 10 righe mappate + errori evidenziati)
  5. Conferma e importa (progress bar, risultato finale)
- **Componenti:** `ImportWizard.tsx`, `SourceSelector.tsx`, `FieldMapper.tsx`, `ImportPreview.tsx`
- **Dati:** parsing client-side con parser esistenti (danea.ts, teamsystem.ts), validazione con validator.ts

### 4.3 Configurazione API
- **Pagina:** `/configurazione/api` (nuova)
- **Sezione chiavi API:** Lista chiavi (nome, prefix, scopes, ultimo utilizzo, scadenza), crea nuova (dialog con nome + scopes checkboxes), rotazione, elimina
- **Sezione webhook:** Lista endpoint (url, eventi, stato, ultimi delivery), crea nuovo (url + selezione eventi), storico delivery con retry manuale
- **Componenti:** `ApiKeyList.tsx`, `ApiKeyForm.tsx`, `WebhookList.tsx`, `WebhookForm.tsx`, `DeliveryHistory.tsx`
- **Dati:** `GET/POST/PUT/DELETE /api/configurazione/api`, `GET/POST /api/configurazione/api/webhook`

---

## Fase 5: Portale Clienti Frontend

**Obiettivo:** Interfaccia completa per i clienti del commercialista.

### 5.1 Dashboard Portale Evoluta
- **Pagina:** Evoluzione di `/portale` esistente
- **Sezioni:** Semaforo salute azienda (HealthScore), KPI semplificati (ricavi, costi, margine con trend), prossime 5 scadenze con countdown, alert attivi filtrati, documenti recenti
- **Componenti:** `PortaleHealthBadge.tsx`, `PortaleKpiSummary.tsx`, `ScadenzaCountdown.tsx`
- **Dati:** `GET /api/portale/kpi`

### 5.2 Messaggistica
- **Pagina:** `/portale/messaggi` (nuova)
- **Layout:** Lista thread a sinistra (con badge non letti, ultimo messaggio, contesto), conversazione a destra (bolle chat, allegati, timestamp)
- **Azioni:** Nuovo thread (con selezione contesto opzionale), rispondi, allega file
- **Real-time:** Polling ogni 30s per nuovi messaggi (no WebSocket per semplicità)
- **Componenti:** `ThreadList.tsx`, `ChatView.tsx`, `MessageBubble.tsx`, `NewThreadDialog.tsx`
- **Dati:** `GET /api/portale/messaggi/thread`, `POST /api/portale/messaggi/thread`, `GET /api/portale/messaggi/thread/[id]`, `POST /api/portale/messaggi`

### 5.3 Prima Nota Semplificata
- **Pagina:** `/portale/prima-nota` (nuova)
- **Layout:** 3 card azione principali: "Registra Incasso", "Registra Pagamento", "Carica Fattura"
- **Form Incasso:** Importo, cliente (autocomplete), data, metodo pagamento, descrizione opzionale → crea bozza
- **Form Pagamento:** Importo, fornitore, data, categoria, descrizione → crea bozza
- **Form Fattura:** Upload file (drag & drop) + note opzionali → crea bozza
- **Lista operazioni:** Tabella sotto con stato (BOZZA/VALIDATA/RIFIUTATA), note commercialista
- **Componenti:** `IncassoForm.tsx`, `PagamentoForm.tsx`, `FatturaUploadForm.tsx`, `OperazioniPortaleList.tsx`
- **Dati:** `POST /api/portale/operazioni`, `GET /api/portale/operazioni`

### 5.4 Self-Service Fiscale
- **Pagina:** `/portale/fiscale` (nuova)
- **Tab navigation:** IVA | Scadenzario | Fatture | Report
- **IVA:** Tabella liquidazioni con saldo, periodo, stato versamento
- **Scadenzario:** Lista scadenze con semaforo (verde/giallo/rosso per urgenza), percentuale completamento
- **Fatture:** Lista fatture emesse con stato, download XML/PDF
- **Report:** Lista report disponibili con download PDF
- **Componenti:** `FiscaleTabs.tsx`, `LiquidazioniTable.tsx`, `ScadenzeList.tsx`, `FattureList.tsx`
- **Dati:** `GET /api/portale/fiscale?sezione=iva|scadenzario|fatture|report`

### 5.5 Inbox Commercialista
- **Pagina:** `/portale/inbox` (nuova, accessibile solo da dashboard commercialista)
- **Layout:** Vista unificata multi-cliente con: thread aperti (raggruppati per cliente, badge non letti), operazioni pending da validare (con bottoni approva/rifiuta inline), contatore totale non letti
- **Filtri:** Per cliente, per tipo (messaggi/operazioni), per urgenza
- **Componenti:** `InboxThreadList.tsx`, `PendingOperationsQueue.tsx`, `ClientFilter.tsx`
- **Dati:** `GET /api/portale/inbox`

---

## Fase 6: Configurazione Avanzata

**Obiettivo:** UI per personalizzare alert, permessi portale, branding.

### 6.1 Regole Alert
- **Pagina:** `/configurazione/alert` (nuova)
- **Layout:** Lista regole builtin raggruppate per categoria (Scadenze, Anomalie, Cash Flow, Compliance, Riconciliazione)
- **Per ogni regola:** Toggle attiva/disattiva, soglia giorni/valore editabile, gravità dropdown, canali checkboxes (IN_APP, EMAIL), ruoli destinatari checkboxes
- **Componenti:** `AlertRuleList.tsx`, `AlertRuleEditor.tsx`
- **Dati:** `GET /api/configurazione/alert`, `PUT /api/configurazione/alert`

### 6.2 Permessi Portale
- **Sezione in:** `/configurazione/accessi` (evoluzione pagina esistente)
- **Matrice:** Righe = sezioni (KPI, Prima Nota, Documenti, Chat, IVA, ...), Colonne = lettura/scrittura
- **Per cliente:** Seleziona cliente → mostra/modifica matrice permessi
- **Preset:** "Visualizzazione base" (solo lettura), "Operativo" (lettura + scrittura documenti/chat/prima nota), "Completo"
- **Componenti:** `PermissionMatrix.tsx`, `PermissionPresets.tsx`
- **Dati:** `GET /api/portale/permessi?clienteId=X`, `PUT /api/portale/permessi`

### 6.3 Profilo Portale
- **Sezione in:** `/configurazione/portale` (evoluzione pagina esistente, attualmente gestita da portale-config)
- **Campi:** Logo upload, colore primario (color picker), messaggio di benvenuto (textarea), footer personalizzato
- **Preview:** Anteprima live del portale con le modifiche
- **Componenti:** `PortalBrandingForm.tsx`, `PortalPreview.tsx`

---

## Riepilogo Fasi

| Fase | Focus | Pagine nuove | Componenti stimati | Prerequisiti |
|------|-------|-------------|-------------------|-------------|
| 1 | Infrastruttura | 0 | 0 | — |
| 2 | Dashboard principale | 0 (evolve `/`, `/report`) | ~8 | Fase 1 |
| 3 | BI Frontend | 2 (`/bi`, `/bi/budget`) | ~10 | Fase 2 |
| 4 | Export/Import/API Config | 3 (`/esportazioni`, `/importazione`, `/configurazione/api`) | ~12 | — |
| 5 | Portale Clienti | 4 (`/portale/*` evoluzioni + nuove) | ~16 | Fase 1 |
| 6 | Configurazione avanzata | 1 (`/configurazione/alert`) + evoluzioni | ~6 | Fasi 2-5 |
| **Totale** | | **~10 pagine** | **~52 componenti** | |

### Note implementative
- **Pattern componenti:** Seguire pattern shadcn/ui esistente (Tailwind + Radix)
- **Data fetching:** `fetch` client-side con SWR o useEffect (pattern esistente nel progetto)
- **Form:** React Hook Form + Zod (pattern esistente)
- **Charts:** Recharts (già in deps, usato in componenti report esistenti)
- **Responsive:** Mobile-first con breakpoint Tailwind (sm/md/lg)
- **Accessibilità:** Radix primitives gestiscono ARIA automaticamente
