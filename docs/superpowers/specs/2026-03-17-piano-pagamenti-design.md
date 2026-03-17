# Design: Piano Pagamenti e Gestione Cassa Rateale

**Data:** 2026-03-17
**Stato:** Approvato

## Problema

Quando si inserisce un cespite (es. automobile) acquistato a rate, la dashboard e la simulazione cassa mostrano l'intero importo come uscita immediata nel mese dell'acquisto. Il sistema non distingue tra pagamento in blocco e pagamento rateale, gonfiando le uscite di cassa nel periodo dell'operazione.

## Soluzione

Introdurre un modello generale di **Piano di Pagamento** applicabile a qualsiasi operazione (non solo veicoli), che separa nettamente il concetto di **competenza** (fiscale) dal **flusso di cassa** (pagamenti reali). Supporta tre modalità: pagamento immediato (nessun piano), rateale, e personalizzato (acconti + saldi irregolari).

## Riferimenti normativi

- **Art. 102 TUIR** — L'ammortamento decorre dalla data di acquisto/entrata in funzione, indipendentemente dal pagamento delle rate.
- **IVA regime ordinario** — L'IVA è detraibile al momento della fattura di acquisto, non al pagamento delle rate.
- **Art. 164 TUIR** — Gli interessi passivi su finanziamenti veicoli seguono la stessa percentuale di deducibilità del veicolo (20% promiscuo, 100% strumentale esclusivo, 70% uso dipendenti). NON sono soggetti al limite ROL (Art. 96 TUIR).
- **Art. 96 TUIR** — Per interessi passivi su finanziamenti non-veicolo: deducibili fino a 30% del ROL (raramente rilevante per SRL piccole).
- **Art. 10 DPR 633/72** — Gli interessi sono operazione finanziaria esente IVA, non entrano nel calcolo IVA.
- **Interessi passivi e principio di cassa** — Per le imprese in contabilità ordinaria (SRL), gli interessi passivi sono deducibili per competenza economica (maturazione), non per cassa. Pertanto si usa la `data` prevista del pagamento, non la `dataEffettivaPagamento`.

---

## Sezione 1 — Modello Dati

### Nuovi modelli

#### PianoPagamento

| Campo | Tipo | Note |
|---|---|---|
| id | Int | PK, autoincrement |
| operazioneId | Int | FK 1:1 con Operazione, unique |
| societaId | Int | FK con Societa (denormalizzato da Operazione per query performance) |
| tipo | Enum (RATEALE, CUSTOM) | |
| stato | Enum (ATTIVO, CHIUSO_ANTICIPATAMENTE, COMPLETATO) | |
| numeroRate | Int? | Solo per RATEALE |
| importoRata | Decimal? | Solo per RATEALE |
| tan | Decimal? | Tasso Annuo Nominale, default 0 |
| anticipo | Decimal? | Default 0 |
| frequenzaRate | Enum (MENSILE) | Default MENSILE. Solo mensile supportato al lancio. |
| dataInizio | DateTime | Data prima rata o pagamento |
| dataChiusura | DateTime? | Solo se chiuso anticipatamente |
| motivoChiusura | Enum? (ESTINZIONE_ANTICIPATA, PERMUTA, RIFINANZIAMENTO) | |
| penaleEstinzione | Decimal? | Costo penale di estinzione anticipata (deducibile) |
| saldoResiduo | Decimal? | Quota capitale residua saldata alla chiusura |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Pagamento

| Campo | Tipo | Note |
|---|---|---|
| id | Int | PK, autoincrement |
| pianoPagamentoId | Int | FK con PianoPagamento |
| numeroPagamento | Int | Ordine sequenziale (1, 2, 3...) |
| data | DateTime | Data prevista del pagamento |
| importo | Decimal | Importo totale della rata |
| quotaCapitale | Decimal | Porzione capitale |
| quotaInteressi | Decimal | Porzione interessi (0 se TAN=0) |
| stato | Enum (PREVISTO, EFFETTUATO, ANNULLATO) | |
| dataEffettivaPagamento | DateTime? | Quando diversa dalla data prevista |
| note | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Indici database

- `PianoPagamento`: indice su `(societaId)`, indice unique su `(operazioneId)`
- `Pagamento`: indice su `(pianoPagamentoId, data, stato)`, indice su `(data, stato)` per query cassa aggregate

