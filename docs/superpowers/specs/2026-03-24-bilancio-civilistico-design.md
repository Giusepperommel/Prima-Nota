# Design — Bilancio Civilistico (art. 2424/2425 c.c.)

> Data: 2026-03-24

## Obiettivo
Generare lo Stato Patrimoniale e il Conto Economico secondo lo schema civilistico italiano (art. 2424 e 2425 c.c.) a partire dai MovimentiContabili esistenti, con esportazione PDF e XBRL.

---

## 1. Bilancio Engine

### Flusso dati
1. Legge i MovimentiContabili aggregati per conto (come bilancio-verifica)
2. Per ogni conto, usa `voceSp` e `voceCe` dal PianoDeiConti per posizionarlo nella gerarchia
3. Costruisce la struttura ad albero dell'art. 2424 (SP) e art. 2425 (CE)
4. Calcola subtotali per ogni livello gerarchico

### Gerarchia voci
La gerarchia a 4 livelli:
- **Sezione**: ATTIVO / PASSIVO (SP), oppure sezione CE
- **Classe** (lettera maiuscola): A, B, C, D, E
- **Sottoclasse** (romano): I, II, III, IV
- **Voce** (numero arabo): 1, 2, 3, ...
- **Sotto-voce** (lettera minuscola): a, b, c, ...

Parsing di `voceSp`/`voceCe`: es. `"C.IV.1"` → classe=C, sottoclasse=IV, voce=1

### Calcolo saldi
- Per conti patrimoniali ATTIVI (naturaSaldo=DARE): saldo = sum(dare) - sum(avere). Se positivo va nell'attivo, se negativo va come rettifica.
- Per conti patrimoniali PASSIVI (naturaSaldo=AVERE): saldo = sum(avere) - sum(dare). Positivo nel passivo.
- Per conti economici: si usa il saldo netto secondo la natura.

---

## 2. Data Model

### Tabella BilancioGenerato

```prisma
model BilancioGenerato {
  id            Int      @id @default(autoincrement())
  societaId     Int      @map("societa_id")
  anno          Int
  dataGenerazione DateTime @default(now()) @map("data_generazione")
  tipo          String   @db.VarChar(20) // "ORDINARIO" | "ABBREVIATO"
  datiSp        Json     @map("dati_sp")     // struttura SP serializzata
  datiCe        Json     @map("dati_ce")     // struttura CE serializzata
  totaleAttivo  Decimal  @map("totale_attivo") @db.Decimal(14, 2)
  totalePassivo Decimal  @map("totale_passivo") @db.Decimal(14, 2)
  utileEsercizio Decimal @map("utile_esercizio") @db.Decimal(14, 2)

  societa Societa @relation(fields: [societaId], references: [id])

  @@unique([societaId, anno])
  @@map("bilanci_generati")
}
```

I dati SP e CE vengono salvati come JSON per flessibilita e perche la struttura e gerarchica.

---

## 3. SP Builder

Mappa ogni `voceSp` del PianoDeiConti nella struttura completa dell'art. 2424.

Input: lista di `{ contoId, voceSp, saldo, naturaSaldo }`
Output: albero con struttura:
```ts
{
  attivo: {
    classi: [
      { codice: "A", descrizione: "Crediti v/soci...", importo, voci: [...] },
      { codice: "B", descrizione: "Immobilizzazioni", importo, sottoclassi: [
        { codice: "I", descrizione: "Immob. immateriali", importo, voci: [...] }
      ]},
      ...
    ],
    totale: number
  },
  passivo: { ... }
}
```

---

## 4. CE Builder

Mappa ogni `voceCe` del PianoDeiConti nella struttura dell'art. 2425.

Struttura scalare:
- A) Valore della produzione → totaleA
- B) Costi della produzione → totaleB
- Differenza A - B
- C) Proventi e oneri finanziari → totaleC
- D) Rettifiche di valore → totaleD
- Risultato prima delle imposte
- 20) Imposte
- 21) Utile/perdita

---

## 5. PDF Generation

Per ora placeholder (ritorna JSON). In futuro:
- Usa server-side PDF con template HTML → PDF
- Oppure React-PDF per generazione client-side
- Header con dati societa, anno, data generazione
- Tabelle SP e CE formattate secondo schema civilistico

---

## 6. XBRL Generation

Genera un documento XBRL instance semplificato:
- XML con namespace it-gaap
- Context con entity identifier e periodo
- Unit EUR
- Fact per ogni voce di bilancio mappata al concetto XBRL
- Non firmato (la firma digitale e esterna)

---

## 7. API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/bilancio-civilistico/genera` | Genera/rigenera bilancio per anno |
| GET | `/api/bilancio-civilistico/[anno]` | Restituisce bilancio generato |
| GET | `/api/bilancio-civilistico/[anno]/pdf` | Placeholder PDF (ritorna JSON) |
| GET | `/api/bilancio-civilistico/[anno]/xbrl` | Genera XBRL instance document |

---

## 8. UI Page

Pagina `/bilancio/bilancio-civilistico`:
- Selettore anno
- Pulsante "Genera bilancio"
- Tab SP / CE
- Tabelle espandibili per sezione/classe/sottoclasse
- Totali calcolati
- Pulsanti export PDF e XBRL
- Link nella sidebar sotto "Bilancio"
