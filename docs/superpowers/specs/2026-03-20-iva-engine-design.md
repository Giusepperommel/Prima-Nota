# IVA Engine — Trattamento IVA Completo per Fatture Estere e Nazionali

**Data**: 2026-03-20
**Stato**: Approvato
**Approccio**: Engine centralizzato (`src/lib/iva/`)

---

## 1. Architettura

### Struttura moduli

```
src/lib/iva/
  engine.ts                  — orchestratore principale
  classifier.ts              — determina trattamento IVA dato fornitore + operazione
  autofattura.ts             — genera integrazione/autofattura (TD16-TD19)
  doppia-registrazione.ts    — crea le due scritture acquisti+vendite
  plafond.ts                 — tracking e calcolo plafond esportatori
  countries.ts               — lista paesi UE/extra-UE (ISO 3166-1 alpha-2)
  types.ts                   — tipi TypeScript condivisi
  validation.ts              — validazione coerenza natura/aliquota/tipo documento
```

### Flusso principale

```
Operazione salvata (API/OCR)
       │
       ▼
  IVA Classifier
  (nazione fornitore + tipo operazione → trattamento)
       │
       ├─ IT → nessuna azione speciale (IVA ordinaria o natura scelta)
       │
       ├─ UE → integrazione automatica
       │    ├─ Beni → TD18, doppia registrazione
       │    └─ Servizi → TD17, doppia registrazione
       │
       ├─ Extra-UE → autofattura automatica
       │    ├─ Servizi → TD17, doppia registrazione
       │    └─ Beni (già in IT) → TD19, doppia registrazione
       │
       └─ Reverse charge interno → TD16, doppia registrazione
              (basato su natura N6.x selezionata)
       │
       ▼
  Plafond Check
  (se operazione N3.5, verifica disponibilità plafond)
       │
       ▼
  Validation
  (coerenza natura + aliquota + tipo documento + nazione)
```

### Principio chiave

L'engine lavora sempre — in modalità semplice compila automaticamente tutti i campi IVA senza mostrarli; in avanzata li mostra e permette override; la validazione avvisa in caso di override incoerente.

---

## 2. Modello Dati — Modifiche allo Schema

### Modifiche al modello Operazione

```prisma
// Nuovi campi
operazioneOrigineId    Int?          @map("operazione_origine_id")
operazioneOrigine      Operazione?   @relation("AutofatturaLink", fields: [operazioneOrigineId], references: [id])
autofatture            Operazione[]  @relation("AutofatturaLink")
tipoMerce              TipoMerce?    @map("tipo_merce")
doppiaRegistrazione    Boolean       @default(false) @map("doppia_registrazione")
protocolloIvaVendite   String?       @map("protocollo_iva_vendite") @db.VarChar(20)
```

### Nuovo enum TipoMerce

```prisma
enum TipoMerce {
  BENI
  SERVIZI
}
```

Serve perché per acquisti UE/extra-UE il tipo documento SDI cambia: TD18 (beni) vs TD17 (servizi).

### Nuovo modello Plafond

```prisma
model Plafond {
  id                 Int              @id @default(autoincrement())
  societaId          Int              @map("societa_id")
  anno               Int
  metodo             MetodoPlafond    @default(FISSO)
  importoDisponibile Decimal          @db.Decimal(12, 2)
  importoUtilizzato  Decimal          @db.Decimal(12, 2) @default(0)
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")
  societa            Societa          @relation(fields: [societaId], references: [id])
  movimenti          MovimentoPlafond[]

  @@unique([societaId, anno])
  @@map("plafond")
}

model MovimentoPlafond {
  id             Int        @id @default(autoincrement())
  plafondId      Int        @map("plafond_id")
  operazioneId   Int        @map("operazione_id")
  importo        Decimal    @db.Decimal(12, 2)
  dataOperazione DateTime   @db.Date @map("data_operazione")
  createdAt      DateTime   @default(now()) @map("created_at")
  plafond        Plafond    @relation(fields: [plafondId], references: [id])
  operazione     Operazione @relation(fields: [operazioneId], references: [id])

  @@map("movimento_plafond")
}

enum MetodoPlafond {
  FISSO
  MOBILE
}
```

### Modifiche ad Anagrafica

Nessuna modifica schema — il campo `nazione` esiste già con default "IT". Serve solo esporlo nella UI.

---

## 3. IVA Classifier — Regole di Classificazione

### Input

