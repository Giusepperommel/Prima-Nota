# Riferimenti Normativi — Dichiarazioni Fiscali

> Questo file documenta codici tributo F24, struttura CU, scadenze dichiarazioni e riferimenti di legge
> per il modulo Dichiarazioni Fiscali.
>
> Ultimo aggiornamento: 2026-03-24

---

## 1. Modello F24 — Codici Tributo Principali

### Sezione Erario — Imposte dirette e IVA

| Codice | Descrizione | Periodicita | Scadenza |
|--------|-------------|-------------|----------|
| 2001 | IRES — Acconto prima rata | Annuale | 30 giugno (+ 30 gg con 0,40%) |
| 2002 | IRES — Acconto seconda rata | Annuale | 30 novembre |
| 2003 | IRES — Saldo | Annuale | 30 giugno (+ 30 gg con 0,40%) |
| 3800 | IRAP — Acconto prima rata | Annuale | 30 giugno |
| 3801 | IRAP — Acconto seconda rata | Annuale | 30 novembre |
| 3800 | IRAP — Saldo | Annuale | 30 giugno |
| 6001-6012 | IVA mensile (gen-dic) | Mensile | 16 mese successivo |
| 6031 | IVA I trimestre | Trimestrale | 16 maggio |
| 6032 | IVA II trimestre | Trimestrale | 20 agosto (16+4 gg) |
| 6033 | IVA III trimestre | Trimestrale | 16 novembre |
| 6099 | IVA annuale (saldo) | Annuale | 16 marzo |
| 6013 | Acconto IVA | Annuale | 27 dicembre |
| 1040 | Ritenute lavoro autonomo/occasionale | Mensile | 16 mese successivo |
| 1038 | Ritenute su provvigioni | Mensile | 16 mese successivo |
| 1041 | Ritenute diritti d'autore | Mensile | 16 mese successivo |
| 2501 | Bollo libro giornale | Annuale | 30 aprile |
| 7085 | Tassa CC.GG. libri sociali | Annuale | 16 marzo |
| 2524 | Bollo fatture elettroniche I trim | Trimestrale | 31 maggio |
| 2525 | Bollo fatture elettroniche II trim | Trimestrale | 30 settembre |
| 2526 | Bollo fatture elettroniche III trim | Trimestrale | 30 novembre |
| 2527 | Bollo fatture elettroniche IV trim | Trimestrale | 28 febbraio |

### Sezione INPS

| Codice | Descrizione | Periodicita |
|--------|-------------|-------------|
| DM10 | Contributi dipendenti | Mensile |
| AF | Artigiani — rate fisse | Trimestrale (16/5, 20/8, 16/11, 16/2) |
| CF | Commercianti — rate fisse | Trimestrale |

### Sezione Regioni/Enti Locali

| Codice | Descrizione |
|--------|-------------|
| 3843 | Addizionale regionale IRPEF |
| 3844 | Addizionale comunale IRPEF — acconto |
| 3845 | Addizionale comunale IRPEF — saldo |

---

## 2. Certificazione Unica (CU)

### Struttura dati CU lavoro autonomo

| Campo | Descrizione |
|-------|-------------|
| Dati anagrafici percipiente | CF, cognome/nome o denominazione, indirizzo |
| Causale | A (lavoro autonomo), C (provvigioni), M (occasionale), L (diritti autore) |
| Ammontare lordo corrisposto | Totale compensi lordi nell'anno |
| Somme non soggette a ritenuta | Eventuali importi esenti |
| Imponibile | Base su cui calcolare la ritenuta |
| Ritenute a titolo d'acconto | Totale ritenute operate |
| Ritenute a titolo d'imposta | Se applicabile |
| Addizionale regionale | Se applicabile |
| Addizionale comunale | Se applicabile |
| Contributi previdenziali | INPS gestione separata, Cassa previdenza |

### Causali CU per tipo ritenuta

| TipoRitenuta | Causale CU |
|--------------|------------|
| LAVORO_AUTONOMO | A |
| PROVVIGIONI | C |
| OCCASIONALE | M |
| DIRITTI_AUTORE | L |

### Scadenze CU

| Adempimento | Scadenza | Fonte |
|-------------|----------|-------|
| Invio CU all'Agenzia delle Entrate | **16 marzo** | Art. 4 co. 6-quater DPR 322/98 |
| Consegna CU al percipiente | **16 marzo** | Idem |
| CU redditi esenti o non dichiarabili | **31 ottobre** | Idem |

---

## 3. Modello 770

### Struttura

