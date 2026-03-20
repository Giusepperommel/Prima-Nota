# Knowledge Base — Bilancio Provvisorio Conforme alla Normativa Italiana

> Documento di riferimento per l'evoluzione dell'applicazione Prima Nota verso la generazione
> di un bilancio d'esercizio provvisorio conforme al Codice Civile e alla normativa fiscale italiana.

---

## Roadmap Moduli Bilancio

Ogni modulo richiede una **ricerca approfondita sulle best practice contabili** prima dell'implementazione. La ricerca va condotta e documentata in questo file nella sezione corrispondente.

### Fase 1 — Modalità Avanzata Base (spec: 2026-03-19)
Target: SRL di servizi senza dipendenti e senza magazzino.

| Modulo | Stato | Note |
|--------|-------|------|
| Toggle Modalità Avanzata (sidebar footer) | ⬜ Da fare | Switch persistito su DB per utente |
| Toggle Modalità Commercialista (impostazioni account) | ⬜ Da fare | Sblocca piano dei conti editabile e partita doppia |
| Tab "Dati Contabili" nella form operazione | ⬜ Da fare | Fornitore, competenza, stato pagamento, ritenuta, conto, natura IVA |
| Anagrafica Fornitori & Clienti | ⬜ Da fare | Auto-popolata da XML/OCR, tipo soggetto, regime forfettario |
| Piano dei Conti (pre-configurato + override) | ⬜ Da fare | Standard italiano, modificabile in modalità commercialista |
| Registri IVA | ⬜ Da fare | Vendite, Acquisti, Corrispettivi |
| Ritenute d'acconto + scadenziario F24 | ⬜ Da fare | Auto-rilevamento da XML/OCR |
| Ratei e Risconti (calcolo automatico a chiusura) | ⬜ Da fare | Workflow chiusura esercizio |
| Apertura esercizio & Saldi bancari | ⬜ Da fare | Inserimento manuale saldi iniziali, riserve, utili a nuovo |
| Sezione Bilancio hub (dashboard avanzamento + bilancio provvisorio) | ⬜ Da fare | Due tab: Avanzamento e Bilancio Provvisorio |

### Fase 2 — Modulo Personale
Target: Attività con dipendenti (qualsiasi tipo di SRL).

> **Richiede ricerca approfondita** su: cedolini paga, INPS (contributi datore e dipendente), INAIL, TFR (calcolo annuale, rivalutazione, destinazione a fondo pensione), CUD/CU dipendenti, F24 mensile personale, gestione permessi/ferie/malattia ai fini contabili, 770 semplificato.

| Modulo | Stato | Note |
|--------|-------|------|
| Anagrafica dipendenti | ⬜ Da fare | CF, data assunzione, qualifica, RAL, livello CCNL |
| Inserimento cedolino mensile | ⬜ Da fare | Lordo, trattenute IRPEF, INPS dipendente, netto |
| Calcolo oneri INPS/INAIL datore | ⬜ Da fare | Mappatura automatica a B.9.b |
| Fondo TFR | ⬜ Da fare | Accantonamento annuale, rivalutazione ISTAT, destinazione |
| Scadenziario F24 personale | ⬜ Da fare | Versamenti mensili IRPEF ritenute + INPS |
| Certificazione Unica dipendenti | ⬜ Da fare | Generazione CU annuale |

### Fase 3 — Modulo Magazzino / Rimanenze
Target: Attività che vendono prodotti fisici (commercio, produzione, ristorazione).

> **Richiede ricerca approfondita** su: metodi di valutazione delle rimanenze (LIFO, FIFO, costo medio ponderato), OIC 13 (rimanenze di magazzino), rimanenze di prodotti finiti vs materie prime vs semilavorati, inventario fisico vs contabile, svalutazione rimanenze, lavori in corso su ordinazione (OIC 23).

| Modulo | Stato | Note |
|--------|-------|------|
| Anagrafica articoli/prodotti | ⬜ Da fare | Codice, descrizione, unità misura, costo standard |
| Inventario iniziale | ⬜ Da fare | Valorizzazione a inizio esercizio |
| Movimenti di magazzino | ⬜ Da fare | Carichi (acquisti), scarichi (vendite/consumo) |
| Metodo di valorizzazione | ⬜ Da fare | FIFO / Costo medio ponderato (LIFO vietato dal 2008) |
| Calcolo variazione rimanenze | ⬜ Da fare | A.2 CE (prodotti finiti) e B.11 CE (materie prime) |
| Inventario di chiusura | ⬜ Da fare | Valorizzazione a fine esercizio, svalutazioni |
| Lavori in corso su ordinazione | ⬜ Da fare | A.3 CE — per attività con contratti pluriennali |

### Fase 4 — Moduli Avanzati (futuro)
| Modulo | Stato | Note |
|--------|-------|------|
| Partecipazioni e immobilizzazioni finanziarie | ⬜ Da fare | B.III SP — per holding e società con partecipazioni |
| Oneri/proventi finanziari | ⬜ Da fare | C.15-C.17 CE — interessi, dividendi ricevuti |
| Fondi rischi e oneri | ⬜ Da fare | B passivo SP — accantonamenti per contenziosi, garanzie |
| Strumenti finanziari derivati | ⬜ Da fare | D.18/D.19 CE — per chi usa hedging |
| Export XBRL | ⬜ Da fare | Formato ufficiale deposito Camera di Commercio |
| Generazione Nota Integrativa | ⬜ Da fare | Template automatico con dati estratti dall'app |
| Relazione sulla Gestione | ⬜ Da fare | Template per bilancio ordinario |

---

## Indice

