# Design: Piano Pagamenti e Gestione Cassa Rateale

**Data:** 2026-03-17
**Stato:** Approvato

## Problema

Quando si inserisce un cespite (es. automobile) acquistato a rate, la dashboard e la simulazione cassa mostrano l'intero importo come uscita immediata nel mese dell'acquisto. Il sistema non distingue tra pagamento in blocco e pagamento rateale, gonfiando le uscite di cassa nel periodo dell'operazione.

## Soluzione

Introdurre un modello generale di **Piano di Pagamento** applicabile a qualsiasi operazione (non solo veicoli), che separa nettamente il concetto di **competenza** (fiscale) dal **flusso di cassa** (pagamenti reali). Supporta tre modalità: pagamento immediato, rateale, e personalizzato (acconti + saldi irregolari).

## Riferimenti normativi

- **Art. 102 TUIR** — L'ammortamento decorre dalla data di acquisto/entrata in funzione, indipendentemente dal pagamento delle rate.
- **IVA regime ordinario** — L'IVA è detraibile al momento della fattura di acquisto, non al pagamento delle rate.
- **Art. 164 TUIR** — Gli interessi passivi su finanziamenti veicoli seguono la stessa percentuale di deducibilità del veicolo (20% promiscuo, 100% strumentale esclusivo, 70% uso dipendenti). NON sono soggetti al limite ROL (Art. 96 TUIR).
- **Art. 96 TUIR** — Per interessi passivi su finanziamenti non-veicolo: deducibili fino a 30% del ROL (raramente rilevante per SRL piccole).
- **Art. 10 DPR 633/72** — Gli interessi sono operazione finanziaria esente IVA, non entrano nel calcolo IVA.

---

## Sezione 1 — Modello Dati

### Nuovi modelli

#### PianoPagamento

| Campo | Tipo | Note |
|---|---|---|
| id | String (cuid) | PK |
| operazioneId | String | FK 1:1 con Operazione |
| tipo | Enum (IMMEDIATO, RATEALE, CUSTOM) | |
| stato | Enum (ATTIVO, CHIUSO_ANTICIPATAMENTE, COMPLETATO) | |
| numeroRate | Int? | Solo per RATEALE |
| importoRata | Decimal? | Solo per RATEALE |
| tan | Decimal? | Tasso Annuo Nominale, default 0 |
| anticipo | Decimal? | Default 0 |
| dataInizio | DateTime | Data prima rata o pagamento |
| dataChiusura | DateTime? | Solo se chiuso anticipatamente |
| motivoChiusura | Enum? (ESTINZIONE_ANTICIPATA, PERMUTA, RIFINANZIAMENTO) | |
| importoEstinzione | Decimal? | Penale/saldo residuo alla chiusura |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Pagamento

| Campo | Tipo | Note |
|---|---|---|
| id | String (cuid) | PK |
| pianoPagamentoId | String | FK con PianoPagamento |
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

### Modifiche a modelli esistenti

#### Operazione

- Aggiunge: `modalitaPagamento` — Enum (IMMEDIATO, RATEALE, CUSTOM), default IMMEDIATO

#### Finanziamento (deprecato)

Il modello `Finanziamento` attuale (legato a `Veicolo`) viene migrato in `PianoPagamento`. I dati esistenti (anticipo, numeroRate, importoRata, tan, dataPrimaRata) vengono trasferiti. Il link `operazioneRicorrenteId` non serve più: le rate sono `Pagamento`, non operazioni ricorrenti.

### Comportamento per modalità

| Modalità | PianoPagamento | Pagamenti generati |
|---|---|---|
| IMMEDIATO | Creato con tipo=IMMEDIATO | 1 solo Pagamento, stesso importo dell'operazione, stato=EFFETTUATO |
| RATEALE | tipo=RATEALE, con parametri finanziari | N pagamenti generati automaticamente (ammortamento francese se TAN>0, altrimenti divisione lineare) |
| CUSTOM | tipo=CUSTOM | L'utente aggiunge manualmente acconti/saldi con date e importi liberi |

### Regola chiave: separazione cassa vs competenza