Il modello 770 aggrega i dati delle CU e contiene:
- Quadro ST: ritenute operate e versate
- Quadro SV: trattenute addizionali comunali
- Quadro SX: riepilogo compensazioni
- Quadro SY: somme liquidate da procedure esecutive

### Scadenze

| Adempimento | Scadenza | Fonte |
|-------------|----------|-------|
| Invio telematico modello 770 | **31 ottobre** | Art. 4 DPR 322/98 |

---

## 4. Modello Redditi SC (Societa di Capitali)

### Quadri principali

| Quadro | Contenuto |
|--------|-----------|
| RF | Reddito d'impresa — variazioni in aumento/diminuzione |
| RN | Determinazione IRES |
| IS | Prospetti vari (ACE, perdite, ecc.) |
| RS | Prospetti comuni |
| RV | Riconciliazione civilistico/fiscale |

### Scadenze

| Adempimento | Scadenza |
|-------------|----------|
| Invio telematico Redditi SC | **30 novembre** (9 mesi da chiusura esercizio + ultimo giorno mese) |
| Versamento saldo IRES | **30 giugno** (6 mesi da chiusura esercizio) |
| Versamento I acconto IRES | **30 giugno** (40% dell'acconto totale) |
| Versamento II acconto IRES | **30 novembre** (60% dell'acconto totale) |

### Calcolo IRES — Acconti

| Metodo | Calcolo |
|--------|---------|
| Storico | 100% dell'imposta dell'anno precedente |
| Previsionale | 100% dell'imposta stimata per l'anno corrente |
| Prima rata | 40% dell'acconto totale |
| Seconda rata | 60% dell'acconto totale |

---

## 5. IRAP

### Metodo di calcolo per SRL

Base imponibile = valore della produzione netta (A-B di CE, con rettifiche):
- (+) Costi del personale (parzialmente indeducibili)
- (-) Deduzioni per cuneo fiscale
- (-) Deduzione IRAP da IRES (10% IRAP pagata)

### Scadenze

| Adempimento | Scadenza |
|-------------|----------|
| Dichiarazione IRAP | **30 novembre** |
| Saldo IRAP | **30 giugno** |
| I acconto IRAP | **30 giugno** (40%) |
| II acconto IRAP | **30 novembre** (60%) |

---

## 6. Compensazione F24

### Regole

| Parametro | Valore | Fonte |
|-----------|--------|-------|
| Limite annuo compensazione orizzontale | **2.000.000 EUR** | Art. 34 L. 388/2000 |
| Credito IVA compensabile liberamente | Fino a **5.000 EUR** | Art. 17 D.Lgs. 241/97 |
| Credito IVA > 5.000 EUR | Richiede **visto di conformita** | Art. 10 DL 78/2009 |
| Credito IVA compensabile da | **1 gennaio anno successivo** (fino a 5.000) o **10 giorno dopo invio dichiarazione IVA** (oltre 5.000) | |
| Divieto compensazione | Se debiti iscritti a ruolo > 1.500 EUR | Art. 31 DL 78/2010 |

### Ordine di compensazione (prassi)

1. Compensazione verticale (stesso tributo, es. credito IVA vs debito IVA)
2. Compensazione orizzontale (tributi diversi, es. credito IVA vs IRES)

---

## 7. Scadenziario Fiscale Annuale (SRL — esercizio solare)

| Scadenza | Adempimento |
|----------|-------------|
| 16 ogni mese | Versamento ritenute mese precedente |
| 16 ogni mese | Versamento IVA mese precedente (mensili) |
| 28 febbraio | Bollo fatture elettroniche IV trim anno prec. |
| 16 marzo | Tassa CC.GG. libri sociali |
| 16 marzo | CU — invio e consegna |
| 16 marzo | Saldo IVA annuale |
| 30 aprile | Bollo libro giornale |
| 31 maggio | Bollo fatture elettroniche I trim |
| 30 giugno | Saldo IRES + I acconto |
| 30 giugno | Saldo IRAP + I acconto |
| 30 settembre | Bollo fatture elettroniche II trim |
| 31 ottobre | Modello 770 |
| 30 novembre | II acconto IRES |
| 30 novembre | II acconto IRAP |
| 30 novembre | Modello Redditi SC |
| 30 novembre | Dichiarazione IRAP |
| 30 novembre | Bollo fatture elettroniche III trim |
| 27 dicembre | Acconto IVA |

---

## Changelog

| Data | Modifica | Motivo |
|------|----------|--------|
| 2026-03-24 | Creazione documento | Avvio modulo Dichiarazioni Fiscali |
