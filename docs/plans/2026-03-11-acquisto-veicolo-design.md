# Acquisto Veicolo Aziendale - Design Document

## Obiettivo

Aggiungere la gestione completa dell'acquisto veicolo aziendale all'app Prima Nota, con fiscalità automatica secondo art. 164 TUIR: limiti di deducibilità per tipo veicolo, percentuali per uso, ammortamento su base fiscale limitata, finanziamento a rate con separazione capitale/interessi, e cessione con calcolo plusvalenza/minusvalenza.

## Architettura

Il veicolo è un sotto-tipo del Cespite esistente. Quando l'utente crea un'operazione CESPITE e attiva il toggle "È un veicolo?", il sistema raccoglie dati aggiuntivi (tipo, uso, targa, modalità acquisto) e applica automaticamente i limiti fiscali. Se l'acquisto è con finanziamento, il sistema genera una ricorrenza per le rate mensili (riutilizzando il sistema OperazioneRicorrente esistente).

## Modello Dati

### Nuovi Enum

```
TipoVeicolo: AUTOVETTURA | MOTOCICLO | CICLOMOTORE | AUTOCARRO
UsoVeicolo: PROMISCUO | STRUMENTALE_ESCLUSIVO | USO_DIPENDENTE | AGENTE_COMMERCIO
ModalitaAcquisto: CONTANTI | FINANZIAMENTO
```

### Nuova tabella: Veicolo (one-to-one con Cespite)

| Campo | Tipo | Note |
|-------|------|------|
| id | Int PK | |
| cespiteId | Int FK unique | → Cespite |
| tipoVeicolo | TipoVeicolo | |
| usoVeicolo | UsoVeicolo | |
| modalitaAcquisto | ModalitaAcquisto | |
| marca | String | |
| modello | String | |
| targa | String | |
| limiteFiscale | Decimal | Calcolato da tipo+uso |
| percentualeDeducibilita | Decimal | Calcolato da uso |
| percentualeDetraibilitaIva | Decimal | Calcolato da uso |

### Nuova tabella: Finanziamento (one-to-one con Veicolo, opzionale)

| Campo | Tipo | Note |
|-------|------|------|
| id | Int PK | |
| veicoloId | Int FK unique | → Veicolo |
| importoFinanziato | Decimal | |
| anticipo | Decimal | Default 0 |
| numeroRate | Int | |
| importoRata | Decimal | |
| tan | Decimal? | Opzionale |
| dataPrimaRata | DateTime | |
| operazioneRicorrenteId | Int? FK | → OperazioneRicorrente |

### Nuova tabella: CessioneVeicolo (one-to-one con Veicolo, opzionale)

| Campo | Tipo | Note |
|-------|------|------|
| id | Int PK | |
| veicoloId | Int FK unique | → Veicolo |
| dataCessione | DateTime | |
| prezzoVendita | Decimal | |
| valoreResiduoContabile | Decimal | Calcolato |
| plusvalenza | Decimal | Default 0 |
| plusvalenzaImponibile | Decimal | Default 0 |
| minusvalenza | Decimal | Default 0 |
| minusvalenzaDeducibile | Decimal | Default 0 |

## Logica Fiscale Automatica

### Limiti fiscali per tipo veicolo (art. 164 TUIR)

| Tipo Veicolo | Limite acquisto/leasing | Limite NLT annuo |
|---|---|---|
| Autovettura | €18.075,99 | €3.615,20 |
| Autovettura (agente) | €25.822,84 | €5.164,57 |
| Motociclo | €4.131,66 | €774,69 |
| Ciclomotore | €2.065,83 | €413,17 |
| Autocarro strumentale | Nessun limite | Nessun limite |

### Percentuali per uso veicolo

| Uso | Deducibilita costi | Detraibilita IVA |
|---|---|---|
| Promiscuo | 20% | 40% |
| Strumentale esclusivo | 100% | 100% |
| Uso dipendente | 70% | 100%* |
| Agente di commercio | 80% | 100% |

*IVA 100% solo se si addebita corrispettivo al dipendente, altrimenti 40%

### Calcolo ammortamento fiscale veicolo

