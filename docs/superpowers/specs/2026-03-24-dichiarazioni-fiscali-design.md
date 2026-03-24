# Dichiarazioni Fiscali — Design Document

**Data:** 2026-03-24
**Modulo:** Sub-project 6 — Dichiarazioni Fiscali

---

## 1. Obiettivo

Fornire un sistema per:
- Generare e tracciare versamenti F24 (ritenute, IVA, IRES, IRAP, bollo)
- Generare Certificazioni Uniche (CU) dai dati ritenute
- Aggregare dati per Modello 770
- Produrre riepilogo Redditi SC e IRAP
- Mostrare dashboard scadenze fiscali

**NON** in scope: generazione file telematici ministeriali (formati complessi, cambiano ogni anno).
Si producono dati strutturati esportabili per software fiscali dedicati.

---

## 2. Architettura

### 2.1 Schema DB

```
F24Versamento (1) --< F24Riga (N)     — ogni F24 ha piu righe (codici tributo)
CertificazioneUnica                     — per percipiente per anno
DichiarazioneFiscale                    — tracking stato dichiarazioni annuali
```

### 2.2 Engine Layer (`src/lib/dichiarazioni/`)

```
f24/
  calcola-f24.ts        — costruisce F24 da imposte dovute
  compensazione.ts      — logica compensazione crediti
  f24-types.ts          — tipi e costanti
cu/
  genera-cu.ts          — aggrega ritenute per percipiente/anno
  cu-types.ts           — tipi CU
redditi/
  calcola-redditi.ts    — riepilogo Redditi SC + IRAP da bilancio
```

### 2.3 API Layer

```
/api/dichiarazioni/f24/genera    POST — genera F24 per periodo
/api/dichiarazioni/f24           GET  — lista F24
/api/dichiarazioni/f24/[id]/paga PATCH — segna come pagato
/api/dichiarazioni/cu/genera     POST — genera CU per anno
/api/dichiarazioni/cu            GET  — lista CU
/api/dichiarazioni/riepilogo     GET  — dashboard data
```

### 2.4 UI

Pagina `/dichiarazioni` con tab/sezioni:
- Scadenziario fiscale con prossime scadenze
- F24: lista versamenti, genera nuovo, segna pagato
- CU: lista per percipiente, genera, esporta
- Redditi/IRAP: riepilogo calcolo imposte

---

## 3. Modello dati

### F24Versamento
- societaId, anno, mese, dataScadenza, dataPagamento
- stato (DA_PAGARE, PAGATO, SCADUTO)
- totaleDebito, totaleCredito, totaleVersamento
- note

### F24Riga
- f24VersamentoId
- sezione (ERARIO, INPS, REGIONI_ENTI_LOCALI)
- codiceTributo, rateazione, annoRiferimento, periodoRiferimento
- importoDebito, importoCredito
- descrizione

### CertificazioneUnica
- societaId, anno, anagraficaId (percipiente)
- causaleCu (A, C, M, L)
- ammontareLordo, imponibile, ritenutaAcconto
- rivalsaInps, cassaPrevidenza
- stato (BOZZA, GENERATA, INVIATA)
- dataGenerazione, dataInvio

### DichiarazioneFiscale
- societaId, anno, tipo (REDDITI_SC, IRAP, 770)
- stato (NON_INIZIATA, IN_PREPARAZIONE, GENERATA, INVIATA)
- datiCalcolo (JSON con riepilogo numeri)
- dataGenerazione, dataInvio
- note

---

## 4. Logica F24

### Generazione
1. Raccogliere ritenute DA_VERSARE per il mese selezionato
2. Raccogliere IVA da liquidazione del periodo
3. Calcolare acconti/saldi IRES e IRAP se applicabile
4. Applicare compensazione crediti se richiesto
5. Creare F24Versamento con righe

### Compensazione
- Verificare crediti disponibili (IVA annuale, eccedenze IRES/IRAP)
- Rispettare limite 2M EUR annuo
- Credito IVA > 5.000 richiede flag vistoConformita
- Scalare credito utilizzato dalle righe F24

---

## 5. Logica CU

1. Query ritenute per societaId + anno, raggruppate per anagraficaId
2. Per ogni percipiente: sommare importoLordo, baseImponibile, importoRitenuta
3. Mappare tipoRitenuta -> causaleCU
4. Generare record CertificazioneUnica

---

## 6. Logica Redditi/IRAP

Usa `stimaFiscaleSocieta` da tax-utils.ts con dati bilancio:
- fatturato da CE ricavi
- costi da CE costi
- aliquotaIrap da Societa
- soci da tabella Soci

Produce riepilogo con: utile, IRES, IRAP, acconti dovuti, saldo.

---

## 7. Sicurezza

- Tutte le API protette da auth session
- societaId filtrato dalla session dell'utente
- Solo modalita avanzata vede la pagina