### Modifiche a modelli esistenti

#### Operazione

- **Nessun nuovo campo**. La presenza o assenza di un `PianoPagamento` collegato determina la modalità:
  - `PianoPagamento` assente → pagamento immediato (il caso più comune)
  - `PianoPagamento` presente → rateale o custom, leggere `PianoPagamento.tipo`

#### Finanziamento (deprecato)

Il modello `Finanziamento` attuale (legato a `Veicolo`) viene migrato in `PianoPagamento`. Vedi Sezione 6 per il dettaglio della migrazione.

### Comportamento per modalità

| Modalità | PianoPagamento | Pagamenti generati |
|---|---|---|
| IMMEDIATO | Non creato (null). L'importo dell'operazione è considerato pagato alla `dataOperazione` | Nessuno |
| RATEALE | tipo=RATEALE, con parametri finanziari | N pagamenti generati automaticamente (ammortamento francese se TAN>0, altrimenti divisione lineare). Frequenza mensile. |
| CUSTOM | tipo=CUSTOM | L'utente aggiunge manualmente acconti/saldi con date e importi liberi |

### Validazione per modalità CUSTOM

- La somma degli importi dei Pagamento NON può superare `Operazione.importoTotale`
- La UI mostra un indicatore "Importo coperto: €X / €Y" e blocca l'aggiunta se si supera il totale
- Non obbliga a coprire il 100% subito — l'utente può aggiungere pagamenti man mano

### Regola chiave: separazione cassa vs competenza

- **Competenza (fiscale)**: si legge da `Operazione.importoImponibile`, `importoIva`, ammortamento → nessun cambiamento
- **Cassa**: se `PianoPagamento` esiste → somma dei `Pagamento` nel periodo; se non esiste → `Operazione.importoTotale` alla `dataOperazione`
- **Interessi passivi**: si leggono dalla somma di `quotaInteressi` dei `Pagamento` nel periodo → costo deducibile separato

### Supporto per FATTURA_ATTIVA

Il modello supporta anche le fatture attive a rate (crediti rateali). Una FATTURA_ATTIVA con PianoPagamento rappresenta un incasso dilazionato. In questo caso:
- I Pagamento rappresentano le rate di incasso dal cliente
- La dashboard li conteggia come entrate di cassa distribuite nel tempo
- Fiscalmente non cambia nulla: il ricavo è per competenza alla data fattura

---

## Sezione 2 — Dashboard e Simulazione Cassa

### KPI attuali (nessun cambiamento)

- **Fatturato**, **Costi**, **Utile** → continuano a leggere da `Operazione` per competenza
- **Ammortamento** → continua a leggere da `QuotaAmmortamento`

### Simulazione Cassa (cambia)

Attualmente la dashboard somma `importoTotale` delle operazioni nel periodo. Con il nuovo modello:

**Per operazioni CON PianoPagamento:**
- Usa la somma dei `Pagamento` nel periodo, filtrando per data e stato

**Per operazioni SENZA PianoPagamento (retrocompatibilità):**
- Usa `Operazione.importoTotale` alla `dataOperazione` come uscita/entrata immediata (comportamento attuale invariato)

**Calcoli:**
- **Entrate di cassa** = Pagamento EFFETTUATI su FATTURA_ATTIVA + importoTotale di FATTURA_ATTIVA senza piano
- **Uscite di cassa** = Pagamento EFFETTUATI su COSTO/CESPITE/etc + importoTotale di operazioni senza piano
- **Cassa prevista** = come sopra ma includendo anche `stato = PREVISTO` per i mesi futuri
- **Interessi passivi del periodo** = somma `quotaInteressi` dei Pagamento EFFETTUATI nel periodo → mostrati come voce separata nei KPI

### Nuovo KPI: "Rate in scadenza"

Conta e somma i `Pagamento` con `stato = PREVISTO` e `data` nel mese corrente. Serve come promemoria: "Hai 3 rate in scadenza questo mese per €1.250".

### Trend mensile (cambia)

Il grafico trend attualmente mostra fatturato e costi per mese per competenza. Si aggiunge una seconda serie **"Flusso di cassa"** che mostra entrate/uscite effettive per mese basate sui Pagamenti (+ operazioni senza piano come immediati). Questo dà la visione duale: competenza vs cassa.