```typescript
type ClassifierInput = {
  nazioneFornitore: string        // "IT", "DE", "US", etc.
  tipoMerce: "BENI" | "SERVIZI"
  naturaIvaManuale?: NaturaIva    // override utente (modalità avanzata)
  aliquotaIva?: number            // aliquota se presente sulla fattura
  isReverseChargeInterno?: boolean
}
```

### Output

```typescript
type ClassifierOutput = {
  naturaIva: NaturaIva | null         // null = operazione imponibile ordinaria
  aliquotaIva: number                 // 22, 10, 5, 4 o 0
  tipoDocumentoSdi: TipoDocumentoSdi
  richiedeAutofattura: boolean
  richiedeDoppiaRegistrazione: boolean
  tipoDocumentoAutofattura?: TipoDocumentoSdi
  registroIva: RegistroIva
  warnings: string[]
}
```

### Matrice delle regole

| Nazione | Tipo Merce | → Tipo Doc Autofattura | → Natura | → Doppia Reg. |
|---------|-----------|----------------------|----------|---------------|
| IT | qualsiasi | nessuna | da aliquota/natura manuale | No |
| IT + N6.x | qualsiasi | TD16 | N6.x (dal fornitore) | Sì |
| UE | BENI | TD18 | imponibile (aliquota IT) | Sì |
| UE | SERVIZI | TD17 | imponibile (aliquota IT) | Sì |
| Extra-UE | SERVIZI | TD17 | imponibile (aliquota IT) | Sì |
| Extra-UE | BENI (in IT) | TD19 | imponibile (aliquota IT) | Sì |
| San Marino con IVA | qualsiasi | TD28 | da fattura | No |
| San Marino senza IVA | qualsiasi | TD17/TD19 | imponibile (aliquota IT) | Sì |

### Logica di override (modalità avanzata)

Se l'utente sovrascrive la natura o il tipo documento, il classifier:
1. Accetta l'override
2. Esegue validation e genera `warnings` se incoerente
3. Non blocca mai — il commercialista sa cosa fa

---

## 4. Autofattura e Doppia Registrazione

### Generazione Autofattura

Quando il classifier restituisce `richiedeAutofattura: true`, il modulo `autofattura.ts` crea una nuova Operazione collegata via `operazioneOrigineId`:

```typescript
{
  societaId,
  dataOperazione,                    // stessa data
  descrizione: `Integrazione ${tipoDoc} - ${descrizioneOriginale}`,
  importoImponibile,                 // stesso imponibile
  aliquotaIva: 22,                   // aliquota italiana applicabile
  importoIva,                        // calcolato: imponibile × aliquota
  tipoDocumentoSdi,                  // TD16/17/18/19
  operazioneOrigineId,               // link alla fattura originale
  doppiaRegistrazione: true,
  registroIva: "ACQUISTI",           // registro primario
  protocolloIva,                     // prossimo progressivo acquisti
  protocolloIvaVendite,              // prossimo progressivo vendite
}
```

### Doppia Registrazione

L'operazione autofattura ha `doppiaRegistrazione: true` e viene registrata con:
- `registroIva: ACQUISTI` + `protocolloIva` → appare nel registro acquisti (IVA detraibile = credito)
- `protocolloIvaVendite` → appare anche nel registro vendite (IVA dovuta = debito)

Risultato netto: debito e credito si annullano → IVA neutrale.

L'API registri IVA, quando filtra per VENDITE, include anche le operazioni con `doppiaRegistrazione: true`.

### Protocollo IVA automatico

Il sistema assegna automaticamente il prossimo numero progressivo per registro + anno. Il protocollo è per anno solare, progressivo senza buchi.

---

## 5. Plafond Esportatori Abituali

### Flusso

```
Configurazione (una tantum, modalità avanzata)
  └─ L'utente attiva il plafond per l'anno
     imposta: metodo (fisso/mobile), importo disponibile

Operazione con natura N3.5 salvata
       │
       ▼
  Plafond Engine
  ├─ Verifica: plafond attivo per l'anno?
  ├─ Calcola: importoUtilizzato + importoOperazione ≤ importoDisponibile?
  │
  ├─ OK → registra MovimentoPlafond, aggiorna importoUtilizzato
  │
  └─ SFORAMENTO →
       ├─ Alert all'utente
       ├─ Modalità semplice: genera automaticamente TD21
       │   (autofattura per splafonamento, con IVA sull'eccedenza)
       └─ Modalità avanzata: warning + proposta TD21
```

### UI (solo modalità avanzata)

