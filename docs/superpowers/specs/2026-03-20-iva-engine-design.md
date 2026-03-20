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
  autofattura.ts             — genera integrazione/autofattura (TD16-TD19, TD28)
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
  (nazione fornitore + tipo operazione + direzione → trattamento)
       │
       ├─ IT → nessuna azione speciale (IVA ordinaria o natura scelta)
       │
       ├─ UE → integrazione automatica
       │    ├─ Beni → TD18, doppia registrazione
       │    └─ Servizi → TD17, doppia registrazione
       │
       ├─ Extra-UE → autofattura automatica
       │    ├─ Servizi → TD17, doppia registrazione
       │    └─ Beni (già in IT, post-dogana) → TD19, doppia registrazione
       │
       ├─ San Marino → in base a IVA esposta o meno
       │
       └─ Reverse charge interno → TD16, doppia registrazione
              (basato su natura N6.x selezionata)
       │
       ▼
  Plafond Check
  (se acquisto con dichiarazione d'intento N3.5, verifica disponibilità)
       │
       ▼
  Validation
  (coerenza natura + aliquota + tipo documento + nazione)
```

### Principio chiave

L'engine lavora sempre — in modalità semplice compila automaticamente tutti i campi IVA senza mostrarli; in avanzata li mostra e permette override; la validazione avvisa in caso di override incoerente.

### Integrazione API

L'IVA engine viene invocato all'interno della `POST /api/operazioni` e `PATCH /api/operazioni/[id]` come step nel flusso di salvataggio, dentro la stessa transazione Prisma. La creazione dell'autofattura è **atomica** con il salvataggio dell'operazione originale.

Endpoint aggiuntivo `POST /api/iva/preview` per ottenere l'anteprima della classificazione prima del salvataggio (usato dalla UI avanzata per mostrare i campi pre-compilati).

---

## 2. Modello Dati — Modifiche allo Schema

### Modifiche al modello Operazione

```prisma
// Nuovi campi
operazioneOrigineId    Int?          @map("operazione_origine_id")
operazioneOrigine      Operazione?   @relation("AutofatturaLink", fields: [operazioneOrigineId], references: [id], onDelete: SetNull)
autofatture            Operazione[]  @relation("AutofatturaLink")
tipoMerce              TipoMerce?    @map("tipo_merce")
doppiaRegistrazione    Boolean       @default(false) @map("doppia_registrazione")
protocolloIvaVendite   String?       @map("protocollo_iva_vendite") @db.VarChar(20)
movimentiPlafond       MovimentoPlafond[]
```

**Note sulle relazioni**: `onDelete: SetNull` sulla relazione autofattura — la cancellazione cascade è gestita in application code con conferma utente, non a livello DB. Quando si cancella un'operazione con autofatture collegate, il codice applicativo cancella prima le autofatture (con conferma), poi l'operazione.

**Note su `tipoMerce`**: viene impostato sia sull'operazione originale che sull'autofattura generata (copiato dall'originale), perché il tipo documento dell'autofattura dipende da questo campo.

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
  importoDisponibile Decimal          @db.Decimal(12, 2)  // tetto massimo (per FISSO: fisso annuale; per MOBILE: ricalcolato)
  importoUtilizzato  Decimal          @db.Decimal(12, 2) @default(0)  // somma movimenti attivi
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

### Relazioni inverse da aggiungere ai modelli esistenti

```prisma
// In Societa model — aggiungere:
plafond  Plafond[]

// In Operazione model — aggiungere:
// (vedi sezione "Modifiche al modello Operazione" sopra per tutti i campi)
```

### Vincoli di unicità per protocolli IVA

Il protocollo IVA deve essere unico per società + anno + registro. Le operazioni con doppia registrazione hanno due protocolli distinti (uno per acquisti, uno per vendite).

**Nota**: il vincolo di unicità sui protocolli IVA è gestito a livello applicativo (non DB constraint) perché `protocolloIva` è nullable e condiviso tra operazioni con e senza IVA. L'engine assegna i protocolli sequenzialmente con lock ottimistico per evitare collisioni.

### Modifiche ad Anagrafica

Nessuna modifica schema — il campo `nazione` esiste già con default "IT". Serve solo esporlo nella UI.

---

## 3. IVA Classifier — Regole di Classificazione

### Input

```typescript
type ClassifierInput = {
  nazioneFornitore: string          // "IT", "DE", "US", etc.
  tipoMerce: "BENI" | "SERVIZI"
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA"  // direzione: acquisto o vendita
  naturaIvaManuale?: NaturaIva      // override utente (modalità avanzata)
  aliquotaIva?: number              // aliquota se presente sulla fattura
  isReverseChargeInterno?: boolean  // flag esplicito per RC interno
  sanMarinoConIva?: boolean         // per distinguere SM con/senza IVA
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

### Matrice delle regole — Acquisti (COSTO)

| Nazione | Tipo Merce | → Tipo Doc Autofattura | → Natura autofattura | → Doppia Reg. |
|---------|-----------|----------------------|----------|---------------|
| IT | qualsiasi | nessuna | da aliquota/natura manuale | No |
| IT + N6.x | qualsiasi | TD16 | imponibile (aliquota IT) | Sì |
| UE | BENI | TD18 | imponibile (aliquota IT) | Sì |
| UE | SERVIZI | TD17 | imponibile (aliquota IT) | Sì |
| Extra-UE | SERVIZI | TD17 | imponibile (aliquota IT) | Sì |
| Extra-UE | BENI (post-dogana) | TD19 | imponibile (aliquota IT) | Sì |
| San Marino con IVA | qualsiasi | TD28 (comunicazione) | da fattura | No |
| San Marino senza IVA | BENI | TD19 | imponibile (aliquota IT) | Sì |
| San Marino senza IVA | SERVIZI | TD19 | imponibile (aliquota IT) | Sì |
| N7 (OSS) | qualsiasi | nessuna | N7 | No |

### Matrice delle regole — Vendite (FATTURA_ATTIVA)

| Nazione cliente | Tipo Merce | → Natura | → Note |
|----------------|-----------|----------|--------|
| IT | qualsiasi | da aliquota/natura manuale | Fatturazione ordinaria |
| UE (B2B) | BENI | N3.2 (cessione intra) | Non imponibile |
| UE (B2B) | SERVIZI | N2.1 (fuori campo, art. 7-ter) | Servizi generici |
| Extra-UE | BENI | N3.1 (esportazione) | Non imponibile |
| Extra-UE | SERVIZI | N2.1 (fuori campo) | Servizi generici |

### Note su importazioni con bolletta doganale

L'importazione di beni extra-UE con sdoganamento è **fuori scope** per l'autofattura: l'IVA viene versata in dogana e la bolletta doganale viene registrata direttamente nel registro acquisti. Il caso TD19 si applica solo a beni extra-UE **già in libera circolazione** in Italia (es. da deposito IVA). In modalità avanzata, l'utente può registrare manualmente la bolletta doganale come operazione ordinaria.

### Note su San Marino

Per acquisti da San Marino, il trattamento dipende dalla presenza di IVA in fattura:
- **Con IVA esposta**: il compratore italiano invia TD28 a SDI come comunicazione. Non è un'autofattura ma una segnalazione. Il sistema la genera come operazione collegata con `tipoDocumentoSdi: TD28`.
- **Senza IVA**: il compratore italiano emette autofattura con TD19 (sia per beni che servizi, per le specifiche AdE).

### Logica di override (modalità avanzata)

Se l'utente sovrascrive la natura o il tipo documento, il classifier:
1. Accetta l'override
2. Esegue validation e genera `warnings` se incoerente
3. Non blocca mai — il commercialista sa cosa fa

---

## 4. Autofattura e Doppia Registrazione

### Generazione Autofattura

Quando il classifier restituisce `richiedeAutofattura: true`, il modulo `autofattura.ts` crea una nuova Operazione collegata via `operazioneOrigineId`, all'interno della stessa transazione Prisma:

```typescript
{
  societaId,
  dataOperazione,                    // stessa data
  descrizione: `Integrazione ${tipoDoc} - ${descrizioneOriginale}`,
  importoImponibile,                 // stesso imponibile
  aliquotaIva: 22,                   // aliquota italiana applicabile
  importoIva,                        // calcolato: imponibile × aliquota
  tipoDocumentoSdi,                  // TD16/17/18/19/TD28
  tipoMerce,                         // copiato dall'operazione originale
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

Il sistema assegna automaticamente il prossimo numero progressivo per registro + anno. Il protocollo è per anno solare. In caso di cancellazione di un'operazione, il protocollo **non viene riassegnato** — i buchi sono ammessi e vengono annotati come "annullato" nel registro (prassi fiscale italiana: i numeri di protocollo non possono essere riutilizzati).

---

## 5. Plafond Esportatori Abituali

### Due flussi distinti

Il plafond ha due lati:

1. **Costruzione del plafond**: le operazioni di esportazione/cessione intra-UE (N3.1, N3.2, N3.4, art. 8/8-bis/9) generano il plafond disponibile per l'anno successivo (metodo fisso) o per i 12 mesi successivi (metodo mobile).

2. **Utilizzo del plafond**: gli acquisti effettuati con dichiarazione d'intento (N3.5 sulla fattura del fornitore) consumano il plafond disponibile. Questo è il flusso tracciato da `MovimentoPlafond`.

### Flusso utilizzo

```
Configurazione (una tantum, modalità avanzata)
  └─ L'utente attiva il plafond per l'anno
     imposta: metodo (fisso/mobile), importo disponibile

Acquisto con natura N3.5 salvato
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

### Ricalcolo plafond mobile

Per il metodo mobile, `importoDisponibile` viene **ricalcolato on-demand** ogni volta che si salva un'operazione N3.5, sommando le esportazioni (N3.1, N3.2, N3.4) dei 12 mesi precedenti alla data dell'operazione. Il valore su `Plafond.importoDisponibile` è un **cache/snapshot** aggiornato ad ogni ricalcolo. Se il plafond si riduce e `importoUtilizzato > importoDisponibile`, il sistema genera un warning di splafonamento retroattivo.

### UI (solo modalità avanzata)

- Widget nel dashboard/bilancio: barra progresso plafond (utilizzato/disponibile)
- Alert visivo quando si supera l'80%
- Storico movimenti plafond consultabile

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

| Regola | Condizione | Azione | Note |
|--------|-----------|--------|------|
| Natura vs Aliquota | naturaIva presente (escluso N6.x) e aliquotaIva > 0 sull'operazione originale | Warning: "Natura IVA implica aliquota 0%" | Non si applica alle autofatture generate, che hanno sia natura (ereditata) che aliquota > 0 |
| Natura vs Nazione | N6.x con fornitore estero | Warning: "RC interno (N6.x) non compatibile con fornitore estero" | |
| TD vs Nazione | TD18 con fornitore extra-UE | Errore: "TD18 è solo per beni intra-UE, usare TD19" | |
| TD vs Tipo Merce | TD18 con SERVIZI | Warning: "TD18 è per beni, servizi usano TD17" | |
| Split + RC | splitPayment true + natura N6.x | Warning: "Reverse charge ha priorità su split payment" | |
| Plafond N3.5 | N3.5 senza plafond attivo | Warning: "Operazione N3.5 senza plafond configurato" | |
| Nazione mancante | Fornitore senza nazione + operazione con natura estera | Errore: "Impostare la nazione del fornitore" | |

### Casi limite gestiti

1. **Fattura mista beni+servizi da fornitore UE**: si usa il tipo prevalente per importo. In avanzata l'utente può splittare in due operazioni.

2. **Fornitore San Marino con IVA**: TD28 (comunicazione a SDI), nessuna doppia registrazione. Il sistema genera un'operazione collegata con TD28 per la comunicazione.

3. **Fornitore San Marino senza IVA**: autofattura TD19 (sia beni che servizi, come da specifiche AdE), con doppia registrazione.

4. **Importazione beni extra-UE con bolletta doganale**: fuori scope autofattura. L'utente registra la bolletta doganale come operazione ordinaria nel registro acquisti. In modalità avanzata un hint ricorda questa possibilità.

5. **Modifica nazione fornitore dopo registrazione operazioni**: le operazioni esistenti NON vengono ricalcolate automaticamente — warning all'utente "Ci sono X operazioni registrate con il precedente trattamento IVA".

6. **Cancellazione operazione con autofattura collegata**: il codice applicativo cancella prima le autofatture (con conferma utente), poi l'operazione. I protocolli IVA restano assegnati (annotati come "annullato").

7. **Modifica operazione con autofattura collegata**: rigenera l'autofattura con i nuovi importi nella stessa transazione.

8. **N7 — IVA assolta in altro stato UE (OSS)**: nessuna autofattura, nessuna doppia registrazione. Solo annotazione nel registro vendite. Presente nella matrice del classifier.

9. **Protocolli IVA dopo cancellazione**: i numeri non vengono riutilizzati. I buchi nel registro vengono annotati come "annullato" (conforme alla prassi fiscale italiana).
