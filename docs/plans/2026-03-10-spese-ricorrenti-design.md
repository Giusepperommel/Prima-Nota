# Spese Ricorrenti - Design Document

**Goal:** Aggiungere la possibilità di impostare spese ricorrenti (affitto, leasing, NLT, licenze software) con gestione automatica IVA/deducibilità e trattamento fiscale specifico per leasing e noleggio a lungo termine.

**Architettura:** Nuovo modello `OperazioneRicorrente` come template che genera bozze mensili (`Operazione` con `bozza: true`). Generazione on-demand al caricamento dashboard. Banner per conferma rapida.

---

## 1. Schema DB

### Nuovo modello: `OperazioneRicorrente`

```
OperazioneRicorrente
├── id, societaId, createdByUserId
├── attiva (Boolean, default true)
│
├── Dati operazione (template)
│   ├── tipoOperazione, categoriaId, descrizione
│   ├── importoTotale, aliquotaIva, percentualeDetraibilitaIva
│   ├── percentualeDeducibilita, opzioneUso
│   ├── tipoRipartizione, socioSingoloId
│   └── note
│
├── Ricorrenza
│   ├── giornoDelMese (Int, 1-31) — se il mese ha meno giorni, usa l'ultimo giorno
│   ├── dataInizio (Date)
│   ├── dataFine (Date?, opzionale) — se null, si rinnova fino a cancellazione
│   └── prossimaGenerazione (Date) — prossima data in cui generare la bozza
│
├── Dati fiscali leasing/NLT (tutti opzionali)
│   ├── tipoContratto (enum: LEASING, NOLEGGIO_LUNGO_TERMINE, null)
│   ├── valoreBene (Decimal?) — valore del bene per calcolo limiti
│   ├── maxicanone (Decimal?) — anticipo iniziale (leasing e NLT)
│   ├── durataContratto (Int?) — mesi totali
│   ├── quotaServizi (Decimal?) — solo NLT: quota servizi nel canone
│   └── rateRimanenti (Int?) — contatore decrementale, si disattiva a 0
│
└── Relazioni
    ├── societa, categoria, createdBy
    └── operazioniGenerate[] — le operazioni generate da questo template
```

### Modifica a `Operazione`

```
Operazione (campi aggiunti)
├── bozza (Boolean, default false)
└── operazioneRicorrenteId (FK?, opzionale)
```

---

## 2. Regole fiscali

### Leasing auto

- **Limite valore veicolo**: €18.075,99 (imprese/professionisti), €25.822,84 (agenti)
- **Formula proporzionalità**: se valore bene > limite → `canone_deducibile = canone × (limite / valoreBene)`
- **Maxicanone**: riscontato sull'intera durata del contratto
- **Deducibilità**: 20% (standard), 80% (agenti), 100% (uso esclusivo)
- **IVA**: 40% (uso promiscuo), 100% (uso esclusivo). Per agenti dipende dalla dimostrazione dell'uso esclusivo
- **Durata minima fiscale**: 48 mesi (intero periodo ammortamento, NON la metà)

### NLT auto

- **Canone diviso in**: quota locazione + quota servizi
- **Limite annuo quota locazione**: €3.615,20 (imprese), €5.164,57 (agenti) — cap secco, non proporzionale
- **Quota servizi**: nessun limite di importo, stessa % deducibilità (20%/80%)
- **Anticipo (opzionale)**: se presente, va riscontato sulla durata del contratto
- **IVA**: calcolata sull'intero canone (locazione + servizi), 40% uso promiscuo, 100% uso esclusivo

### Altre ricorrenze (affitto, software, ecc.)

Nessun campo aggiuntivo. Usano la categoria con le sue regole IVA/deducibilità standard.

### Regime forfettario

Le spese ricorrenti vengono registrate comunque (obbligo documentale), ma senza calcoli IVA/deducibilità (coerente con il comportamento già implementato).

---

## 3. UX

### Toggle nel form operazione

Quando l'utente attiva "Rendi ricorrente" nel form:
- Appare il campo **giorno del mese** (pre-compilato dalla data operazione)
- Appare il campo **data fine** (opzionale)
- La prima operazione viene creata subito come confermata alla data scelta

### Campi aggiuntivi leasing/NLT

Se la categoria è "Leasing auto" o "Noleggio auto lungo termine", appaiono automaticamente:

**Leasing:** valore veicolo, anticipo/maxicanone, durata contratto. Con avviso se il valore supera il limite fiscale e indicazione della riduzione proporzionale.

**NLT:** quota servizi, anticipo (opzionale), durata contratto (opzionale). Con avviso se la quota locazione annua supera il limite fiscale.

### Banner dashboard

Visibile subito al login con le bozze da confermare:
- Lista compatta: data, descrizione, importo
- Bottone conferma singola (✓) e modifica (✏️) per ogni riga
- Bottone "Conferma tutte" per conferma in blocco
- Il mini-editor permette di modificare l'importo prima di confermare

### Gestione ricorrenze

Nuova tab "Ricorrenze" nella pagina configurazione:
- Lista ricorrenze attive con dettagli
- Toggle attiva/disattiva per sospensione temporanea
- Modifica importo/dettagli (le bozze future useranno i nuovi dati)
- Eliminazione ricorrenza (bozze non confermate vengono eliminate)

---

## 4. Generazione bozze

### Trigger: on-demand al caricamento dashboard

Nessun cron esterno. L'API `/api/operazioni-ricorrenti/genera` viene chiamata al caricamento della dashboard. Controlla le ricorrenze con `prossimaGenerazione <= oggi` e genera le bozze.

### Logica

```
Per ogni OperazioneRicorrente dove attiva=true e prossimaGenerazione <= oggi:
  1. Calcola data effettiva (adatta giorno al mese reale)
  2. Verifica che non esista già una bozza per quel mese/anno
  3. Crea Operazione con bozza=true, copiando dati dal template
  4. Per leasing: applica proporzionalità valore bene / limite
  5. Per NLT: applica cap quota locazione
  6. Aggiorna prossimaGenerazione al mese successivo
  7. Se dataFine e prossimaGenerazione > dataFine → disattiva
  8. Se rateRimanenti, decrementa; se 0 → disattiva
```

### Edge cases

- **Accesso dopo mesi di assenza**: genera tutte le bozze arretrate
- **Bozza già esistente**: no duplicati (check mese/anno + operazioneRicorrenteId)
- **Modifica ricorrenza**: bozze esistenti non cambiano, future sì
- **Cancellazione ricorrenza**: bozze non confermate eliminate, operazioni confermate restano