- Widget nel dashboard/bilancio: barra progresso plafond (utilizzato/disponibile)
- Alert visivo quando si supera l'80%
- Storico movimenti plafond consultabile

### Metodo mobile

Per il plafond mobile, il calcolo è rolling 12 mesi — ogni mese si ricalcola il plafond disponibile sommando le esportazioni dei 12 mesi precedenti.

### Opt-in

Il plafond engine si attiva solo se la società ha configurato un plafond per l'anno. Se non configurato, le operazioni N3.5 vengono registrate normalmente senza tracking.

---

## 6. Modifiche UI e Integrazione OCR

### Anagrafica — esporre il campo nazione

- Select "Nazione" con lista paesi ISO 3166-1 alpha-2, default "IT"
- Raggruppato: "Italia" in cima, poi "Unione Europea" (27 paesi), poi "Extra-UE"
- Quando nazione ≠ IT, il campo "Provincia" diventa opzionale

### Form Operazione — comportamento per modalità

**Modalità semplice**:
- L'utente inserisce la fattura normalmente
- Se il fornitore è estero → l'engine classifica e genera autofattura in background
- L'utente vede solo un badge "Integrazione IVA generata automaticamente" accanto all'operazione
- Nuovo campo "Tipo merce" (BENI/SERVIZI) visibile solo se fornitore estero — unico input richiesto

**Modalità avanzata**:
- Tutti i campi IVA visibili
- Il classifier pre-compila natura, tipo documento, registro in base al fornitore
- L'utente può modificare tutto, con warning se incoerente
- Link "Vedi autofattura" per navigare all'operazione collegata
- Widget plafond visibile se configurato

### Registri IVA — modifiche

- Le operazioni con `doppiaRegistrazione: true` appaiono sia in acquisti che in vendite
- Colonna "Tipo Doc." che mostra TD16/17/18/19 per identificare integrazioni
- Colonna "Nazione" del fornitore/cliente
- Filtro per "solo operazioni estere" / "solo reverse charge"

### XML Parser — estrarre nazione cedente

Aggiungere al parser l'estrazione di `CedentePrestatore/Sede/Nazione` (2 char ISO). Se nazione ≠ IT, il sistema auto-imposta il fornitore come estero.

### OCR + Haiku — classificazione tipo merce

Aggiungere al prompt di Haiku la classificazione BENI/SERVIZI dalle righe del documento. Se misto, indica la componente prevalente per importo.

---

## 7. Validazione e Casi Limite

### Regole di validazione

| Regola | Condizione | Azione |
|--------|-----------|--------|
| Natura vs Aliquota | naturaIva presente ma aliquotaIva > 0 | Warning: "Natura IVA implica aliquota 0%" |
| Natura vs Nazione | N6.x con fornitore estero | Warning: "RC interno (N6.x) non compatibile con fornitore estero" |
| TD vs Nazione | TD18 con fornitore extra-UE | Errore: "TD18 è solo per beni intra-UE, usare TD19" |
| TD vs Tipo Merce | TD18 con SERVIZI | Warning: "TD18 è per beni, servizi usano TD17" |
| Split + RC | splitPayment true + natura N6.x | Warning: "Reverse charge ha priorità su split payment" |
| Plafond N3.5 | N3.5 senza plafond attivo | Warning: "Operazione N3.5 senza plafond configurato" |
| Nazione mancante | Fornitore senza nazione + operazione con natura estera | Errore: "Impostare la nazione del fornitore" |

### Casi limite gestiti

1. **Fattura mista beni+servizi da fornitore UE**: si usa il tipo prevalente per importo. In avanzata l'utente può splittare in due operazioni.

2. **Fornitore San Marino con IVA**: TD28, nessuna doppia registrazione (l'IVA è già esposta dal fornitore).

3. **Fornitore San Marino senza IVA**: come extra-UE, autofattura TD17/TD19.

4. **Modifica nazione fornitore dopo registrazione operazioni**: le operazioni esistenti NON vengono ricalcolate automaticamente — warning all'utente "Ci sono X operazioni registrate con il precedente trattamento IVA".

5. **Cancellazione operazione con autofattura collegata**: cancella anche l'autofattura (cascade logico, con conferma).

6. **Modifica operazione con autofattura collegata**: rigenera l'autofattura con i nuovi importi.

7. **N7 — IVA assolta in altro stato UE (OSS)**: nessuna autofattura, nessuna doppia registrazione. Solo annotazione nel registro vendite.