---

## Sezione 3 — UI Form Operazione e Gestione Pagamenti

### Form creazione/modifica Operazione

Aggiunta di una sezione "Modalità di pagamento" dopo i campi esistenti. Disponibile per tutti i tipi di operazione (COSTO, CESPITE, FATTURA_ATTIVA, etc.).

**Step 1 — Selettore modalità** (radio buttons):
- **Pagamento immediato** (default) — nessun campo aggiuntivo, nessun PianoPagamento creato
- **Pagamento rateale** — apre i campi finanziamento
- **Pagamento personalizzato** — apre editor libero

**Step 2a — Se RATEALE:**
- Anticipo (€, opzionale, default 0)
- Numero rate
- TAN % (default 0)
- Data prima rata
- Preview piano generato automaticamente: tabella con N righe (numero, data, quota capitale, quota interessi, totale rata). Ammortamento francese se TAN > 0, divisione lineare altrimenti. Rate mensili.

**Step 2b — Se CUSTOM:**
- Lista editabile di pagamenti: per ciascuno → data, importo, note
- Bottone "+ Aggiungi pagamento"
- Indicatore "Importo coperto: €X / €Y" con barra di progresso
- Blocco aggiunta se si supera importoTotale dell'operazione
- Non obbliga a coprire il 100% subito

### Pagina dettaglio Operazione — sezione "Pagamenti"

- Tabella con tutti i Pagamento del piano
- Per ogni riga: data prevista, importo, quota capitale, quota interessi, stato (badge PREVISTO/EFFETTUATO/ANNULLATO)
- Azione su ogni riga PREVISTO: "Segna come pagato" → stato = EFFETTUATO, `dataEffettivaPagamento` = oggi (modificabile)
- Per piani CUSTOM: possibilità di aggiungere nuovi pagamenti dopo la creazione

### Migrazione UX form veicolo

Il form veicolo attuale ha i campi finanziamento (anticipo, rate, TAN). Vengono sostituiti dal nuovo selettore modalità di pagamento — stessa UI per tutti i tipi di operazione.

---

## Sezione 4 — Impatto Fiscale e Report

### Ammortamento

Nessuna modifica. Continua a partire dalla data di acquisto, calcolato su `Cespite.valoreIniziale`, regola 50% primo anno (Art. 102 TUIR). Il piano pagamenti non influenza l'ammortamento.

### IVA

Nessuna modifica. In regime IVA ordinario, l'IVA è detraibile al momento della fattura. L'intero importo IVA va nella liquidazione del periodo della fattura, indipendentemente dalle rate.

### Interessi passivi — nuova voce nei report

**Stima fiscale** (`/api/report/stima-fiscale`):
- Aggiunge voce "Interessi passivi su finanziamenti"
- Somma `quotaInteressi` di tutti i `Pagamento` dell'anno per competenza economica: usa `data` (data maturazione prevista), coerente con il principio di competenza applicabile alle SRL in contabilità ordinaria
- Per veicoli: applica stessa % deducibilità del veicolo (Art. 164 TUIR)
- Per altri cespiti/operazioni: deducibilità 100% (soggetti a Art. 96 TUIR limite ROL)
- La penale di estinzione anticipata è un onere finanziario deducibile separatamente
- Gli interessi deducibili riducono la base imponibile IRES/IRAP

**Report IVA** (`/api/report/iva`): nessuna modifica — gli interessi sono esenti IVA (Art. 10 DPR 633/72).

### Ripartizione soci

Gli interessi passivi seguono lo stesso `tipoRipartizione` dell'operazione madre.

---

## Sezione 5 — Chiusura Anticipata e Permuta

### Flusso dall'UI

L'utente va nella pagina dettaglio dell'operazione, sezione "Pagamenti", e può:

1. **"Chiudi piano anticipatamente"** — disponibile su qualsiasi piano ATTIVO con rate PREVISTE
2. Seleziona motivo: ESTINZIONE_ANTICIPATA | PERMUTA | RIFINANZIAMENTO
3. Inserisce eventuale penale di estinzione (€) e/o saldo residuo capitale (€)
4. Conferma → Pagamenti PREVISTI diventano ANNULLATI, piano passa a CHIUSO_ANTICIPATAMENTE