- **Competenza (fiscale)**: si legge da `Operazione.importoImponibile`, `importoIva`, ammortamento → nessun cambiamento
- **Cassa**: si legge dalla somma dei `Pagamento` nel periodo, filtrando per stato e data
- **Interessi passivi**: si leggono dalla somma di `quotaInteressi` dei `Pagamento` nel periodo → costo deducibile separato

---

## Sezione 2 — Dashboard e Simulazione Cassa

### KPI attuali (nessun cambiamento)

- **Fatturato**, **Costi**, **Utile** → continuano a leggere da `Operazione` per competenza
- **Ammortamento** → continua a leggere da `QuotaAmmortamento`

### Simulazione Cassa (cambia)

Attualmente la dashboard somma `importoTotale` delle operazioni nel periodo. Con il nuovo modello:

- **Entrate di cassa** = somma `Pagamento` legati a FATTURA_ATTIVA con `stato = EFFETTUATO` nel periodo
- **Uscite di cassa** = somma `Pagamento` legati a operazioni di costo/cespite con `stato = EFFETTUATO` nel periodo
- **Cassa prevista** = come sopra ma includendo anche `stato = PREVISTO` per i mesi futuri
- **Interessi passivi del periodo** = somma `quotaInteressi` dei Pagamento EFFETTUATI nel periodo → mostrati come voce separata nei KPI

### Nuovo KPI: "Rate in scadenza"

Conta e somma i `Pagamento` con `stato = PREVISTO` e `data` nel mese corrente. Serve come promemoria: "Hai 3 rate in scadenza questo mese per €1.250".

### Trend mensile (cambia)

Il grafico trend attualmente mostra fatturato e costi per mese per competenza. Si aggiunge una seconda serie **"Flusso di cassa"** che mostra entrate/uscite effettive per mese basate sui Pagamenti. Questo dà la visione duale: competenza vs cassa.

---

## Sezione 3 — UI Form Operazione e Gestione Pagamenti

### Form creazione/modifica Operazione

Aggiunta di una sezione "Modalità di pagamento" dopo i campi esistenti.

**Step 1 — Selettore modalità** (radio buttons):
- **Pagamento immediato** (default) — nessun campo aggiuntivo
- **Pagamento rateale** — apre i campi finanziamento
- **Pagamento personalizzato** — apre editor libero

**Step 2a — Se RATEALE:**
- Anticipo (€, opzionale, default 0)
- Numero rate
- TAN % (default 0)
- Data prima rata
- Preview piano generato automaticamente: tabella con N righe (numero, data, quota capitale, quota interessi, totale rata). Ammortamento francese se TAN > 0, divisione lineare altrimenti.

**Step 2b — Se CUSTOM:**
- Lista editabile di pagamenti: per ciascuno → data, importo, note
- Bottone "+ Aggiungi pagamento"
- Indicatore "Importo coperto: €X / €Y" con barra di progresso
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
- Somma `quotaInteressi` di tutti i `Pagamento` dell'anno (per competenza: usa `data`, non `dataEffettivaPagamento`)
- Per veicoli: applica stessa % deducibilità del veicolo (Art. 164 TUIR)
- Per altri cespiti/operazioni: deducibilità 100% (soggetti a Art. 96 TUIR limite ROL)
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
3. Inserisce eventuale importo di estinzione (penale/saldo residuo)
4. Conferma → Pagamenti PREVISTI diventano ANNULLATI, piano passa a CHIUSO_ANTICIPATAMENTE

### Permuta

Combinazione di due azioni normali:
1. **Cessione veicolo vecchio** (già esistente via `CessioneVeicolo`) → chiude il piano pagamenti
2. **Nuovo acquisto** (nuova operazione CESPITE) → con il suo piano pagamenti, anticipo che tiene conto del valore di permuta

Nessun collegamento formale tra le due operazioni.

### Impatto fiscale della chiusura

- Interessi già maturati (Pagamenti EFFETTUATI) restano deducibili
- Penale di estinzione anticipata è costo deducibile (onere finanziario)
- Ammortamento: se bene resta in uso prosegue; se ceduto (permuta) si ferma e si calcola plus/minusvalenza come già previsto