1. Valore del bene = prezzo + IVA indetraibile
2. Se valore > limite fiscale -> base ammortamento = limite fiscale
3. Coefficiente ammortamento = 25% annuo (primo anno dimezzato al 12,5%)
4. Quota deducibile = quota annua x percentuale deducibilita uso

### Interessi passivi finanziamento

- **Con TAN**: piano ammortamento alla francese (rata costante, interessi decrescenti sulla quota capitale residua)
- **Senza TAN**: interessi totali = (rata x numero rate) - importo finanziato, spalmati linearmente sulle rate
- Deducibilita interessi = stessa percentuale dell'uso veicolo (20% promiscuo, 80% agenti, ecc.)

### Cessione - plusvalenza/minusvalenza

```
valoreResiduo = costoStorico - fondoAmmortamento
Se prezzoVendita > valoreResiduo:
  plusvalenza = prezzoVendita - valoreResiduo
  plusvalenzaImponibile = plusvalenza x (ammortamentoDedotto / ammortamentoTotale)
Se prezzoVendita < valoreResiduo:
  minusvalenza = valoreResiduo - prezzoVendita
  minusvalenzaDeducibile = minusvalenza x (ammortamentoDedotto / ammortamentoTotale)
```

## UX / Flusso Utente

### Creazione veicolo

Nel form Operazione esistente, quando `tipoOperazione = CESPITE`, appare un toggle **"E' un veicolo?"**. Se attivato:

1. **Dati veicolo**: marca, modello, targa
2. **Selettore tipo veicolo**: Autovettura / Motociclo / Ciclomotore / Autocarro
3. **Selettore uso veicolo**: Promiscuo / Strumentale esclusivo / Uso dipendente / Agente di commercio
4. **Info fiscale automatica** (read-only): limite fiscale, % deducibilita, % IVA detraibile
5. **Selettore modalita acquisto**: Contanti / Finanziamento

Se **Finanziamento** selezionato, pannello aggiuntivo:
- Anticipo versato (default 0)
- Importo finanziato (auto-calcolato: prezzo - anticipo, editabile)
- Numero rate
- Importo rata mensile
- TAN % (opzionale, con tooltip)
- Data prima rata
- Preview: totale interessi stimati e quota interessi deducibile

### Al salvataggio

1. Crea Operazione CESPITE (con anticipo come importo se presente)
2. Crea Cespite con piano ammortamento su base fiscale limitata
3. Crea Veicolo con dati fiscali
4. Se finanziamento: crea Finanziamento + genera OperazioneRicorrente per rate mensili
5. Le rate appaiono come bozze nel banner dashboard (sistema esistente)

### Rate mensili (bozze)

Ogni rata generata come bozza riporta nella descrizione la scomposizione:
- "Rata finanziamento [marca modello targa] - Capitale X + Interessi Y"
- L'importo dell'operazione = solo quota interessi (unico costo deducibile)
- La quota capitale = movimento finanziario (riduzione debito), non costo

### Cessione veicolo

Dal dettaglio cespite-veicolo IN_AMMORTAMENTO, pulsante **"Registra Cessione"**:
- Dialog con: data cessione, prezzo di vendita
- Preview automatico: valore residuo, plusvalenza/minusvalenza, quota imponibile/deducibile
- Al conferma: stato -> CEDUTO, stop ammortamento, crea CessioneVeicolo, crea Operazione ENTRATA

### Registro Cespiti

I veicoli appaiono nella lista cespiti con icona dedicata. Vista dettaglio mostra dati aggiuntivi: tipo, uso, targa, finanziamento attivo con stato rate.

## Integrazione Report Fiscali

- **Ammortamento veicoli**: calcolato su base fiscale limitata, non sul valore reale
- **Interessi passivi**: esposti separatamente dagli ammortamenti, con propria deducibilita
- **Rate finanziamento**: la quota capitale NON e' costo deducibile
- **Cessione**: plusvalenza imponibile sommata ai ricavi, minusvalenza deducibile ai costi nell'anno di cessione
- **Ammortamento anno cessione**: pro-rata fino a data cessione