### Permuta

Combinazione di due azioni normali:
1. **Cessione veicolo vecchio** (già esistente via `CessioneVeicolo`) → chiude il piano pagamenti
2. **Nuovo acquisto** (nuova operazione CESPITE) → con il suo piano pagamenti, anticipo che tiene conto del valore di permuta

Nessun collegamento formale tra le due operazioni.

### Impatto fiscale della chiusura

- Interessi già maturati (Pagamenti EFFETTUATI) restano deducibili
- Penale di estinzione anticipata è costo deducibile (onere finanziario), registrata in `penaleEstinzione`
- Saldo residuo capitale (`saldoResiduo`) è un pagamento in conto capitale, non un costo aggiuntivo
- Ammortamento: se bene resta in uso prosegue; se ceduto (permuta) si ferma e si calcola plus/minusvalenza come già previsto

---

## Sezione 6 — Strategia di Migrazione

### Migrazione dati Finanziamento → PianoPagamento

Per ogni record `Finanziamento` esistente:

1. **Creare `PianoPagamento`** con:
   - `operazioneId` = l'operazione del cespite/veicolo collegato
   - `societaId` = dalla relazione Operazione → Societa
   - `tipo` = RATEALE
   - `stato` = ATTIVO (o COMPLETATO se tutte le rate sono state generate)
   - `numeroRate`, `importoRata`, `tan`, `anticipo` = copiati da Finanziamento
   - `dataInizio` = `Finanziamento.dataPrimaRata`

2. **Generare i record `Pagamento`** dal piano ammortamento calcolato

3. **Gestione OperazioneRicorrente collegata**:
   - Se `Finanziamento.operazioneRicorrenteId` esiste, l'OperazioneRicorrente va disattivata (`attiva = false`)
   - Le Operazioni già generate da quella ricorrenza restano nel sistema come storico
   - I Pagamento corrispondenti alle date già passate vengono marcati come EFFETTUATO

4. **Campo `Veicolo.modalitaAcquisto`**: resta nel modello come informazione descrittiva (CONTANTI/FINANZIAMENTO), ma non guida più la logica dei pagamenti

5. **Rimozione modello Finanziamento**: dopo la migrazione e verifica, il modello viene rimosso dallo schema

### Retrocompatibilità

- Le operazioni esistenti senza PianoPagamento continuano a funzionare: la simulazione cassa le tratta come pagamenti immediati usando `importoTotale` alla `dataOperazione`
- Non è necessario creare PianoPagamento retroattivi per operazioni già esistenti con pagamento immediato

---

## Appendice — Note Implementative Prisma

### Convenzioni naming (coerenti con schema esistente)

- `PianoPagamento` → `@@map("piani_pagamento")`
- `Pagamento` → `@@map("pagamenti")`
- Tutti i campi camelCase mappati a snake_case (es. `pianoPagamentoId` → `@map("piano_pagamento_id")`)
- Enum names: `TipoPianoPagamento`, `StatoPianoPagamento`, `StatoPagamento`, `MotivoChiusura`, `FrequenzaRate` — ciascuno con `@@map` snake_case

### Precisione Decimal

- Campi monetari (`importoRata`, `anticipo`, `penaleEstinzione`, `saldoResiduo`, `importo`, `quotaCapitale`, `quotaInteressi`): `@db.Decimal(10, 2)`
- Campi percentuali (`tan`): `@db.Decimal(5, 2)`

### Cascade behavior

- `Operazione` → `PianoPagamento`: **no cascade** (Operazione usa soft-delete con `eliminato`)
- `PianoPagamento` → `Pagamento`: **cascade delete** (se il piano viene rimosso, i pagamenti associati non hanno senso)

### Relazioni da aggiungere

- `Societa` → aggiungere `pianiPagamento PianoPagamento[]`
- `Operazione` → aggiungere `pianoPagamento PianoPagamento?` (opzionale, 1:1)
- `PianoPagamento` → aggiungere `pagamenti Pagamento[]`

### Path migrazione Finanziamento

Il join per ottenere `operazioneId` è: `Finanziamento → Veicolo (veicoloId) → Cespite (cespiteId) → Operazione (operazioneId)`. Tre hop da esplicitare nello script di migrazione.