1. [Stato Attuale dell'Applicazione](#1-stato-attuale-dellapplicazione)
2. [Struttura del Bilancio Italiano](#2-struttura-del-bilancio-italiano)
3. [Piano dei Conti](#3-piano-dei-conti)
4. [Conto Economico (Art. 2425 C.C.)](#4-conto-economico-art-2425-cc)
5. [Stato Patrimoniale (Art. 2424 C.C.)](#5-stato-patrimoniale-art-2424-cc)
6. [Ammortamento dei Cespiti](#6-ammortamento-dei-cespiti)
7. [IVA — Dati Necessari per Transazione](#7-iva--dati-necessari-per-transazione)
8. [Competenza vs Cassa](#8-competenza-vs-cassa)
9. [Ratei e Risconti](#9-ratei-e-risconti)
10. [Bilancio Abbreviato e Micro-imprese](#10-bilancio-abbreviato-e-micro-imprese)
11. [Ritenute d'Acconto](#11-ritenute-dacconto)
12. [Documenti Giustificativi](#12-documenti-giustificativi)
13. [Registri IVA Obbligatori](#13-registri-iva-obbligatori)
14. [Gap Analysis — Cosa Manca](#14-gap-analysis--cosa-manca)
15. [Liquidazione IVA Periodica — Regole 2025](#15-liquidazione-iva-periodica--regole-2025)
16. [Ritenute d'Acconto — Regole 2025](#16-ritenute-dacconto--regole-2025)
17. [Anagrafica Fornitori e Clienti — Dati Obbligatori](#17-anagrafica-fornitori-e-clienti--dati-obbligatori)

---

## 1. Stato Attuale dell'Applicazione

### Modelli Dati Esistenti

| Modello | Descrizione | Campi Chiave |
|---------|-------------|-------------|
| **Societa** | Anagrafica azienda | ragioneSociale, partitaIva, codiceFiscale, tipoAttivita, regimeFiscale, aliquotaIrap, capitaleSociale |
| **Socio** | Soci/associati | nome, cognome, codiceFiscale, quotaPercentuale, ruolo, socioLavoratore |
| **Operazione** | Transazione (costo, fattura, cespite, pagamento imposte, dividendi, compenso amm.) | dataOperazione, importoTotale, aliquotaIva, importoImponibile, importoIva, percentualeDetraibilitaIva, ivaDetraibile, ivaIndetraibile, percentualeDeducibilita, importoDeducibile, tipoOperazione, sottotipoOperazione |
| **CategoriaSpesa** | Categorie di spesa con trattamento fiscale | percentualeDeducibilita, aliquotaIvaDefault, percentualeDetraibilitaIva, haOpzioniUso, opzioniUso |
| **Cespite** | Registro cespiti | valoreIniziale, aliquotaAmmortamento, dataAcquisto, annoInizio, fondoAmmortamento, stato |
| **QuotaAmmortamento** | Quote annuali ammortamento | anno, aliquotaApplicata, importoQuota, fondoProgressivo |
| **Veicolo** | Dettagli veicoli | tipoVeicolo, usoVeicolo, limiteFiscale, percentualeDeducibilita, percentualeDetraibilitaIva |
| **Finanziamento** | Finanziamenti veicoli | importoFinanziato, anticipo, numeroRate, importoRata, tan |
| **CessioneVeicolo** | Dismissione veicoli | prezzoVendita, valoreResiduoContabile, plusvalenza, minusvalenza |
| **OperazioneRicorrente** | Template operazioni ricorrenti | frequenza, importi, categoria, ripartizione |
| **RipartizioneOperazione** | Ripartizione tra soci | percentuale, importoCalcolato |

### Cosa Cattura Già Bene

- **IVA per transazione**: aliquota, imponibile, imposta, detraibilità/indetraibilità
- **Deducibilità fiscale**: percentuale e importo deducibile per operazione
- **Ammortamento cespiti**: piano completo con regola del 50% primo anno (Art. 102 TUIR)
- **Veicoli**: limiti fiscali Art. 164 TUIR, deducibilità per tipo uso, finanziamenti
- **Tipi operazione**: FATTURA_ATTIVA, COSTO, CESPITE, PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE
- **Costanti fiscali**: IRES 24%, IRAP 3.9%, IRPEF a scaglioni, INPS commercianti, ritenuta dividendi 26%
- **Categorie intelligenti**: 30+ categorie con regole fiscali specifiche per tipo attività e regime

### Cosa NON Cattura Ancora

Vedi [§14 Gap Analysis](#14-gap-analysis--cosa-manca) per il dettaglio completo.

---

## 2. Struttura del Bilancio Italiano

Il bilancio d'esercizio è disciplinato dagli articoli 2423-2435-ter del Codice Civile.

### Principio Fondamentale (Art. 2423)

Il bilancio deve essere redatto con **chiarezza** e deve rappresentare in modo **veritiero e corretto** la situazione patrimoniale e finanziaria della società e il risultato economico dell'esercizio.

### Documenti Obbligatori

| Documento | Articolo | Contenuto |
|-----------|----------|-----------|
| **Stato Patrimoniale** | Art. 2424 | Fotografia della situazione patrimoniale a una data (attività, passività, patrimonio netto) |
| **Conto Economico** | Art. 2425 | Formazione del risultato d'esercizio (ricavi - costi = utile/perdita) |
| **Rendiconto Finanziario** | Art. 2425-ter | Flussi di cassa del periodo (operativa, investimenti, finanziamenti) |
| **Nota Integrativa** | Art. 2427 | Note esplicative su criteri di valutazione, movimentazioni, dettagli |

### Tre Formati in Base alla Dimensione

| Formato | Totale Attivo | Ricavi | Dipendenti | RF obbligatorio | NI obbligatoria |
|---------|--------------|--------|------------|-----------------|-----------------|
| **Ordinario** | > 5.500.000 € | > 11.000.000 € | > 50 | Sì | Sì |
| **Abbreviato** (art. 2435-bis) | ≤ 5.500.000 € | ≤ 11.000.000 € | ≤ 50 | No | Sì (semplificata) |
| **Micro-imprese** (art. 2435-ter) | ≤ 220.000 € | ≤ 440.000 € | ≤ 5 | No | No (se info in calce a SP) |

> Per rientrare nel formato semplificato occorre **non superare 2 dei 3 limiti** nel primo esercizio o per due esercizi consecutivi.

### Dati di Testata Necessari per il Bilancio

```
- ragione_sociale
- partita_iva / codice_fiscale
- sede_legale
- capitale_sociale
- data_inizio_esercizio (inizio anno fiscale)
- data_fine_esercizio (fine anno fiscale)
- formato_bilancio (ordinario / abbreviato / micro)
- data_approvazione_assemblea
- data_deposito_camera_commercio
```

---

## 3. Piano dei Conti

Il Piano dei Conti è la struttura portante della contabilità. Ogni transazione deve essere associata a un conto specifico che si mappa direttamente a una voce del bilancio.

### Struttura Gerarchica

| Livello | Nome | Esempio Codice | Esempio |
|---------|------|---------------|---------|
| 1 | **Gruppo** | 01 | Attività |
| 2 | **Classe/Mastro** | 01.01 | Immobilizzazioni immateriali |
| 3 | **Conto** | 01.01.001 | Costi di impianto e ampliamento |
| 4 | **Sottoconto** | 01.01.001.0001 | Costi costituzione società |

### Gruppi Principali

#### Conti Patrimoniali (Stato Patrimoniale)

**Gruppo 01 — Attività**
- Immobilizzazioni immateriali (brevetti, licenze, avviamento, costi di sviluppo)
- Immobilizzazioni materiali (terreni, fabbricati, impianti, macchinari, attrezzature, mobili, automezzi)
- Immobilizzazioni finanziarie (partecipazioni, crediti a lungo termine)
- Rimanenze (materie prime, semilavorati, prodotti finiti)
- Crediti (verso clienti, tributari, vs. controllate/collegate, altri)
- Attività finanziarie correnti
- Disponibilità liquide (banca, cassa)
- Ratei e risconti attivi

**Gruppo 02 — Passività e Patrimonio Netto**
- Patrimonio netto (capitale, riserve, utili portati a nuovo, utile d'esercizio)
- Fondi rischi e oneri
- TFR (trattamento fine rapporto)
- Debiti (verso fornitori, banche, tributari, previdenziali, soci, altri)
- Ratei e risconti passivi

#### Conti Economici (Conto Economico)

**Gruppo 03 — Costi**
- Acquisti materie prime e merci
- Servizi (consulenze, utenze, manutenzioni, trasporti, assicurazioni)
- Godimento beni di terzi (affitti, leasing, noleggi)
- Personale (stipendi, oneri sociali, TFR)
- Ammortamenti e svalutazioni
- Accantonamenti
- Oneri finanziari (interessi passivi)
- Oneri diversi di gestione
- Imposte sul reddito

**Gruppo 04 — Ricavi**
- Ricavi vendite e prestazioni
- Variazioni rimanenze
- Incrementi immobilizzazioni per lavori interni
- Altri ricavi e proventi
- Proventi finanziari (interessi attivi)

**Gruppo 05 — Conti d'Ordine** (fuori bilancio, impegni e garanzie)

### Campi Necessari per Ogni Conto

```
- codice_conto (codice univoco gerarchico)
- descrizione
- tipo (patrimoniale_attivo / patrimoniale_passivo / economico_costo / economico_ricavo / ordine)
- gruppo / classe / mastro (riferimenti gerarchici)
- voce_bilancio (mapping alla voce di bilancio, es. "B.II.1", "B.7")
- natura_saldo (dare / avere)
- attivo (boolean)
```

---

## 4. Conto Economico (Art. 2425 C.C.)

Schema completo con tutte le voci obbligatorie. Formato scalare (non a sezioni contrapposte).

### A) VALORE DELLA PRODUZIONE

| Voce | Descrizione |
|------|-------------|
| A.1 | Ricavi delle vendite e delle prestazioni |
| A.2 | Variazioni delle rimanenze di prodotti in corso di lavorazione, semilavorati e finiti |
| A.3 | Variazioni dei lavori in corso su ordinazione |
| A.4 | Incrementi di immobilizzazioni per lavori interni |
| A.5 | Altri ricavi e proventi (con separata indicazione dei contributi in conto esercizio) |
| | **Totale A** |

### B) COSTI DELLA PRODUZIONE

| Voce | Descrizione |
|------|-------------|
| B.6 | Per materie prime, sussidiarie, di consumo e di merci |
| B.7 | Per servizi |
| B.8 | Per godimento di beni di terzi |
| B.9 | Per il personale: |
| B.9.a | — Salari e stipendi |
| B.9.b | — Oneri sociali |
| B.9.c | — Trattamento di fine rapporto |
| B.9.d | — Trattamento di quiescenza e simili |
| B.9.e | — Altri costi del personale |
| B.10 | Ammortamenti e svalutazioni: |
| B.10.a | — Ammortamento immobilizzazioni immateriali |
| B.10.b | — Ammortamento immobilizzazioni materiali |
| B.10.c | — Altre svalutazioni delle immobilizzazioni |
| B.10.d | — Svalutazioni dei crediti dell'attivo circolante e delle disponibilità liquide |
| B.11 | Variazioni delle rimanenze di materie prime, sussidiarie, di consumo e merci |
| B.12 | Accantonamenti per rischi |
| B.13 | Altri accantonamenti |
| B.14 | Oneri diversi di gestione |
| | **Totale B** |

### Differenza tra valore e costi della produzione (A − B)

### C) PROVENTI E ONERI FINANZIARI

| Voce | Descrizione |
|------|-------------|
| C.15 | Proventi da partecipazioni (con separata indicazione controllate, collegate, controllanti) |
| C.16 | Altri proventi finanziari: |
| C.16.a | — Da crediti iscritti nelle immobilizzazioni |
| C.16.b | — Da titoli iscritti nelle immobilizzazioni (non partecipazioni) |
| C.16.c | — Da titoli iscritti nell'attivo circolante (non partecipazioni) |
| C.16.d | — Proventi diversi dai precedenti |
| C.17 | Interessi e altri oneri finanziari (con separata indicazione controllate, collegate, controllanti) |
| C.17-bis | Utili e perdite su cambi |
| | **Totale C** (15 + 16 − 17 ± 17-bis) |

### D) RETTIFICHE DI VALORE DI ATTIVITÀ E PASSIVITÀ FINANZIARIE

| Voce | Descrizione |
|------|-------------|
| D.18 | Rivalutazioni: |
| D.18.a | — Di partecipazioni |
| D.18.b | — Di immobilizzazioni finanziarie (non partecipazioni) |
| D.18.c | — Di titoli dell'attivo circolante (non partecipazioni) |
| D.18.d | — Di strumenti finanziari derivati |
| D.19 | Svalutazioni: |
| D.19.a | — Di partecipazioni |
| D.19.b | — Di immobilizzazioni finanziarie (non partecipazioni) |
| D.19.c | — Di titoli dell'attivo circolante (non partecipazioni) |
| D.19.d | — Di strumenti finanziari derivati |
| | **Totale D** (18 − 19) |

### Risultato prima delle imposte (A − B ± C ± D)

| Voce | Descrizione |
|------|-------------|
| 20 | Imposte sul reddito dell'esercizio, correnti, differite e anticipate |
| **21** | **Utile (perdita) dell'esercizio** |

---

## 5. Stato Patrimoniale (Art. 2424 C.C.)

### ATTIVO

#### A) Crediti verso soci per versamenti ancora dovuti
Con separata indicazione della parte già richiamata.

#### B) Immobilizzazioni

**B.I — Immobilizzazioni immateriali**

| Voce | Descrizione |
|------|-------------|
| B.I.1 | Costi di impianto e di ampliamento |
| B.I.2 | Costi di sviluppo |
| B.I.3 | Diritti di brevetto industriale e diritti di utilizzazione delle opere dell'ingegno |
| B.I.4 | Concessioni, licenze, marchi e diritti simili |
| B.I.5 | Avviamento |
| B.I.6 | Immobilizzazioni in corso e acconti |
| B.I.7 | Altre |

**B.II — Immobilizzazioni materiali**

| Voce | Descrizione |
|------|-------------|
| B.II.1 | Terreni e fabbricati |
| B.II.2 | Impianti e macchinario |
| B.II.3 | Attrezzature industriali e commerciali |
| B.II.4 | Altri beni (mobili, arredi, automezzi, hardware) |
| B.II.5 | Immobilizzazioni in corso e acconti |

**B.III — Immobilizzazioni finanziarie**

| Voce | Descrizione |
|------|-------------|
| B.III.1 | Partecipazioni in: a) controllate, b) collegate, c) controllanti, d) sotto controllo controllanti, d-bis) altre |
| B.III.2 | Crediti (stessa suddivisione) |
| B.III.3 | Altri titoli |
| B.III.4 | Strumenti finanziari derivati attivi |

#### C) Attivo circolante

**C.I — Rimanenze**

| Voce | Descrizione |
|------|-------------|
| C.I.1 | Materie prime, sussidiarie e di consumo |
| C.I.2 | Prodotti in corso di lavorazione e semilavorati |
| C.I.3 | Lavori in corso su ordinazione |
| C.I.4 | Prodotti finiti e merci |
| C.I.5 | Acconti |

**C.II — Crediti** (con separata indicazione importi esigibili oltre l'esercizio successivo)

| Voce | Descrizione |
|------|-------------|
| C.II.1 | Verso clienti |
| C.II.2 | Verso imprese controllate |
| C.II.3 | Verso imprese collegate |
| C.II.4 | Verso controllanti |
| C.II.5 | Verso imprese sottoposte al controllo delle controllanti |
| C.II.5-bis | Crediti tributari |
| C.II.5-ter | Imposte anticipate |
| C.II.5-quater | Verso altri |

**C.III — Attività finanziarie (non immobilizzazioni)**

| Voce | Descrizione |
|------|-------------|
| C.III.1-4 | Partecipazioni (controllate, collegate, controllanti, altre) |
| C.III.5 | Strumenti finanziari derivati attivi |
| C.III.6 | Altri titoli |

**C.IV — Disponibilità liquide**

| Voce | Descrizione |
|------|-------------|
| C.IV.1 | Depositi bancari e postali |
| C.IV.2 | Assegni |
| C.IV.3 | Denaro e valori in cassa |

#### D) Ratei e risconti attivi
Con separata indicazione del disaggio su prestiti.

---

### PASSIVO

#### A) Patrimonio netto

| Voce | Descrizione |
|------|-------------|
| A.I | Capitale |
| A.II | Riserva da soprapprezzo delle azioni |
| A.III | Riserve di rivalutazione |
| A.IV | Riserva legale |
| A.V | Riserve statutarie |
| A.VI | Altre riserve, distintamente indicate |
| A.VII | Riserva per operazioni di copertura dei flussi finanziari attesi |
| A.VIII | Utili (perdite) portati a nuovo |
| A.IX | Utile (perdita) dell'esercizio |
| A.X | Riserva negativa per azioni proprie in portafoglio |

#### B) Fondi per rischi e oneri

| Voce | Descrizione |
|------|-------------|
| B.1 | Per trattamento di quiescenza e obblighi simili |
| B.2 | Per imposte, anche differite |
| B.3 | Strumenti finanziari derivati passivi |
| B.4 | Altri |

#### C) Trattamento di fine rapporto di lavoro subordinato (TFR)

#### D) Debiti (con separata indicazione importi esigibili oltre l'esercizio successivo)

| Voce | Descrizione |
|------|-------------|
| D.1 | Obbligazioni |
| D.2 | Obbligazioni convertibili |
| D.3 | Debiti verso soci per finanziamenti |
| D.4 | Debiti verso banche |
| D.5 | Debiti verso altri finanziatori |
| D.6 | Acconti |
| D.7 | Debiti verso fornitori |
| D.8 | Debiti rappresentati da titoli di credito |
| D.9 | Debiti verso imprese controllate |
| D.10 | Debiti verso imprese collegate |
| D.11 | Debiti verso controllanti |
| D.11-bis | Debiti verso imprese sottoposte al controllo delle controllanti |
| D.12 | Debiti tributari |
| D.13 | Debiti verso istituti di previdenza e sicurezza sociale |
| D.14 | Altri debiti |

#### E) Ratei e risconti passivi
Con separata indicazione dell'aggio su prestiti.

---

## 6. Ammortamento dei Cespiti

### Normativa di Riferimento

- **Civilistico**: OIC 16 (immobilizzazioni materiali), OIC 24 (immobilizzazioni immateriali) — basato sulla vita utile effettiva stimata
- **Fiscale**: DM 31/12/1988 — aliquote massime deducibili per categoria di bene; Art. 102 TUIR

### Metodo di Calcolo

```
Quota annua = Costo storico × Aliquota %
```

- **Primo anno**: aliquota ridotta al 50% (presunzione di acquisto a metà anno)
- **Anni successivi**: aliquota piena
- **Metodo**: a quote costanti (lineare) — il più diffuso in Italia
- **Beni < 516,46 €**: possono essere interamente spesati nell'anno di acquisto

### Coefficienti di Ammortamento (DM 31/12/1988) — Principali

| Categoria Bene | Aliquota | Vita Utile Implicita |
|----------------|----------|---------------------|
| Fabbricati industriali | 3% | ~33 anni |
| Costruzioni leggere | 10% | 10 anni |
| Impianti generici | 10% | 10 anni |
| Impianti specifici | 12,5% | 8 anni |
| Macchinari | 12,5% | 8 anni |
| Attrezzature | 15% | ~7 anni |
| Mobili e arredi | 12% | ~8 anni |
| Macchine ufficio elettroniche (PC) | 20% | 5 anni |
| Autovetture | 25% | 4 anni |
| Automezzi di trasporto | 20% | 5 anni |
| Telefoni cellulari | 20% | 5 anni |

> Il DM copre 22 gruppi di attività con 170+ classificazioni specifiche.

### Doppio Binario: Ammortamento Civile vs Fiscale

Per un bilancio conforme è necessario gestire il **doppio binario**:

| Aspetto | Civilistico | Fiscale |
|---------|-------------|---------|
| Base normativa | OIC 16/24 | DM 31/12/1988, Art. 102 TUIR |
| Criterio | Vita utile effettiva | Aliquote tabellari massime |
| Finalità | Rappresentazione veritiera | Massima deduzione fiscale |
| Valore residuo | Può essere previsto | Generalmente non previsto |

### Campi Necessari per Ogni Cespite (Integrazione)

```
Già presenti nell'app:
  ✅ descrizione
  ✅ valoreIniziale (costo storico)
  ✅ aliquotaAmmortamento
  ✅ dataAcquisto
  ✅ annoInizio
  ✅ fondoAmmortamento
  ✅ stato (IN_AMMORTAMENTO, COMPLETATO, CEDUTO)
  ✅ quote annuali con fondo progressivo

Da aggiungere per bilancio:
  ❌ categoria_cespite_dm (categoria secondo DM 31/12/1988)
  ❌ gruppo_attivita (gruppo di attività economica del DM)
  ❌ tipo_immobilizzazione (materiale / immateriale)
  ❌ data_entrata_in_funzione (può differire da data acquisto)
  ❌ aliquota_ammortamento_civile (distinta dalla fiscale)
  ❌ aliquota_ammortamento_fiscale
  ❌ valore_residuo (per ammortamento civilistico)
  ❌ vita_utile_anni
  ❌ voce_bilancio_sp (mapping a SP: es. "B.II.4")
  ❌ voce_bilancio_ce (mapping a CE: es. "B.10.b")
  ❌ ubicazione
  ❌ fornitore
  ❌ numero_fattura_acquisto
```

---

## 7. IVA — Dati Necessari per Transazione

### Aliquote IVA Italiane

| Aliquota | Applicazione |
|----------|-------------|
| 22% | Aliquota ordinaria (maggior parte beni e servizi) |
| 10% | Ridotta (alimenti, alberghi, ristoranti, ristrutturazioni) |
| 5% | Super-ridotta (alcuni servizi sociali) |
| 4% | Minima (generi alimentari di base, giornali, prima casa) |
| 0% | Esente / Non imponibile / Escluso (vari regimi) |

### Classificazione delle Operazioni ai Fini IVA

| Tipo | Descrizione | Riferimento |
|------|-------------|-------------|
| **Imponibile** | Soggetta a IVA con aliquota specifica | — |
| **Non imponibile** | Esportazioni, cessioni intra-UE | Art. 8, 8-bis, 9, 72 DPR 633/72 |
| **Esente** | Operazioni mediche, finanziarie, assicurative | Art. 10 DPR 633/72 |
| **Escluso/Fuori campo** | Fuori ambito IVA | Art. 15 DPR 633/72 |
| **Reverse charge** | IVA a carico dell'acquirente | Art. 17 DPR 633/72 |
| **Split payment** | IVA versata direttamente all'erario (PA) | Art. 17-ter DPR 633/72 |

### Campi per Transazione — IVA

```
Già presenti nell'app:
  ✅ aliquotaIva
  ✅ importoImponibile
  ✅ importoIva
  ✅ percentualeDetraibilitaIva
  ✅ ivaDetraibile
  ✅ ivaIndetraibile

Da aggiungere per bilancio/registri:
  ❌ natura_operazione (imponibile / non_imponibile / esente / escluso / reverse_charge / split_payment)
  ❌ riferimento_normativo (riferimento di legge per esenzione, es. "art. 10 n. 1")
  ❌ tipo_documento_sdi (TD01, TD04, TD05, TD16, TD17, TD19, ecc.)
  ❌ data_registrazione (distinta da dataOperazione — rilevante per periodo IVA)
  ❌ protocollo_iva (numero progressivo di registrazione nel registro IVA)
  ❌ registro_iva (vendite / acquisti / corrispettivi)
  ❌ periodo_liquidazione (mese/trimestre di competenza IVA)
```

---

## 8. Competenza vs Cassa

### Definizioni

| Principio | Descrizione | Utilizzo |
|-----------|-------------|----------|
| **Competenza** (accrual) | Ricavi e costi riconosciuti nel periodo in cui sono **maturati**, indipendentemente dal pagamento | Obbligatorio per il bilancio d'esercizio |
| **Cassa** (cash) | Registra solo quando il denaro **effettivamente si muove** | Regime forfettario, contabilità semplificata, professionisti |

### Implicazione Fondamentale

Per ogni transazione l'applicazione deve tracciare **entrambi i momenti**:

1. **Quando avviene il fatto economico** (competenza) → per il bilancio
2. **Quando si muove il denaro** (cassa) → per il cash flow e la riconciliazione bancaria

### Campi Necessari per Supportare la Competenza

```
Da aggiungere:
  ❌ data_competenza_inizio (inizio periodo di competenza economica)
  ❌ data_competenza_fine (fine periodo di competenza economica)
  ❌ data_pagamento (data effettiva del pagamento/incasso)
  ❌ stato_pagamento (pagato / non_pagato / parzialmente_pagato)
  ❌ esercizio_competenza (anno fiscale di appartenenza del costo/ricavo)
  ❌ importo_di_competenza (quota di competenza del periodo corrente)
  ❌ importo_sospeso (quota differita ai periodi futuri)
  ❌ genera_rateo_risconto (boolean: questa operazione genera ratei/risconti?)
```

---

## 9. Ratei e Risconti

### Definizione (Art. 2424-bis, comma 5 C.C.)

> "I ratei e risconti misurano proventi e oneri la cui competenza è anticipata o posticipata rispetto alla manifestazione numeraria e/o documentale; essi prescindono dalla data di pagamento o riscossione dei relativi proventi e oneri, comuni a due o più esercizi e ripartibili in ragione del tempo."

### Quattro Tipologie

| Tipo | Italiano | Descrizione | Posizione in SP |
|------|----------|-------------|-----------------|
| Reddito maturato non ancora incassato | **Rateo Attivo** | Ricavo maturato ma non ancora ricevuto/fatturato | Attivo — D) |
| Costo maturato non ancora pagato | **Rateo Passivo** | Costo sostenuto ma non ancora pagato/fatturato | Passivo — E) |
| Costo pagato di competenza futura | **Risconto Attivo** | Costo pagato ma di competenza di esercizi futuri | Attivo — D) |
| Ricavo incassato di competenza futura | **Risconto Passivo** | Ricavo incassato ma di competenza di esercizi futuri | Passivo — E) |

### Formule di Calcolo

```
Risconto = (Importo totale / Giorni totali contratto) × Giorni di competenza futura

Rateo = (Importo totale / Giorni totali contratto) × Giorni di competenza maturata non pagata
```

### Esempi Pratici

- **Risconto attivo**: Assicurazione pagata il 1° dicembre per 12 mesi → al 31/12, 11/12 è risconto attivo
- **Risconto passivo**: Affitto incassato il 15/12 per il periodo 15/12-14/01 → al 31/12, metà è risconto passivo
- **Rateo attivo**: Interessi attivi maturati nov-gen, incassati a gennaio → al 31/12, 2/3 è rateo attivo
- **Rateo passivo**: Interessi passivi mutuo maturati nov-gen, pagati a gennaio → al 31/12, 2/3 è rateo passivo

### Campi Necessari

```
Da aggiungere (nuovo modello RateoRisconto):
  ❌ tipo (rateo_attivo / rateo_passivo / risconto_attivo / risconto_passivo)
  ❌ descrizione
  ❌ importo_originario
  ❌ data_inizio_competenza
  ❌ data_fine_competenza
  ❌ data_manifestazione_finanziaria
  ❌ importo_rateo_risconto (importo calcolato)
  ❌ esercizio_di_riferimento
  ❌ conto_economico_collegato (quale voce CE impatta)
  ❌ conto_patrimoniale_collegato (dove appare in SP)
  ❌ operazione_collegata_id (FK all'operazione originale)
  ❌ automatico (boolean: calcolato automaticamente o inserito manualmente)
  ❌ stornato (boolean: stornato nell'esercizio successivo)
```

---

## 10. Bilancio Abbreviato e Micro-imprese

### Bilancio Abbreviato (Art. 2435-bis)

**Soglie** (aggiornate D.Lgs. 125/2024): non superare 2 su 3 limiti:
- Totale attivo: ≤ 5.500.000 €
- Ricavi: ≤ 11.000.000 €
- Dipendenti: ≤ 50

**Semplificazioni ammesse:**

| Aspetto | Semplificazione |
|---------|----------------|
| Stato Patrimoniale | Solo voci con lettere e numeri romani (no arabi) |
| Conto Economico | Possibilità di accorpare: A.2+A.3; B.9.c+d+e; B.10.a+b+c; C.16.b+c; D.18.a+b+c+d; D.19.a+b+c+d |
| Rendiconto Finanziario | **Non obbligatorio** |
| Nota Integrativa | Semplificata (meno informazioni richieste) |
| Relazione sulla gestione | Omissibile se info necessarie in nota integrativa |

### Micro-imprese (Art. 2435-ter)

**Soglie** (aggiornate D.Lgs. 125/2024): non superare 2 su 3 limiti:
- Totale attivo: ≤ 220.000 €
- Ricavi: ≤ 440.000 €
- Dipendenti: ≤ 5

**Semplificazioni ammesse:**

| Aspetto | Semplificazione |
|---------|----------------|
| Schema | Usa lo schema abbreviato |
| Rendiconto Finanziario | **Esentate** |
| Nota Integrativa | **Esentate** (se info art. 2427 nn. 9, 16 in calce a SP) |
| Relazione sulla gestione | **Esentate** (se info art. 2428 nn. 3, 4 in calce a SP) |
| Fair value | Non si applicano le regole art. 2423 c. 5 |

> **Attenzione**: società di investimento e holding finanziarie sono ESCLUSE dal regime micro.

> **Reversibilità**: si torna al formato ordinario/abbreviato quando si superano 2 su 3 limiti per **due esercizi consecutivi**.

---

## 11. Ritenute d'Acconto

### Principali Categorie e Aliquote

| Categoria | Aliquota | Base Imponibile | Note |
|-----------|----------|----------------|------|
| Lavoro autonomo abituale | 20% | 100% del compenso | Art. 25 DPR 600/73 |
| Lavoro autonomo occasionale | 20% | 100% del compenso | Stesse regole |
| Provvigioni agenti/rappresentanti | 23% | 50% della provvigione | Art. 25-bis DPR 600/73 |
| Provvigioni (con dipendenti/strutture) | 23% | 20% della provvigione | Condizioni specifiche |
| Cessione diritti d'autore (≥ 35 anni) | 20% | 75% dell'importo | 25% deduzione forfettaria |
| Cessione diritti d'autore (< 35 anni) | 20% | 60% dell'importo | 40% deduzione forfettaria |

### Eccezioni

- **Regime forfettario**: i soggetti forfettari NON applicano e NON subiscono ritenuta d'acconto
- **Rivalsa INPS gestione separata (4%)**: rientra nella base imponibile della ritenuta
- **Cassa previdenza professionale (4%)**: NON rientra nella base imponibile della ritenuta

### Obblighi del Sostituto d'Imposta

1. Trattenere la ritenuta dal pagamento
2. Versare all'erario entro il **16 del mese successivo** via F24 (codice tributo 1040)
3. Rilasciare **Certificazione Unica (CU)** al percipiente entro il 28 febbraio
4. Trasmettere CU telematicamente all'Agenzia delle Entrate entro il 7 marzo
5. Presentare **Modello 770** entro il 31 luglio

### Campi Necessari

```
Da aggiungere (nuovo modello o estensione Operazione):
  ❌ fornitore_id (anagrafica fornitore/percipiente)
  ❌ tipo_reddito (lavoro_autonomo / provvigioni / occasionale / diritti_autore)
  ❌ importo_lordo
  ❌ base_imponibile_ritenuta
  ❌ aliquota_ritenuta (20% o 23%)
  ❌ percentuale_imponibile (100%, 75%, 60%, 50%, 20%)
  ❌ importo_ritenuta
  ❌ importo_netto (netto pagato)
  ❌ data_pagamento
  ❌ data_versamento_ritenuta (data versamento F24)
  ❌ codice_tributo (es. "1040")
  ❌ periodo_riferimento (mese/anno)
  ❌ regime_forfettario_fornitore (boolean)
  ❌ rivalsa_inps (importo rivalsa INPS 4%)
  ❌ cassa_previdenza (importo contributo cassa professionale)
  ❌ cu_emessa (boolean)
  ❌ cu_data_emissione
```

---

## 12. Documenti Giustificativi

### Tipologie di Documenti

| Tipo Documento | Italiano | Utilizzo | Dati Chiave |
|----------------|----------|----------|-------------|
| Fattura vendita | Fattura di vendita | Transazioni B2B, B2C su richiesta | Tutti i campi obbligatori fattura |
| Fattura acquisto | Fattura di acquisto | Documentazione acquisti | Idem |
| Nota di credito | Nota di credito | Rettifica in diminuzione | Riferimento fattura originale |
| Nota di debito | Nota di debito | Rettifica in aumento | Riferimento fattura originale |
| Autofattura | Autofattura | Reverse charge, acquisti intra-UE, acquisti esteri | Doppia registrazione (vendite + acquisti) |
| Documento commerciale | ex Scontrino/Ricevuta | Vendite al dettaglio B2C | Totali giornalieri, ripartizione IVA |
| Estratto conto | Estratto conto bancario | Prova transazioni bancarie | Data, importo, descrizione |
| Quietanza | Quietanza di pagamento | Prova di pagamento | Importo, data, parti |
| Nota spese | Nota spese | Rimborso spese dipendenti | Ricevute individuali allegate |
| Contratto | Contratto | Servizi ricorrenti, affitti | Termini, importi, durata |
| Busta paga | Cedolino | Compensi dipendenti | Lordo, trattenute, netto |
| F24 | Modello F24 | Versamenti imposte | Codici tributo, importi, periodi |

### Campi Obbligatori Fattura Elettronica (SDI)

```
- numero_fattura (progressivo)
- data_emissione
- data_operazione (se diversa da emissione)
- cedente_prestatore (denominazione, indirizzo, P.IVA, CF)
- cessionario_committente (denominazione, indirizzo, P.IVA/CF)
- descrizione_beni_servizi
- quantita
- prezzo_unitario
- imponibile
- aliquota_iva
- imposta
- totale_fattura
- tipo_documento_sdi (TD01, TD02, TD04, TD05, TD06, TD16-TD28)
- modalita_pagamento
- condizioni_pagamento
- codice_destinatario / PEC
- ritenuta_acconto (se applicabile: tipo, aliquota, importo)
- bollo_virtuale (2 € per importi > 77,47 € su operazioni esenti)
```

### Conservazione Documenti

- **Civilistico**: minimo **10 anni** (Art. 2220 C.C.)
- **Fiscale**: minimo **5 anni** dopo la presentazione della dichiarazione (o 7 anni se non presentata)
- **Conservazione sostitutiva** (digitale): accettata e preferita

---

## 13. Registri IVA Obbligatori

Disciplinati dal DPR 633/1972, artt. 23, 24, 25.

### Registro Fatture Emesse (Art. 23)

Registra tutte le fatture emesse per cessioni di beni e prestazioni di servizi.

| Campo | Descrizione |
|-------|-------------|
| numero_progressivo | Numero progressivo di registrazione |
| data_fattura | Data della fattura |
| numero_fattura | Numero della fattura |
| dati_cliente | Nome/ragione sociale, P.IVA/CF |
| imponibile | Base imponibile (separata per aliquota) |
| aliquota_iva | Aliquota applicata |
| imposta | Importo IVA (separato per aliquota) |
| natura_operazione | Per non imponibili: tipo esenzione e riferimento normativo |
| totale_fattura | Totale documento |

**Termine registrazione**: entro il 15 del mese successivo alla data dell'operazione.

### Registro Acquisti (Art. 25)

Registra tutte le fatture di acquisto e documenti doganali.

| Campo | Descrizione |
|-------|-------------|
| numero_protocollo | Numero protocollo assegnato dall'acquirente (progressivo) |
| data_fattura | Data della fattura |
| data_registrazione | Data di registrazione |
| dati_fornitore | Nome/ragione sociale, P.IVA |
| imponibile | Base imponibile (per aliquota) |
| aliquota_iva | Aliquota IVA |
| imposta | Importo IVA (per aliquota) |
| iva_detraibile | IVA detraibile |
| iva_indetraibile | IVA indetraibile |
| natura_operazione | Per esenti: giustificazione e riferimento normativo |

**Termine registrazione**: prima della liquidazione periodica IVA in cui si esercita il diritto alla detrazione.

### Registro Corrispettivi (Art. 24)

Per commercianti al minuto e attività simili. Registra i totali giornalieri.

| Campo | Descrizione |
|-------|-------------|
| data | Data |
| totale_giornaliero_lordo | Totale giornaliero IVA inclusa |
| corrispettivi_per_aliquota | Totali suddivisi per aliquota (4%, 5%, 10%, 22%) |
| operazioni_esenti | Totale operazioni esenti |
| operazioni_non_imponibili | Totale operazioni non imponibili |

> Dal 1° gennaio 2020, i corrispettivi telematici hanno largamente sostituito il registro fisico.

### Dati per Liquidazione Periodica IVA

```
- iva_a_debito (IVA sulle vendite del periodo)
- iva_a_credito (IVA detraibile sugli acquisti del periodo)
- iva_dovuta o iva_a_credito_periodo (saldo netto)
- credito_periodo_precedente (credito riportato)
- versamento_effettuato (pagamento via F24)
- periodo (mensile o trimestrale)
- acconto_iva_dicembre (acconto IVA di dicembre)
```

---

## 14. Gap Analysis — Cosa Manca

### Legenda
- ✅ = Già presente e funzionante
- ⚠️ = Parzialmente presente, necessita estensione
- ❌ = Completamente assente

---

### A) Struttura Contabile Fondamentale

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Piano dei Conti | ❌ | **CRITICA** | Senza un piano dei conti strutturato non è possibile costruire un bilancio. Ogni operazione deve essere associata a uno o più conti che si mappano alle voci di SP e CE |
| Partita doppia | ❌ | **CRITICA** | Attualmente l'app registra movimenti singoli. Per il bilancio serve la registrazione in partita doppia (dare/avere) |
| Periodo di competenza | ❌ | **ALTA** | Mancano data_competenza_inizio/fine e stato_pagamento |
| Esercizio fiscale | ⚠️ | **ALTA** | C'è dataOperazione ma manca la definizione formale dell'esercizio e il collegamento |

### B) Anagrafica e Terze Parti

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Anagrafica fornitori | ❌ | **ALTA** | Non c'è un modello Fornitore. Serve per: registri IVA, ritenute, riconciliazione |
| Anagrafica clienti | ❌ | **ALTA** | Non c'è un modello Cliente. Serve per: registro fatture emesse, crediti |
| Dati sede legale completi | ⚠️ | MEDIA | C'è `indirizzo` ma manca la struttura (via, CAP, città, provincia) |

### C) IVA e Registri

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Natura operazione IVA | ❌ | **ALTA** | Imponibile/Non imponibile/Esente/Escluso/Reverse charge/Split payment |
| Riferimento normativo esenzione | ❌ | **ALTA** | Art. e comma di esenzione |
| Tipo documento SDI | ❌ | **ALTA** | TD01, TD04, TD05, TD16, ecc. |
| Protocollo IVA | ❌ | **ALTA** | Numerazione progressiva nei registri |
| Data registrazione | ❌ | **ALTA** | Distinta da data operazione |
| Registro IVA di appartenenza | ❌ | **ALTA** | Vendite/Acquisti/Corrispettivi |
| Liquidazione periodica IVA | ❌ | MEDIA | Calcolo e tracciamento saldi IVA periodici |

### D) Cespiti e Ammortamento

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Ammortamento base | ✅ | — | Funzionante con regola 50% primo anno |
| Categoria DM cespite | ❌ | **ALTA** | Classificazione secondo DM 31/12/1988 |
| Tipo immobilizzazione | ❌ | **ALTA** | Materiale vs immateriale (per voci separate B.10.a/B.10.b) |
| Doppio binario civile/fiscale | ❌ | **ALTA** | Aliquote distinte per ammortamento civile e fiscale |
| Data entrata in funzione | ❌ | MEDIA | Può differire dalla data di acquisto |
| Valore residuo | ❌ | MEDIA | Per ammortamento civilistico |
| Mapping voce bilancio | ❌ | **ALTA** | Collegamento a SP (es. B.II.4) e CE (es. B.10.b) |

### E) Ratei e Risconti

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Modello Ratei/Risconti | ❌ | **ALTA** | Completamente assente. Necessario per competenza |
| Calcolo automatico | ❌ | **ALTA** | Da date competenza delle operazioni ricorrenti (affitti, assicurazioni) |
| Storno esercizio successivo | ❌ | MEDIA | Gestione automatica dello storno |

### F) Ritenute d'Acconto

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Gestione ritenute | ❌ | **ALTA** | Completamente assente |
| Anagrafica percipiente | ❌ | **ALTA** | Serve come parte dell'anagrafica fornitori |
| Tracciamento versamento F24 | ❌ | MEDIA | Data e conferma versamento |
| Generazione CU | ❌ | BASSA | Per fase futura |

### G) Patrimonio Netto e Fondi

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Capitale sociale | ✅ | — | Presente su Societa |
| Riserve (legale, statutarie, altre) | ❌ | **ALTA** | Serve per SP sezione Passivo A) |
| Utili portati a nuovo | ❌ | **ALTA** | Saldo cumulato esercizi precedenti |
| TFR | ❌ | MEDIA | Se ci sono dipendenti |
| Fondi rischi e oneri | ❌ | MEDIA | Accantonamenti |

### H) Disponibilità Liquide e Debiti/Crediti

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Saldi bancari | ❌ | **ALTA** | Per SP C.IV.1 e rendiconto finanziario |
| Cassa contanti | ❌ | MEDIA | Per SP C.IV.3 |
| Crediti vs clienti | ❌ | **ALTA** | Per SP C.II.1 — serve tracking incassi |
| Debiti vs fornitori | ❌ | **ALTA** | Per SP D.7 — serve tracking pagamenti |
| Debiti tributari | ⚠️ | MEDIA | Parziale tramite PAGAMENTO_IMPOSTE |
| Debiti vs banche | ⚠️ | MEDIA | Parziale tramite Finanziamento |

### I) Documenti

| Elemento | Stato | Priorità | Note |
|----------|-------|----------|------|
| Allegato file | ✅ | — | fileAllegato presente |
| XML fattura elettronica | ✅ | — | fileXml presente |
| Tipo documento | ⚠️ | **ALTA** | Manca distinzione nota credito/debito/autofattura |
| Bollo virtuale | ❌ | BASSA | 2€ per operazioni esenti > 77,47€ |

---

### Riepilogo Priorità di Implementazione

#### Fase 1 — Fondamenta (prerequisiti per qualsiasi bilancio)
1. **Piano dei Conti** con mapping alle voci di bilancio
2. **Partita doppia** (o quantomeno mapping automatico operazione → conti)
3. **Anagrafica fornitori e clienti**
4. **Periodo di competenza** sulle operazioni
5. **Natura operazione IVA** e registri

#### Fase 2 — Completamento dati
6. **Ratei e risconti** (modello + calcolo automatico)
7. **Ritenute d'acconto**
8. **Doppio binario ammortamento** (civile/fiscale)
9. **Patrimonio netto** (riserve, utili a nuovo)
10. **Stato pagamento** (pagato/non pagato) per crediti e debiti

#### Fase 3 — Generazione bilancio
11. **Generatore Conto Economico** (aggregazione per voci CE)
12. **Generatore Stato Patrimoniale** (aggregazione per voci SP)
13. **Bilancio di verifica** (report intermedio)
14. **Formato abbreviato/micro** (semplificazioni automatiche)

#### Fase 4 — Funzionalità avanzate
15. **Rendiconto finanziario**
16. **Nota integrativa** (template)
17. **Registri IVA formali**
18. **Generazione CU**
19. **Export XBRL** (formato deposito Camera di Commercio)

---

## 15. Liquidazione IVA Periodica — Regole 2025

> **ATTENZIONE — Riforma Fiscale in corso**: Il **D.Lgs. 19 gennaio 2026, n. 10** ha approvato il Testo Unico IVA che abroga e ricodifica l'intera disciplina IVA (incluso l'art. 27 DPR 633/1972 e l'art. 6 L. 405/1990), con **efficacia dal 1° gennaio 2027**. Fino al 31 dicembre 2026 continuano ad applicarsi le regole descritte di seguito, basate sulla normativa previgente.

### 15.1 Liquidazione Mensile vs Trimestrale — Soglie

| Regime | Soglia Volume d'Affari | Scadenza Versamento | Maggiorazione |
|--------|------------------------|---------------------|---------------|
| **Mensile** (obbligatorio) | > €400.000 (servizi) o > €700.000 (beni) | Entro il **16** del mese successivo | — |
| **Trimestrale** (opzionale) | ≤ €400.000 (servizi) o ≤ €700.000 (beni) | Entro il **16** del 2° mese dopo il trimestre | **+1% di maggiorazione** a titolo di interessi |

**Riferimenti normativi soglie**: Art. 7 DPR 542/1999 e Art. 11 DPR 435/2001. Le soglie originali erano 600 milioni di lire (servizi) e 1 miliardo di lire (beni), convertite in euro con la transizione al 2002. I valori correntemente usati in prassi sono €400.000 e €700.000, ma si raccomanda verifica aggiornata per ogni esercizio fiscale.

**Basi di calcolo**:
- Mensile: differenza tra IVA esigibile (vendite) e IVA detraibile (acquisti) del mese precedente
- Versamento minimo: se l'importo è ≤ €100, si può differire al mese successivo (entro il 16 dicembre per il mese di novembre)

**Scadenze versamenti mensili (codici tributo F24)**:
| Mese di riferimento | Scadenza | Codice Tributo |
|---------------------|----------|---------------|
| Gennaio | 16 febbraio | 6001 |
| Febbraio | 16 marzo | 6002 |
| Marzo | 16 aprile | 6003 |
| Aprile | 16 maggio | 6004 |
| Maggio | 16 giugno | 6005 |
| Giugno | 16 luglio | 6006 |
| Luglio | 16 agosto | 6007 |
| Agosto | 16 settembre | 6008 |
| Settembre | 16 ottobre | 6009 |
| Ottobre | 16 novembre | 6010 |
| Novembre | 16 dicembre | 6011 |
| Dicembre | 16 gennaio | 6012 |

**Scadenze versamenti trimestrali (codici tributo F24)**:
| Trimestre | Scadenza | Codice Tributo |
|-----------|----------|---------------|
| I trimestre (gen-mar) | 16 maggio | 6031 |
| II trimestre (apr-giu) | 16 agosto | 6032 |
| III trimestre (lug-set) | 16 novembre | 6033 |
| IV trimestre (ott-dic) | 16 febbraio | 6034 |

> La maggiorazione dell'1% è già inclusa nell'importo da versare per i contribuenti trimestrali.

### 15.2 Acconto IVA Dicembre

Disciplinato dall'**Art. 6 L. 405/1990** (in vigore fino al 31/12/2026, poi ricodificato in D.Lgs. 10/2026).

**Scadenza**: **27 dicembre** di ogni anno.

**Codice tributo F24**: **6013** (acconto IVA).

**Chi deve versare**: tutti i contribuenti IVA (mensili e trimestrali), tranne:
- Chi ha IVA a credito nel periodo di riferimento (acconto risultante ≤ 0)
- Chi ha cessato l'attività
- Contribuenti in regime forfettario (esenti IVA)
- Chi esercita attività in base a regime speciale (agricoltura, agenzie viaggi, ecc.)
- Neofornitori che hanno iniziato l'attività nell'anno corrente (non c'è base storica)

**Tre metodi di calcolo** (il contribuente sceglie quello più favorevole):

| Metodo | Descrizione | Percentuale |
|--------|-------------|-------------|
| **Storico** | 88% dell'IVA versata (o dovuta) nel mese/trimestre di dicembre dell'anno precedente | **88%** |
| **Previsionale** | 88% dell'IVA che si prevede di dover versare per dicembre/IV trimestre dell'anno corrente | **88%** |
| **Analitico** | IVA risultante dalla liquidazione sulle operazioni registrate dall'1 al 20 dicembre (mensili) o dall'1 ottobre al 20 dicembre (trimestrali), meno l'IVA detraibile nello stesso periodo | 100% del saldo effettivo |

**Soglia di esonero**: se l'acconto calcolato è inferiore a **€103,29**, non è dovuto il versamento.

**Penalty**: soprattassa del 30% sull'importo non versato (riducibile con ravvedimento operoso).

### 15.3 Dichiarazione IVA Annuale

**Scadenza**: tra il **1° febbraio** e il **30 aprile** di ciascun anno (per l'anno precedente).

**Base normativa**: Art. 8 DPR 322/1998 (come modificato).

**Codice tributo F24 saldo IVA annuale**: **6099**.

**Versamento saldo IVA annuale**: entro il **16 marzo** dell'anno successivo (oppure entro il 30 giugno con maggiorazione dello 0,40% mensile).

**Codice tributo prima rata acconto**: **6034** (per trimestrali) o acconto tramite **6013** (dicembre).

### 15.4 LIPE — Comunicazione Liquidazioni Periodiche IVA Elettroniche

Introdotta dal **D.L. 193/2016** (art. 4), convertito in L. 225/2016, che ha inserito l'art. 21-bis nel corpo delle norme IVA.

**Scopo**: comunicazione telematica dei dati di riepilogo di ogni liquidazione periodica IVA.

**Dati comunicati** (per ogni periodo):
- IVA esigibile (totale IVA su vendite)
- IVA detraibile (totale IVA su acquisti)
- IVA dovuta o a credito del periodo
- Debito o credito precedente riportato
- Acconto versato (per IV trimestre)
- Importo versato
- Flag: contribuente mensile o trimestrale
- Eventuali rettifiche rispetto a periodi precedenti

**Scadenze per anno (4 comunicazioni annuali)**:

| Trimestre | Periodo coperto | Scadenza |
|-----------|-----------------|----------|
| I trimestre | gen-mar | **31 maggio** |
| II trimestre | apr-giu | **16 settembre** |
| III trimestre | lug-set | **30 novembre** |
| IV trimestre | ott-dic | **Incluso nella dichiarazione IVA annuale** (non c'è comunicazione separata) |

> **Nota**: il IV trimestre non richiede una LIPE separata; i dati confluiscono direttamente nella dichiarazione IVA annuale.

**Chi è esonerato dalla LIPE**:
- Soggetti che non presentano la dichiarazione IVA annuale
- Soggetti che non effettuano liquidazioni periodiche (es. contribuenti forfettari esenti IVA)
- Produttori agricoli in regime di esonero (art. 34, c. 6 DPR 633/1972)

**Sanzione per omessa o tardiva LIPE**: da **€500 a €2.000** per periodo (riducibile a metà se corretta entro 15 giorni dalla scadenza). Ravvedimento operoso applicabile.

**Trasmissione**: telematica tramite portale "Fatture e Corrispettivi" o software abilitati.

### 15.5 Variazioni 2024-2025 alla disciplina IVA

| Novità | Descrizione | Efficacia |
|--------|-------------|-----------|
| **D.Lgs. 10/2026 (Testo Unico IVA)** | Ricodifica e razionalizza l'intera disciplina IVA in un unico testo. Non introduce modifiche sostanziali alle aliquote o ai meccanismi, ma riordina le fonti normative. Abroga DPR 633/1972 e le leggi satellite. | **Dal 1° gennaio 2027** |
| **Soglia minima versamento periodico** | Il versamento periodico IVA può essere omesso (e rinviato al periodo successivo) se l'importo dovuto non supera **€100** (novità rispetto al precedente limite di €25,82 ex lire 50.000) | In vigore |
| **Acconto IVA — conferma regole** | Nessuna modifica per il 2024 e 2025: deadline 27 dicembre, percentuale 88%, tre metodi invariati. | Invariato |

---

## 16. Ritenute d'Acconto — Regole 2025

> **ATTENZIONE — Riforma Fiscale**: Il **D.Lgs. 24 marzo 2025, n. 33** (Testo Unico Versamenti e Riscossione, in vigore dal 27 marzo 2025) ha ricodificato in un testo unico la disciplina del versamento delle ritenute, abrogando gli artt. 23-25-bis del DPR 600/1973 con efficacia **dal 1° gennaio 2027** (proroga con D.L. 31 dicembre 2025, n. 200). Fino al 31/12/2026 continuano ad applicarsi le regole descritte di seguito.

### 16.1 Aliquote Ritenuta — Quadro Completo 2025

| Tipo Reddito | Aliquota | Base Imponibile | Riferimento |
|--------------|----------|----------------|-------------|
| **Lavoro autonomo abituale** | **20%** | 100% del compenso | Art. 25 DPR 600/73 (vigente fino al 31/12/2026) |
| **Lavoro autonomo occasionale** | **20%** | 100% del compenso | Art. 25 DPR 600/73 |
| **Provvigioni (agenti con struttura)** | 23% applicata su **20%** della provvigione | 20% dell'ammontare | Art. 25-bis DPR 600/73 |
| **Provvigioni (agenti senza struttura)** | 23% applicata su **50%** della provvigione | 50% dell'ammontare | Art. 25-bis DPR 600/73 |
| **Venditori porta a porta** | 23% su 78% | 78% dell'ammontare | Art. 25-bis DPR 600/73 |
| **Diritti d'autore (≥ 35 anni)** | 20% | 75% dell'importo | Art. 25 DPR 600/73 (25% deduzione forfettaria) |
| **Diritti d'autore (< 35 anni)** | 20% | 60% dell'importo | Art. 25 DPR 600/73 (40% deduzione forfettaria) |
| **Non residenti (lavoro autonomo)** | **30%** (imposta definitiva) | 100% del compenso | Art. 25 DPR 600/73 |

> **Aliquota invariata**: La ritenuta del 20% per lavoro autonomo residente è rimasta invariata nel 2024 e 2025, confermata dall'Art. 25 DPR 600/73 in vigore al 31/12/2025.

### 16.2 Regime Forfettario — Esenzione Ritenute

**Base normativa**: Art. 1, comma 67, L. 190/2014 (Legge di Stabilità 2015).

> "I ricavi e i compensi relativi al reddito oggetto del regime forfetario non sono assoggettati a ritenuta d'acconto da parte del sostituto d'imposta."

**Regole operative**:
- Il contribuente forfettario **NON subisce** la ritenuta del 20% sulle proprie prestazioni
- Il contribuente forfettario **NON applica** ritenute sui compensi che eroga a professionisti autonomi
- Obbligo dichiarativo: il forfettario deve indicare in fattura la dicitura "Operazione effettuata ai sensi dell'art. 1, commi 54-89, della Legge n. 190/2014 – Regime forfetario"
- Il sostituto d'imposta (cliente) deve verificare la dichiarazione del forfettario

**Rivalsa INPS Gestione Separata (4%)**:
- Rientra nella base imponibile della ritenuta d'acconto per lavoratori autonomi NON forfettari
- NON rientra nella base imponibile la rivalsa delle Casse di previdenza professionali (es. CNPADC per commercialisti, INARCASSA, ecc.)

### 16.3 Versamento F24 Ritenute

**Scadenza**: entro il **16 del mese successivo** a quello in cui le somme sono state corrisposte.
**Base normativa**: Art. 18, D.Lgs. 241/1997.

**Codici tributo F24 principali per ritenute**:

| Codice Tributo | Descrizione |
|---------------|-------------|
| **1001** | Ritenute su redditi di lavoro dipendente e assimilati |
| **1002** | Ritenute su redditi da pensione |
| **1012** | Ritenute su redditi da lavoro dipendente corrisposti da terzi |
| **1019** | Ritenute su compensi per avviamento commerciale |
| **1020** | Ritenute su contributi, indennità ed emolumenti vari corrisposti da enti pubblici |
| **1030** | Ritenute su redditi di capitale diversi da dividendi |
| **1038** | Ritenute su provvigioni (agenti, rappresentanti, mediatori, procacciatori d'affari) |
| **1040** | Ritenute su redditi di **lavoro autonomo** (professionisti, art. 25 DPR 600/73) |
| **1045** | Ritenute su provvigioni pagate da condomini per attività di intermediazione immobiliare |

> Il codice **1040** è quello di uso più frequente per le SRL di servizi che pagano compensi a professionisti e consulenti autonomi.

### 16.4 Certificazione Unica (CU)

Il sostituto d'imposta deve rilasciare la CU al percipiente per attestare le ritenute operate nell'anno.

| Adempimento | Scadenza | Riferimento |
|-------------|----------|-------------|
| Consegna CU al percipiente | **16 marzo** dell'anno successivo | Art. 4, c. 6-quater, DPR 322/1998 |
| Trasmissione telematica CU all'Agenzia delle Entrate | **16 marzo** dell'anno successivo | Art. 4, c. 6-quinquies, DPR 322/1998 |
| CU con soli redditi da lavoro autonomo / professionale | **31 marzo** (proroga) — e dal 2026 **30 aprile** | Prassi consolidata + DPR 322/1998 |

> La CU va emessa anche per importi molto piccoli. Non esiste una soglia minima di esonero.

### 16.5 Modello 770

Il Modello 770 è la dichiarazione annuale del sostituto d'imposta che riepiloga tutte le ritenute operate nell'anno.

| Adempimento | Scadenza |
|-------------|----------|
| Presentazione Modello 770 | Tra il **1° aprile** e il **31 ottobre** di ciascun anno |

**Riferimento**: Art. 4, c. 4-bis, DPR 322/1998.

> Il 770 riepiloga tutte le ritenute operate (lavoro dipendente, lavoro autonomo, provvigioni, dividendi, ecc.) nell'anno precedente.

### 16.6 Variazioni 2024-2025 alle Ritenute

| Novità | Descrizione | Efficacia |
|--------|-------------|-----------|
| **D.Lgs. 33/2025 (Testo Unico Versamenti)** | Ricodifica la disciplina del versamento delle ritenute. Non modifica le aliquote: il 20% per lavoro autonomo rimane invariato. | Dal 27/03/2025, efficacia piena dal 01/01/2027 |
| **Aliquota 20%** | Confermata invariata per lavoro autonomo residente in tutti i provvedimenti 2024-2025. | Invariata |
| **CU 2025 (redditi 2024)** | Scadenza confermata: 16 marzo 2025 per la consegna, 31 marzo 2025 (proroga) per soli redditi autonomi. | Applicato per CU 2025 |

---

## 17. Anagrafica Fornitori e Clienti — Dati Obbligatori

### 17.1 Dati Minimi Obbligatori per Legge (fattura elettronica SDI)

**Per i soggetti IVA italiani** (art. 21 DPR 633/1972):

```
Dati identificativi obbligatori (cedente/prestatore e cessionario/committente):
  ✅ denominazione / ragione sociale (o nome e cognome per persone fisiche)
  ✅ sede legale (indirizzo completo: via, numero civico, CAP, comune, provincia, nazione)
  ✅ partita IVA (11 cifre per soggetti italiani)
  ✅ codice fiscale (16 caratteri per persone fisiche, o uguale a P.IVA per enti)

Dati aggiuntivi per completezza anagrafica fiscale:
  ✅ regime fiscale (RF01 = Ordinario, RF02 = Minimi, RF19 = Forfettario, ecc.)
  ✅ tipo soggetto (persona fisica / persona giuridica / ente non commerciale)
  ✅ codice destinatario SDI (vedi §17.2)
  ✅ PEC (alternativa al codice destinatario SDI per ricevere fatture elettroniche)

Per i soggetti NON residenti in Italia:
  ✅ numero di identificazione IVA del paese UE (es. DE12345678)
  ✅ paese di stabilimento (codice ISO 2 lettere)
```

**Per le ritenute d'acconto** (sostituto d'imposta):
```
  ✅ codice fiscale del percipiente (obbligatorio per F24 e CU)
  ✅ tipo reddito (A = lavoro autonomo abituale, M = autonomo occasionale, ecc.)
  ✅ regime forfettario: flag booleano (esonero dalla ritenuta se true)
  ✅ cassa previdenziale professionale (CNPADC, INARCASSA, ecc.) + rivalsa 4%
```

### 17.2 Codice Destinatario SDI

Il codice destinatario SDI identifica il canale di ricezione delle fatture elettroniche nel Sistema di Interscambio.

**Formato**: **7 caratteri alfanumerici** (lettere maiuscole A-Z e cifre 0-9).

| Valore | Significato |
|--------|-------------|
| Codice di 7 caratteri univoco | Canale dedicato: intermediari, software house, grandi aziende |
| **0000000** (sette zeri) | Destinatario che **non è in grado di ricevere la fattura elettronicamente** → la fattura viene resa disponibile nell'area riservata del portale, ma non viene recapitata. Uso: B2C consumatori finali senza P.IVA, o soggetti che non hanno attivato la ricezione SDI. |
| **XXXXXXX** (sette X maiuscole) | Usato per fatture verso **soggetti non stabiliti in Italia** (UE ed extra-UE) e, per prassi, verso B2C senza P.IVA italiana |

> **Nota**: i contribuenti in regime forfettario **hanno l'obbligo di ricevere fatture elettroniche** (da gennaio 2024), quindi devono comunicare il proprio codice destinatario o PEC, NON usare 0000000.

**Come si ottiene il codice destinatario**:
- Registrandosi al portale "Fatture e Corrispettivi" dell'Agenzia delle Entrate
- Tramite un intermediario (commercialista, software house) che crea un canale SDI accreditato

**Alternativa**: in luogo del codice destinatario, il cedente può usare la **PEC del destinatario**. L'SDI recapita la fattura alla PEC indicata.

### 17.3 Partita IVA — Formato e Validazione

**Struttura** (11 cifre numeriche):

```
[NNNNNNN][PPP][C]
   7 cifre    3 cifre  1 cifra
  (numero   (codice   (cifra di
  progressivo) ufficio)  controllo)
```

| Campo | Posizioni | Descrizione |
|-------|-----------|-------------|
| Numero progressivo | 1-7 | Numero d'ordine assegnato dall'Agenzia delle Entrate |
| Codice ufficio | 8-10 | Codice della sede di competenza (es. 001 = sede centrale) |
| Cifra di controllo | 11 | Calcolata con algoritmo di controllo su cifre 1-10 |

**Algoritmo di validazione della cifra di controllo**:

```
1. Somma le cifre in posizione DISPARI (1, 3, 5, 7, 9): S1
2. Per le cifre in posizione PARI (2, 4, 6, 8, 10):
   - Moltiplica ciascuna per 2
   - Se il risultato > 9, sottrai 9
   - Somma i risultati: S2
3. Somma totale = S1 + S2
4. Cifra di controllo = (10 - (S1 + S2) mod 10) mod 10
5. La cifra all'11° posto deve uguagliare la cifra di controllo
```

**Formato EU/VIES**: `IT` + 11 cifre numeriche (es. `IT01234567890`).

**Regole di validazione aggiuntive**:
- Deve essere composta **esclusivamente da cifre** (no lettere)
- Lunghezza esatta: **11 caratteri**
- Le prime 7 cifre devono essere comprese tra `0000001` e `9999999`
- Le cifre 8-10 (codice ufficio) non devono essere `000`
- L'Agenzia delle Entrate mette a disposizione un servizio di verifica online: `https://telematici.agenziaentrate.gov.it/VerificaPIVA/`

**Distinzione P.IVA vs Codice Fiscale**:
- Per persone giuridiche e ditte individuali: il CF coincide con la P.IVA (11 cifre)
- Per persone fisiche: il CF è alfanumerico a 16 caratteri (diverso dalla P.IVA se hanno aperto P.IVA)

### 17.4 Codici Regime Fiscale SDI (campo RegimeFiscale)

Da inserire nel file XML della fattura elettronica nel blocco `CedentePrestatore`:

| Codice | Regime |
|--------|--------|
| **RF01** | Regime ordinario |
| **RF02** | Contribuenti minimi (art. 1, cc. 96-117, L. 244/2007) |
| **RF04** | Agricoltura e attività connesse e pesca |
| **RF05** | Vendita sali e tabacchi |
| **RF06** | Commercio fiammiferi |
| **RF07** | EDITORIA |
| **RF08** | Gestione servizi telefonia pubblica |
| **RF09** | Rivendita documenti di trasporto pubblico e di sosta |
| **RF10** | Intrattenimenti, giochi e altre attività di cui alla tariffa allegata al DPR 640/72 |
| **RF11** | Agenzie viaggi e turismo (art. 74-ter, DPR 633/72) |
| **RF12** | Agriturismo (art. 5, c. 2, L. 413/91) |
| **RF13** | Vendite a domicilio (art. 25-bis, c. 6, DPR 600/73) |
| **RF14** | Rivendita beni usati, oggetti d'arte, d'antiquariato o da collezione |
| **RF15** | Agenzie di vendite all'asta di oggetti d'arte, d'antiquariato o da collezione |
| **RF16** | IVA per cassa P.A. (art. 6, c. 5, DPR 633/72) |
| **RF17** | IVA per cassa (art. 32-bis, D.L. 83/2012) |
| **RF18** | Altro |
| **RF19** | **Regime forfettario** (art. 1, cc. 54-89, L. 190/2014) |

---

## Fonti Normative

- Art. 2423-2435-ter Codice Civile — Bilancio d'esercizio
- Art. 102 TUIR — Ammortamento beni materiali
- Art. 164 TUIR — Limiti fiscali veicoli
- DPR 633/1972 — Disciplina IVA (in vigore fino al 31/12/2026)
- DPR 600/1973 — Accertamento imposte sui redditi (ritenute; artt. 25, 25-bis in vigore fino al 31/12/2026)
- DM 31/12/1988 — Coefficienti di ammortamento
- DPR 100/1998 — Liquidazioni periodiche IVA mensili (art. 1) e trimestrali (art. 4)
- DPR 542/1999 — Semplificazioni dichiarazioni; soglie trimestrali IVA (art. 7)
- DPR 322/1998 — Dichiarazioni sostituti d'imposta; CU e Modello 770 (art. 4)
- L. 405/1990, art. 6 — Acconto IVA dicembre (in vigore fino al 31/12/2026)
- D.Lgs. 241/1997, art. 17-18 — Versamento unitario F24; scadenza 16 del mese
- D.L. 193/2016, art. 4 — Introduzione LIPE (comunicazione liquidazioni periodiche IVA)
- L. 190/2014, art. 1, c. 67 — Esonero ritenute per contribuenti forfettari
- D.Lgs. 125/2024 — Aggiornamento soglie bilancio abbreviato/micro
- D.Lgs. 33/2025 — Testo Unico Versamenti e Riscossione (efficacia piena 01/01/2027)
- D.Lgs. 10/2026 — Testo Unico IVA (efficacia 01/01/2027)
- OIC 16 — Immobilizzazioni materiali
- OIC 24 — Immobilizzazioni immateriali
- OIC 10 — Rendiconto finanziario
