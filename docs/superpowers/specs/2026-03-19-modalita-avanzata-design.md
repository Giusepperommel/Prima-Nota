# Design Spec — Modalità Avanzata (Fase 1)

**Data:** 2026-03-19
**Stato:** Approvato per implementazione
**Target:** SRL di servizi senza dipendenti e senza magazzino
**Scope:** Fase 1 della roadmap bilancio (vedi `docs/knowledge-base-bilancio-italiano.md`)

---

## 1. Obiettivo

Introdurre una **modalità avanzata switchabile** che consenta a un imprenditore attento o a un commercialista di arricchire le operazioni già inserite con i dati contabili necessari per redigere un bilancio provvisorio conforme alla normativa italiana (artt. 2423-2435-ter Codice Civile).

La modalità base (attuale) rimane invariata. Nessun dato esistente viene toccato.

---

## 2. I Tre Livelli

| Livello | Attivazione | Chi lo usa | Cosa sblocca |
|---------|------------|-----------|-------------|
| **Base** | Default | Imprenditore quotidiano | App attuale, nessun cambiamento |
| **Avanzata** | Toggle nel footer della sidebar | Imprenditore attento / commercialista | Tab "Dati Contabili" nelle form, sezione "Bilancio" nel menu |
| **Commercialista** | Switch nelle impostazioni account | Commercialista / utente esperto | Modifica piano dei conti, registrazioni manuali, export |

---

## 3. Architettura Dati

### Principio guida
**Approccio B — Estensione del modello esistente.** Tutti i nuovi campi sono `nullable`. Le operazioni esistenti rimangono valide e immutate. La modalità avanzata aggiunge informazioni sopra a quelle esistenti, non le sostituisce mai.

### Convenzione `@map` / `@@map`
Tutto il progetto usa `@map("snake_case")` sui campi e `@@map("nome_tabella")` sui modelli. Tutti i nuovi campi e modelli seguono obbligatoriamente questa convenzione.

---

### 3.1 Modifiche al modello `Utente`

Aggiungere due campi al modello esistente in `prisma/schema.prisma`:

```prisma
model Utente {
  // ... campi esistenti invariati ...
  modalitaAvanzata       Boolean  @default(false) @map("modalita_avanzata")
  modalitaCommercialista Boolean  @default(false) @map("modalita_commercialista")
}
```

**Thread del valore nella UI:** `modalitaAvanzata` e `modalitaCommercialista` vengono aggiunti al token JWT di NextAuth nel callback `session` in `src/lib/auth.ts` (pattern già usato per `ruolo`, `socioId`, `societaId`). Il `SessionUser` type in `src/types/index.ts` viene esteso di conseguenza. La sidebar e le form leggono il valore dal hook `useSession()` lato client — nessuna prop aggiuntiva necessaria.

**Migrazione:** `prisma migrate dev --name add-modalita-avanzata`

---

### 3.2 Modifiche al modello `Operazione`

Nuovi campi nullable, nessun campo esistente viene modificato o rimosso.

> **Nota nomenclatura:** L'enum `StatoPagamento` esiste già nello schema con valori `PREVISTO`, `EFFETTUATO`, `ANNULLATO` (usato dal modello `Pagamento` dentro `PianoPagamento`). Il nuovo enum per lo stato pagamento dell'operazione è denominato **`StatoPagamentoFattura`** per evitare collisioni.

> **Nota relazione Ritenuta:** La back-relation `ritenuta Ritenuta?` su `Operazione` è inferita automaticamente da Prisma grazie al campo `operazioneId @unique` sul modello `Ritenuta`. Non va dichiarata esplicitamente nel blocco di `Operazione`.

> **Nota relazione RateoRisconto:** `Operazione` ha un FK opzionale `rateoRiscontoId` verso `RateoRisconto`. La relazione è molti-a-uno (più operazioni possono riferirsi allo stesso rateo/risconto calcolato). La back-relation su `RateoRisconto` è `operazioni Operazione[]`.

```prisma
model Operazione {
  // ... campi esistenti invariati ...

  // Anagrafica
  fornitoreId            Int?      @map("fornitore_id")
  fornitore              Anagrafica? @relation("FornitoreOperazioni", fields: [fornitoreId], references: [id])
  clienteId              Int?      @map("cliente_id")
  cliente                Anagrafica? @relation("ClienteOperazioni", fields: [clienteId], references: [id])

  // Competenza economica (principio di competenza ex art. 2423-bis C.C.)
  dataCompetenzaInizio   DateTime? @map("data_competenza_inizio") @db.Date
  dataCompetenzaFine     DateTime? @map("data_competenza_fine")   @db.Date
  // esercizioCompetenza è derivabile da dataCompetenzaInizio — non memorizzato

  // Stato pagamento (distinto da PianoPagamento che gestisce le rate)
  // Per operazioni senza PianoPagamento, questo campo traccia l'incasso/pagamento semplice.
  // Per operazioni con PianoPagamento, il master stato rimane su PianoPagamento.
  statoPagamentoFattura  StatoPagamentoFattura? @map("stato_pagamento_fattura")
  dataPagamento          DateTime?              @map("data_pagamento")         @db.Date
  importoPagato          Decimal?               @map("importo_pagato")         @db.Decimal(10, 2)

  // Piano dei conti
  codiceContoId          Int?      @map("codice_conto_id")
  codiceConto            PianoDeiConti? @relation(fields: [codiceContoId], references: [id])

  // IVA avanzata
  naturaOperazioneIva    NaturaIva?       @map("natura_operazione_iva")
  tipoDocumentoSdi       TipoDocumentoSdi? @map("tipo_documento_sdi")
  protocolloIva          String?  @map("protocollo_iva") @db.VarChar(20)
  // Formato: "{registroIva}/{anno}/{progressivo}" es. "ACQ/2026/00001"
  registroIva            RegistroIva?     @map("registro_iva")
  dataRegistrazione      DateTime?        @map("data_registrazione") @db.Date
  splitPayment           Boolean?         @map("split_payment")

  // Ritenuta d'acconto (campi sommario; dettaglio in modello Ritenuta)
  soggettoARitenuta      Boolean?  @map("soggetto_a_ritenuta")  @default(false)
  importoRitenuta        Decimal?  @map("importo_ritenuta")     @db.Decimal(10, 2)
  importoNettoRitenuta   Decimal?  @map("importo_netto_ritenuta") @db.Decimal(10, 2)
  // aliquota, base imponibile e dettaglio versamento F24 → modello Ritenuta
  // Questi due campi sono cache di lettura rapida; Ritenuta è la fonte autoritativa.

  // Bollo virtuale (DPR 642/1972 — €2 su documenti senza IVA > €77,47)
  bolloVirtuale          Boolean?  @map("bollo_virtuale")  @default(false)
  importoBollo           Decimal?  @map("importo_bollo")   @db.Decimal(5, 2)

  // Rateo/risconto calcolato dalla chiusura esercizio
  rateoRiscontoId        Int?      @map("rateo_risconto_id")
  rateoRisconto          RateoRisconto? @relation(fields: [rateoRiscontoId], references: [id])

  @@unique([societaId, protocolloIva])
  // protocolloIva nullable: MySQL tratta NULL come distinto, quindi più NULL sullo stesso societaId sono permessi.
}

enum StatoPagamentoFattura {
  NON_PAGATO
  PAGATO
  PARZIALMENTE_PAGATO
}

enum NaturaIva {
  N1
  N2_1
  N2_2
  N3_1
  N3_2
  N3_3
  N3_4
  N3_5
  N3_6
  N4
  N5
  N6_1
  N6_2
  N6_3
  N6_4
  N6_5
  N6_6
  N6_7
  N6_8
  N6_9
  N7
}

enum TipoDocumentoSdi {
  TD01
  TD02
  TD03
  TD04
  TD05
  TD06
  TD07
  TD08
  TD09
  TD16
  TD17
  TD18
  TD19
  TD20
  TD21
  TD22
  TD23
  TD24
  TD25
  TD26
  TD27
  TD28
  TD29
}

enum RegistroIva {
  VENDITE
  ACQUISTI
  CORRISPETTIVI
}
```

> **Nota TD29:** Introdotto con tracciato SDI v1.9, obbligatorio dal 1° aprile 2025 (Provvedimento AdE 31/01/2025). È la comunicazione di omessa/irregolare fatturazione da parte del cessionario.

> **`statoPagamentoFattura` vs `PianoPagamento`:** Per operazioni con `PianoPagamento` collegato, il master stato del pagamento è `PianoPagamento.stato`. `statoPagamentoFattura` riguarda solo operazioni senza piano di pagamento (es. fatture pagate in un'unica soluzione). Nelle form, se esiste un `PianoPagamento`, il campo `statoPagamentoFattura` non viene mostrato.

---

### 3.3 Nuovo modello `Anagrafica`

```prisma
model Anagrafica {
  id                 Int      @id @default(autoincrement())
  societaId          Int      @map("societa_id")
  societa            Societa  @relation(fields: [societaId], references: [id])

  // Dati identificativi
  denominazione      String   @map("denominazione")        @db.VarChar(255)
  partitaIva         String?  @map("partita_iva")          @db.VarChar(11)
  codiceFiscale      String?  @map("codice_fiscale")       @db.VarChar(16)
  tipoSoggetto       TipoSoggetto @map("tipo_soggetto")
  tipo               TipoAnagrafica @map("tipo")

  // Sede
  indirizzo          String?  @map("indirizzo")            @db.VarChar(255)
  cap                String?  @map("cap")                  @db.VarChar(10)
  citta              String?  @map("citta")                @db.VarChar(100)
  provincia          String?  @map("provincia")            @db.VarChar(2)
  nazione            String?  @map("nazione")              @db.VarChar(2)  @default("IT")

  // SDI
  codiceDestinatario String?  @map("codice_destinatario")  @db.VarChar(7)
  pec                String?  @map("pec")                  @db.VarChar(255)
  regimeFiscale      String?  @map("regime_fiscale")       @db.VarChar(4)
  // RF01-RF19 (RF19=forfettario), RF20=transfrontaliero (dal 1/1/2025, Dir. UE 2020/285)

  // Ritenuta
  soggettoARitenuta  Boolean  @default(false) @map("soggetto_a_ritenuta")
  regimeForfettario  Boolean  @default(false) @map("regime_forfettario")
  // Se true: nessuna ritenuta (Art. 1 c.67 L. 190/2014 + RF20)
  tipoRitenuta       TipoRitenuta? @map("tipo_ritenuta")

  // Metadata
  autoCreataOcr      Boolean  @default(false) @map("auto_creata_ocr")
  createdAt          DateTime @default(now())  @map("created_at")
  updatedAt          DateTime @updatedAt        @map("updated_at")

  // Relazioni
  operazioniFornitore Operazione[] @relation("FornitoreOperazioni")
  operazioniCliente   Operazione[] @relation("ClienteOperazioni")
  ritenute            Ritenuta[]

  // Un fornitore/cliente è unico per P.IVA dentro una società.
  // NULL in partitaIva è ammesso (es. fornitori esteri, privati).
  // MySQL tratta i NULL come distinti negli indici unique: più record
  // con partitaIva=null per lo stesso societaId sono permessi.
  @@unique([societaId, partitaIva])
  @@map("anagrafiche")
}

enum TipoSoggetto {
  AZIENDA        // SRL, SPA, SNC ecc. — no ritenuta
  PERSONA_FISICA
  PROFESSIONISTA // lavoro autonomo — ritenuta 20%
}

enum TipoAnagrafica {
  FORNITORE
  CLIENTE
  ENTRAMBI
}

enum TipoRitenuta {
  LAVORO_AUTONOMO  // 20% su 100% — Art. 25 DPR 600/73, codice tributo 1040
  PROVVIGIONI      // 23% su 50% (senza struttura) o 20% (con struttura) — cod. 1038
  OCCASIONALE      // 20% su 100%
  DIRITTI_AUTORE   // 20% su 75% (≥35 anni) o 60% (<35 anni)
}
```

> **Validazione P.IVA:** Algoritmo checksum ufficiale AdE (somma cifre dispari + cifre pari×2 ridotte se >9; check digit = (10 − somma mod 10) mod 10). Verifica sincrona lato client e lato API.

> **`@@unique` con NULL:** La constraint `@@unique([societaId, partitaIva])` con `partitaIva` nullable funziona correttamente in MySQL: i NULL sono considerati distinti quindi più record con `partitaIva = null` per lo stesso `societaId` sono permessi. La ricerca per P.IVA durante l'import XML usa solo match esatto su valori non-null.

> **Aggiunta back-relation a `Societa`:** Il modello `Societa` deve aggiungere `anagrafiche Anagrafica[]`.

---

### 3.4 Nuovo modello `PianoDeiConti`

```prisma
model PianoDeiConti {
  id              Int      @id @default(autoincrement())
  societaId       Int      @map("societa_id")
  societa         Societa  @relation(fields: [societaId], references: [id])

  codice          String   @map("codice")       @db.VarChar(10)
  // Formato: "MMM.SSS" (mastro 3 cifre + punto + sottoconto 3 cifre), es. "310.001"
  descrizione     String   @map("descrizione")  @db.VarChar(255)
  tipo            TipoConto @map("tipo")
  voceSp          String?  @map("voce_sp")      @db.VarChar(20)
  // Voce Stato Patrimoniale, es. "D.7", "C.II.1", "B.7" (null per conti solo CE)
  voceCe          String?  @map("voce_ce")      @db.VarChar(20)
  // Voce Conto Economico, es. "B.7", "A.1" (null per conti solo SP)
  naturaSaldo     NaturaSaldo @map("natura_saldo")
  attivo          Boolean  @default(true)  @map("attivo")
  preConfigurato  Boolean  @default(true)  @map("pre_configurato")
  modificabile    Boolean  @default(false) @map("modificabile")
  // true solo dopo attivazione modalità Commercialista

  operazioni      Operazione[]

  @@unique([societaId, codice])
  @@map("piano_dei_conti")
}

enum TipoConto {
  PATRIMONIALE_ATTIVO
  PATRIMONIALE_PASSIVO
  ECONOMICO_COSTO
  ECONOMICO_RICAVO
  ORDINE
}

enum NaturaSaldo {
  DARE
  AVERE
}
```

> **Conti bifacciali (es. `130.001 Erario c/IVA`):** Hanno sia `voceSp` per il lato credito (es. `"C.II.5-bis"`) che una voce alternativa per il lato debito (es. `"D.12"`). La logica del bilancio provvisorio calcola il saldo a runtime e assegna il conto alla voce corretta in base al segno. Questo non è memorizzato nel modello.

> **Standard adottato:** Piano dei conti CEE `MMM.SSS`, de facto più diffuso tra i software gestionali italiani. Non esiste uno standard OIC ufficiale (OIC pubblica criteri di classificazione in OIC 12, non codici numerici).

> **Aggiunta back-relation a `Societa`:** Il modello `Societa` deve aggiungere `pianoDeiConti PianoDeiConti[]`.

---

### 3.5 Nuovo modello `Ritenuta`

```prisma
model Ritenuta {
  id                    Int        @id @default(autoincrement())
  societaId             Int        @map("societa_id")
  societa               Societa    @relation(fields: [societaId], references: [id])
  operazioneId          Int        @unique @map("operazione_id")
  operazione            Operazione @relation(fields: [operazioneId], references: [id])
  anagraficaId          Int        @map("anagrafica_id")
  anagrafica            Anagrafica @relation(fields: [anagraficaId], references: [id])

  // Calcolo
  tipoRitenuta          TipoRitenuta @map("tipo_ritenuta")
  aliquota              Decimal    @map("aliquota")               @db.Decimal(5, 2)
  // 20.00 (lavoro autonomo/occasionale) o 23.00 (provvigioni)
  percentualeImponibile Decimal    @map("percentuale_imponibile") @db.Decimal(5, 2)
  // 100% (autonomo), 75% (diritti autore ≥35), 60% (<35), 50% (provvigioni senza struttura), 20% (con struttura)
  importoLordo          Decimal    @map("importo_lordo")          @db.Decimal(10, 2)
  baseImponibile        Decimal    @map("base_imponibile")        @db.Decimal(10, 2)
  importoRitenuta       Decimal    @map("importo_ritenuta")       @db.Decimal(10, 2)
  importoNetto          Decimal    @map("importo_netto")          @db.Decimal(10, 2)
  rivalsaInps           Decimal?   @map("rivalsa_inps")           @db.Decimal(10, 2)
  cassaPrevidenza       Decimal?   @map("cassa_previdenza")       @db.Decimal(10, 2)

  // Scadenza F24
  meseCompetenza        Int        @map("mese_competenza")   // 1–12
  annoCompetenza        Int        @map("anno_competenza")
  // scadenzaVersamento = sempre il 16 del mese (meseCompetenza + 1), anno adeguato
  // Calcolato a runtime, non memorizzato (evita drift)
  codiceTributo         String     @map("codice_tributo") @db.VarChar(4)
  // "1040" per lavoro autonomo, "1038" per provvigioni (Art. 18 D.Lgs. 241/1997)
  dataVersamento        DateTime?  @map("data_versamento")
  importoVersato        Decimal?   @map("importo_versato")   @db.Decimal(10, 2)
  statoVersamento       StatoVersamento @default(DA_VERSARE) @map("stato_versamento")

  // Certificazione Unica
  cuEmessa              Boolean    @default(false) @map("cu_emessa")
  cuDataEmissione       DateTime?  @map("cu_data_emissione")

  createdAt             DateTime   @default(now()) @map("created_at")

  @@map("ritenute")
}

enum StatoVersamento {
  DA_VERSARE
  VERSATO
  SCADUTO
}
```

> **Aliquote ritenuta 2025 (Art. 25 DPR 600/73 — invariate):**
> - Lavoro autonomo abituale e occasionale: **20% su 100%** — cod. tributo **1040**
> - Provvigioni senza struttura: **23% su 50%** — cod. tributo **1038**
> - Provvigioni con struttura: **23% su 20%** — cod. tributo **1038**
>
> **Scadenza:** 16 del mese successivo al pagamento (Art. 18 D.Lgs. 241/1997).
> **CU:** 16 marzo (o 31 marzo / 30 aprile per soli redditi autonomi).
> **Modello 770:** 31 ottobre.
>
> **Riforma:** D.Lgs. 33/2025 (Testo Unico Versamenti) entra in vigore il **1° gennaio 2027**. Aliquote invariate fino ad allora.

---

### 3.6 Nuovo modello `RateoRisconto`

```prisma
model RateoRisconto {
  id                       Int        @id @default(autoincrement())
  societaId                Int        @map("societa_id")
  societa                  Societa    @relation(fields: [societaId], references: [id])
  chiusuraEsercizioId      Int        @map("chiusura_esercizio_id")
  chiusuraEsercizio        ChiusuraEsercizio @relation(fields: [chiusuraEsercizioId], references: [id])

  tipo                     TipoRateoRisconto @map("tipo")
  descrizione              String     @map("descrizione")          @db.VarChar(255)
  importoOriginario        Decimal    @map("importo_originario")   @db.Decimal(10, 2)
  dataInizioCompetenza     DateTime   @map("data_inizio_competenza") @db.Date
  dataFineCompetenza       DateTime   @map("data_fine_competenza")   @db.Date
  dataManifestazioneFin    DateTime   @map("data_manifestazione_fin") @db.Date
  importoCalcolato         Decimal    @map("importo_calcolato")    @db.Decimal(10, 2)
  esercizioRiferimento     Int        @map("esercizio_riferimento")

  voceSp                   String?    @map("voce_sp") @db.VarChar(10)
  // "D)" per ratei/risconti attivi, "E)" per passivi
  contoCeCollegato         String?    @map("conto_ce_collegato") @db.VarChar(10)
  // Codice conto origine, es. "320.001"

  automatico               Boolean    @default(true)  @map("automatico")
  stornato                 Boolean    @default(false) @map("stornato")
  stornoEsercizio          Int?       @map("storno_esercizio")

  // Relazione inversa: le operazioni che hanno generato questo rateo/risconto
  operazioni               Operazione[]

  createdAt                DateTime   @default(now()) @map("created_at")

  @@map("ratei_risconti")
}

enum TipoRateoRisconto {
  RATEO_ATTIVO     // ricavo maturato non ancora incassato → SP D) Attivo
  RATEO_PASSIVO    // costo maturato non ancora pagato → SP E) Passivo
  RISCONTO_ATTIVO  // costo pagato di competenza futura → SP D) Attivo
  RISCONTO_PASSIVO // ricavo incassato di competenza futura → SP E) Passivo
}
```

> **Formula (Art. 2424-bis c. 5 C.C.):**
> ```
> Risconto = (Importo / GiorniTotaliContratto) × GiorniCompetenzaFutura
> Rateo    = (Importo / GiorniTotaliContratto) × GiorniMaturatiNonPagati
> ```

---

### 3.7 Nuovo modello `ChiusuraEsercizio`

```prisma
model ChiusuraEsercizio {
  id                       Int        @id @default(autoincrement())
  societaId                Int        @map("societa_id")
  societa                  Societa    @relation(fields: [societaId], references: [id])

  anno                     Int        @map("anno")
  dataApertura             DateTime   @map("data_apertura")  @db.Date
  dataChiusura             DateTime   @map("data_chiusura")  @db.Date
  stato                    StatoChiusura @default(IN_CORSO)  @map("stato")

  // Saldi iniziali (inseriti manualmente al primo utilizzo)
  saldoBancaIniziale       Decimal?   @map("saldo_banca_iniziale")        @db.Decimal(12, 2)
  saldoCassaIniziale       Decimal?   @map("saldo_cassa_iniziale")        @db.Decimal(12, 2)
  capitaleSociale          Decimal?   @map("capitale_sociale")            @db.Decimal(12, 2)
  riservaLegale            Decimal?   @map("riserva_legale")              @db.Decimal(12, 2)
  riservaStatutaria        Decimal?   @map("riserva_statutaria")          @db.Decimal(12, 2)
  riservaEstraordinaria    Decimal?   @map("riserva_straordinaria")       @db.Decimal(12, 2)
  utiliPerditePortatiANuovo Decimal?  @map("utili_perdite_portati_a_nuovo") @db.Decimal(12, 2)

  // Saldi finali (calcolati, aggiornati al momento della chiusura)
  saldoBancaFinale         Decimal?   @map("saldo_banca_finale")  @db.Decimal(12, 2)
  saldoCassaFinale         Decimal?   @map("saldo_cassa_finale")  @db.Decimal(12, 2)
  risultatoEsercizio       Decimal?   @map("risultato_esercizio") @db.Decimal(12, 2)

  rateiRisconti            RateoRisconto[]
  liquidazioniIva          LiquidazioneIva[]

  dataCreazione            DateTime   @default(now())  @map("data_creazione")
  dataChiusuraEffettiva    DateTime?  @map("data_chiusura_effettiva")

  @@unique([societaId, anno])
  // Un solo record ChiusuraEsercizio per società per anno
  @@map("chiusure_esercizio")
}

enum StatoChiusura {
  IN_CORSO
  CHIUSO
  APPROVATO
}
```

> **Aggiunta back-relation a `Societa`:** Il modello `Societa` deve aggiungere `chiusureEsercizio ChiusuraEsercizio[]`.

---

### 3.8 Nuovo modello `LiquidazioneIva`

```prisma
model LiquidazioneIva {
  id                       Int      @id @default(autoincrement())
  societaId                Int      @map("societa_id")
  societa                  Societa  @relation(fields: [societaId], references: [id])
  chiusuraEsercizioId      Int?     @map("chiusura_esercizio_id")
  chiusuraEsercizio        ChiusuraEsercizio? @relation(fields: [chiusuraEsercizioId], references: [id])

  tipo                     TipoLiquidazione @map("tipo")
  periodo                  Int      @map("periodo")  // mese (1-12) o trimestre (1-4)
  anno                     Int      @map("anno")
  // scadenzaLipe e scadenzaVersamento sono calcolate a runtime dal tipo+periodo+anno
  // (evita drift). Valori di riferimento:
  // LIPE: Q1→31/05, Q2→16/09, Q3→30/11, Q4→dichiarazione annuale
  // Versamento: 16 del mese successivo (mensili) o del mese dopo il trimestre (trimestrali)

  // Dati IVA del periodo
  ivaEsigibile             Decimal  @map("iva_esigibile")            @db.Decimal(12, 2)
  ivaDetraibile            Decimal  @map("iva_detraibile")           @db.Decimal(12, 2)
  saldo                    Decimal  @map("saldo")                    @db.Decimal(12, 2)
  creditoPeriodoPrecedente Decimal  @default(0) @map("credito_periodo_precedente") @db.Decimal(12, 2)
  accontoVersato           Decimal  @default(0) @map("acconto_versato")            @db.Decimal(12, 2)
  importoVersato           Decimal? @map("importo_versato")          @db.Decimal(12, 2)

  codiceTributo            String?  @map("codice_tributo") @db.VarChar(4)
  // Mensili: 6001-6012 (uno per mese), Trimestrali: 6031-6034, Acconto: 6013, Saldo: 6099
  dataVersamento           DateTime? @map("data_versamento")
  statoVersamento          StatoVersamento @default(DA_VERSARE) @map("stato_versamento")

  lipeInviata              Boolean  @default(false) @map("lipe_inviata")
  lipeDataInvio            DateTime? @map("lipe_data_invio")

  createdAt                DateTime @default(now()) @map("created_at")

  @@unique([societaId, tipo, periodo, anno])
  @@map("liquidazioni_iva")
}

enum TipoLiquidazione {
  MENSILE
  TRIMESTRALE
}
```

> **Soglie liquidazione IVA (Art. 7 DPR 542/1999 + Art. 11 DPR 435/2001):**
> - Trimestrale (opzionale): servizi ≤ €400.000/anno oppure beni ≤ €700.000/anno
> - Mensile obbligatoria sopra tali soglie
> - Maggiorazione trimestrali: **+1%** su ogni versamento
> - Soglia minima versamento periodico: **€100** (aggiornata 2025, precedentemente €25,82)
>
> **Acconto IVA dicembre (Art. 6 L. 405/1990):** 27 dicembre, **88%**, tre metodi (storico/previsionale/analitico), soglia esonero €103,29.
>
> **LIPE (Art. 21-bis D.L. 193/2016):** Q1→31/05, Q2→16/09, Q3→30/11.
>
> **Riforma:** D.Lgs. 10/2026 (Testo Unico IVA) efficace dal **1° gennaio 2027**.

---

### 3.9 Back-relations da aggiungere al modello `Societa`

```prisma
model Societa {
  // ... campi esistenti invariati ...
  anagrafiche       Anagrafica[]
  pianoDeiConti     PianoDeiConti[]
  ritenute          Ritenuta[]
  rateiRisconti     RateoRisconto[]
  chiusureEsercizio ChiusuraEsercizio[]
  liquidazioniIva   LiquidazioneIva[]
}
```

---

## 4. Interfaccia Utente

### 4.1 Toggle Modalità Avanzata

**Posizione:** Footer della sidebar (`src/components/layout/app-sidebar.tsx`), sopra il blocco nome-utente/logout.

**Comportamento:**
- Label "Avanzata" + componente `Switch` di Shadcn/ui
- Quando OFF: sidebar e form identiche a oggi
- Quando ON:
  - Compare il gruppo collassabile "Bilancio" nel menu (con icona `BookOpen` di Lucide)
  - Il footer mostra un indicatore verde con punto "● AVANZATA"
  - Le form operazione mostrano il tab "Dati Contabili"
- Il cambio di stato chiama `PATCH /api/utente/preferenze` (ottimistic update) e aggiorna la sessione NextAuth tramite `router.refresh()`.

### 4.2 Toggle Modalità Commercialista

**Posizione:** Nuova pagina `/impostazioni/account`

Questa route non esiste ancora. Controllato in `src/middleware.ts`: non ci sono route `/impostazioni/*` definite — nessun conflitto. La route va aggiunta come percorso protetto standard (auth richiesta, non richiede `societaId` per permettere anche accesso prima del setup).

**Comportamento:**
- Card "Modalità Commercialista" con elenco funzionalità sbloccate
- Switch con `AlertDialog` di conferma prima dell'attivazione
- Chiama lo stesso `PATCH /api/utente/preferenze` con `{ modalitaCommercialista: boolean }`

### 4.3 Menu Bilancio (sidebar)

Visibile solo con `modalitaAvanzata = true`. Gruppo collassabile con lo stesso pattern di "Configurazione" in `app-sidebar.tsx`. Icone da `lucide-react`:

```
▾ Bilancio                    (BookOpen)
   Anagrafiche                (Users)
   Piano dei Conti            (ListTree)
   Registri IVA               (FileText)
   Ritenute                   (Scissors)
   Chiusura Esercizio         (CalendarCheck)
   Bilancio Provvisorio       (BarChart3)
```

### 4.4 Tab "Dati Contabili" nella form Operazione

Visibile in `operazione-form.tsx` e nella pagina di dettaglio `/operazioni/[id]` quando `session.user.modalitaAvanzata = true`.

**Struttura:** componente `Tabs` Shadcn/ui con due tab — il tab esistente (rinominato "Generale") e il nuovo "Dati Contabili".

**Campi del tab "Dati Contabili":**

| Campo | Tipo | Note |
|-------|------|------|
| Fornitore / Cliente | Select con ricerca | Collega ad `Anagrafica`; pulsante "Crea nuovo" apre dialog |
| Competenza dal | DatePicker | `dataCompetenzaInizio` |
| Competenza al | DatePicker | `dataCompetenzaFine` |
| Stato pagamento | RadioGroup | Visibile solo se operazione senza `PianoPagamento` |
| Data pagamento | DatePicker | Visibile se stato ≠ NON_PAGATO |
| Importo pagato | Input numerico | Visibile solo se PARZIALMENTE_PAGATO |
| Conto (Piano dei Conti) | Select con ricerca | Pre-suggerito da mapping categoria→conto (sez. 6.2) |
| Natura IVA | Select | Visibile solo se `importoIva = 0` |
| Tipo documento SDI | Select | TD01–TD29 (v1.9 AdE, obbligatorio dal 1/4/2025) |
| Registro IVA | Select | Vendite / Acquisti / Corrispettivi |
| Split Payment | Checkbox | Visibile se cliente è ente pubblico |

**Sezione Ritenuta** (visibile se `soggettoARitenuta = true` o OCR rileva `<Ritenuta>`):

| Campo | Tipo |
|-------|------|
| Soggetto a ritenuta | Switch |
| Tipo ritenuta | Select (LAVORO_AUTONOMO / PROVVIGIONI / OCCASIONALE / DIRITTI_AUTORE) |
| Aliquota | Read-only (calcolato) |
| % base imponibile | Read-only (calcolato) |
| Base imponibile | Read-only (calcolato) |
| Importo ritenuta | Read-only (calcolato) |
| Netto a pagare | Read-only (calcolato) |
| Rivalsa INPS 4% | Input opzionale |
| Cassa previdenza | Input opzionale |

**Regola blocco forfettario:** Se `Anagrafica.regimeForfettario = true`, il switch "Soggetto a ritenuta" è disabilitato con tooltip: *"Fornitore in regime forfettario (Art. 1 c. 67 L. 190/2014) — ritenuta non applicabile."*

**Body di `PATCH /api/operazioni/[id]/dati-contabili`:**
```json
{
  "fornitoreId": 12,
  "clienteId": null,
  "dataCompetenzaInizio": "2026-03-01",
  "dataCompetenzaFine": "2026-03-31",
  "statoPagamentoFattura": "NON_PAGATO",
  "dataPagamento": null,
  "importoPagato": null,
  "codiceContoId": 45,
  "naturaOperazioneIva": null,
  "tipoDocumentoSdi": "TD01",
  "protocolloIva": "ACQ/2026/00001",
  "registroIva": "ACQUISTI",
  "dataRegistrazione": "2026-03-19",
  "splitPayment": false,
  "soggettoARitenuta": true,
  "importoRitenuta": 200.00,
  "importoNettoRitenuta": 800.00,
  "bolloVirtuale": false,
  "importoBollo": null,
  "rateoRiscontoId": null
}
```
Tutti i campi sono opzionali nel body (PATCH parziale). Autenticazione via `getSessionUser()` (pattern esistente). L'API verifica che l'operazione appartenga a `user.societaId`.

**Formato `protocolloIva`:** `"{REGISTRO}/{ANNO}/{PROGRESSIVO}"` es. `"ACQ/2026/00001"`. Il progressivo è a 5 cifre con zero-padding, per registro per anno. L'app suggerisce il prossimo numero disponibile ma l'utente può sovrascrivere. Unicità garantita da `@@unique([societaId, protocolloIva])` dichiarato nel blocco `model Operazione` (§3.2).

### 4.5 Pagina Bilancio Hub (`/bilancio`)

**Tab "Avanzamento"** (landing):
- Barra di avanzamento globale (% operazioni con `codiceContoId` non null)
- Checklist 5 fasi:
  1. Anagrafiche — N fornitori, M clienti
  2. Piano dei Conti — stato seed
  3. Imputazione operazioni — X/Y con dati contabili
  4. Ritenute — N da versare, M versate
  5. Chiusura Esercizio — saldi inseriti, ratei calcolati
- Ogni fase ha link diretto alla sezione corrispondente

**Tab "Bilancio Provvisorio"** → vedere sezione 4.10

### 4.6 Pagina Anagrafiche (`/bilancio/anagrafiche`)

- Tabella con colonne: Denominazione, P.IVA, Tipo, Regime, Ritenuta
- Badge `OCR` se `autoCreataOcr = true`
- Ricerca full-text su denominazione e P.IVA
- CRUD completo: crea, modifica, elimina
- Eliminazione bloccata con messaggio esplicito se anagrafica ha operazioni collegate

### 4.7 Pagina Piano dei Conti (`/bilancio/piano-dei-conti`)

**Modalità Avanzata:** albero navigabile, sola lettura, ricerca per codice/descrizione/voce bilancio.

**Modalità Commercialista:** aggiunta conti, inline edit descrizione/voce, eliminazione (solo conti non collegati ad operazioni), import/export CSV.

**Wizard primo accesso:** al primo clic sul menu "Piano dei Conti" con piano non ancora inizializzato, mostra dialog con:
- Step 1: conferma tipo attività (SRL di servizi — pre-selezionato)
- Step 2: preview anteprima conti da creare (~60 righe)
- Step 3: pulsante "Inizializza piano dei conti" → chiama `POST /api/piano-dei-conti/inizializza`

### 4.8 Pagina Registri IVA (`/bilancio/registri-iva`)

- Tre tab: Registro Acquisti / Registro Vendite / Corrispettivi
- Filtro anno + periodo
- Tabella con campi richiesti da Art. 23, 24, 25 DPR 633/72
- Export PDF con layout conforme
- Sezione Liquidazione IVA: saldo periodo, storico versamenti, prossima scadenza

### 4.9 Pagina Ritenute (`/bilancio/ritenute`)

- Tabella: percipiente, data operazione, lordo, ritenuta, netto, scadenza F24, stato
- Filtro stato (da versare / versato / scaduto)
- Alert proattivo: ritenute in scadenza entro 7 giorni
- Pulsante "Segna come versato" + input data versamento
- Riepilogo mensile per codice tributo (1040, 1038)
- **Non genera F24** — mostra i dati necessari per compilarlo esternamente

### 4.10 Workflow Chiusura Esercizio (`/bilancio/chiusura-esercizio`)

Step 1 — **Saldi di apertura** (solo primo utilizzo per quell'anno):
- Saldo banca iniziale (da estratto conto 1° gennaio)
- Saldo cassa iniziale
- Capitale sociale (pre-compilato da `Societa.capitaleSociale`)
- Riserva legale, riserva straordinaria
- Utili/perdite portati a nuovo

Step 2 — **Verifica operazioni incomplete:**
- Lista operazioni senza `codiceContoId` con link diretto

Step 3 — **Calcolo ratei e risconti automatici:**
- Analisi operazioni ricorrenti con `dataCompetenzaFine > dataChiusura`
- Lista proposte con formula, tipo, importo
- Utente approva, modifica o scarta ogni voce

Step 4 — **Saldo banca finale** (da estratto conto 31 dicembre)

Step 5 — **Genera bilancio provvisorio** → redirect al tab "Bilancio Provvisorio"

### 4.11 Bilancio Provvisorio

**Conto Economico** aggregato per voce CE:
- A. Valore della produzione (somma ricavi per A.1, A.5)
- B. Costi della produzione per macro-voce (B.7 Servizi, B.8 Beni di terzi, B.10 Ammortamenti, B.14 Oneri diversi)
- Differenza A−B
- C. Oneri finanziari (C.17)
- Risultato ante imposte
- 20. Imposte (IRES + IRAP — già calcolate dall'app)
- **21. Utile/Perdita netta**

**Stato Patrimoniale** aggregato per voce SP:
- Attivo: immobilizzazioni nette (B.I + B.II al netto fondi), crediti vs clienti (C.II.1), liquidità (C.IV)
- Passivo: patrimonio netto (A), debiti vs fornitori (D.7), debiti tributari (D.12)

Banner avviso se operazioni senza dati contabili con link diretto al tab Avanzamento.

---

## 5. Pagina Impostazioni Account (`/impostazioni/account`)

Nuova route aggiunta al routing protetto in `src/middleware.ts`. Nessun conflitto con percorsi esistenti.

**Sezioni:**
1. Dati personali (nome, cognome, email — read-only)
2. Cambio password
3. **Modalità Avanzata** — toggle (sincronizzato con quello in sidebar)
4. **Modalità Commercialista** — toggle con `AlertDialog` di conferma

---

## 6. Piano dei Conti Pre-Configurato

### 6.1 Conti del piano standard (SRL di servizi)

Creati dal seed via `POST /api/piano-dei-conti/inizializza` per `societaId`. Tutti con `preConfigurato = true`, `modificabile = false`.

**Standard adottato:** formato CEE `MMM.SSS` (WinCoge / Passepartout Standard 80).

Lista completa con codice, descrizione, tipo, voceSp, voceCe, naturaSaldo:

| Codice | Descrizione | Tipo | Voce SP | Voce CE | Natura Saldo |
|--------|-------------|------|---------|---------|-------------|
| 100.001 | Cassa contanti | PATRIMONIALE_ATTIVO | C.IV.3 | — | DARE |
| 100.010 | Banca c/c principale | PATRIMONIALE_ATTIVO | C.IV.1 | — | DARE |
| 100.011 | Banca c/c secondario | PATRIMONIALE_ATTIVO | C.IV.1 | — | DARE |
| 110.001 | Clienti Italia | PATRIMONIALE_ATTIVO | C.II.1 | — | DARE |
| 110.010 | Fatture da emettere | PATRIMONIALE_ATTIVO | C.II.1 | — | DARE |
| 130.001 | Erario c/IVA (bifacciale) | PATRIMONIALE_ATTIVO | C.II.5-bis/D.12 | — | DARE |
| 130.002 | Erario c/ritenute subite | PATRIMONIALE_ATTIVO | C.II.5-bis | — | DARE |
| 130.003 | Erario c/acconto IRES | PATRIMONIALE_ATTIVO | C.II.5-bis | — | DARE |
| 130.004 | Erario c/acconto IRAP | PATRIMONIALE_ATTIVO | C.II.5-bis | — | DARE |
| 140.003 | Crediti verso amministratori | PATRIMONIALE_ATTIVO | C.II.5-quater | — | DARE |
| 140.005 | Depositi cauzionali attivi | PATRIMONIALE_ATTIVO | C.II.5-quater | — | DARE |
| 150.001 | Risconti attivi | PATRIMONIALE_ATTIVO | D | — | DARE |
| 150.002 | Ratei attivi | PATRIMONIALE_ATTIVO | D | — | DARE |
| 160.004 | Concessioni, licenze, marchi | PATRIMONIALE_ATTIVO | B.I.4 | — | DARE |
| 160.010 | Software | PATRIMONIALE_ATTIVO | B.I.3 | — | DARE |
| 160.106 | F.do amm.to software | PATRIMONIALE_ATTIVO | B.I.3 | — | AVERE |
| 170.006 | Mobili e arredi | PATRIMONIALE_ATTIVO | B.II.4 | — | DARE |
| 170.008 | Elaboratori (PC, server) | PATRIMONIALE_ATTIVO | B.II.4 | — | DARE |
| 170.010 | Autovetture | PATRIMONIALE_ATTIVO | B.II.4 | — | DARE |
| 170.011 | Apparati telefonici | PATRIMONIALE_ATTIVO | B.II.4 | — | DARE |
| 170.106 | F.do amm.to mobili | PATRIMONIALE_ATTIVO | B.II.4 | — | AVERE |
| 170.108 | F.do amm.to elaboratori | PATRIMONIALE_ATTIVO | B.II.4 | — | AVERE |
| 170.110 | F.do amm.to autovetture | PATRIMONIALE_ATTIVO | B.II.4 | — | AVERE |
| 170.111 | F.do amm.to apparati telefonici | PATRIMONIALE_ATTIVO | B.II.4 | — | AVERE |
| 200.001 | Fornitori Italia | PATRIMONIALE_PASSIVO | D.7 | — | AVERE |
| 200.010 | Fatture da ricevere | PATRIMONIALE_PASSIVO | D.7 | — | AVERE |
| 220.001 | Erario c/IVA a debito | PATRIMONIALE_PASSIVO | D.12 | — | AVERE |
| 220.002 | Erario c/IRES da versare | PATRIMONIALE_PASSIVO | D.12 | — | AVERE |
| 220.003 | Erario c/IRAP da versare | PATRIMONIALE_PASSIVO | D.12 | — | AVERE |
| 220.004 | Erario c/ritenute da versare | PATRIMONIALE_PASSIVO | D.12 | — | AVERE |
| 230.001 | Debiti verso soci per finanziamenti | PATRIMONIALE_PASSIVO | D.3 | — | AVERE |
| 230.002 | Debiti verso soci per dividendi | PATRIMONIALE_PASSIVO | D.14 | — | AVERE |
| 230.003 | Debiti verso amministratori per compensi | PATRIMONIALE_PASSIVO | D.14 | — | AVERE |
| 240.001 | Risconti passivi | PATRIMONIALE_PASSIVO | E | — | AVERE |
| 240.002 | Ratei passivi | PATRIMONIALE_PASSIVO | E | — | AVERE |
| 250.001 | Fondo imposte differite | PATRIMONIALE_PASSIVO | B.2 | — | AVERE |
| 270.001 | Capitale sociale | PATRIMONIALE_PASSIVO | A.I | — | AVERE |
| 270.004 | Riserva legale | PATRIMONIALE_PASSIVO | A.IV | — | AVERE |
| 270.006 | Riserva straordinaria | PATRIMONIALE_PASSIVO | A.VI | — | AVERE |
| 270.009 | Utili/perdite portati a nuovo | PATRIMONIALE_PASSIVO | A.VIII | — | AVERE |
| 270.010 | Utile/perdita d'esercizio | PATRIMONIALE_PASSIVO | A.IX | — | AVERE |
| 310.001 | Consulenze professionali (commercialista, legale) | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.002 | Consulenze informatiche | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.003 | Consulenze marketing e comunicazione | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.010 | Energia elettrica | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.013 | Telefono fisso | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.014 | Telefono mobile | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.015 | Internet e connettività | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.020 | Assicurazioni | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.030 | Spese bancarie e commissioni | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.040 | Pubblicità e promozione | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.050 | Trasferte e rimborsi spese | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.051 | Rappresentanza (hotel, ristoranti) | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.060 | Manutenzioni e riparazioni | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.070 | Cancelleria e materiale consumo | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.071 | Abbonamenti software e SaaS | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.072 | Abbonamenti riviste e banche dati | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.073 | Formazione e aggiornamento | ECONOMICO_COSTO | — | B.7 | DARE |
| 310.080 | Spese postali e corrieri | ECONOMICO_COSTO | — | B.7 | DARE |
| 320.001 | Affitti passivi (locazione ufficio) | ECONOMICO_COSTO | — | B.8 | DARE |
| 320.002 | Noleggio a lungo termine autovetture | ECONOMICO_COSTO | — | B.8 | DARE |
| 320.005 | Canoni leasing operativo | ECONOMICO_COSTO | — | B.8 | DARE |
| 330.040 | Compensi amministratori | ECONOMICO_COSTO | — | B.7 | DARE |
| 340.001 | Amm.to immobilizzazioni immateriali | ECONOMICO_COSTO | — | B.10.a | DARE |
| 340.013 | Amm.to mobili e arredi | ECONOMICO_COSTO | — | B.10.b | DARE |
| 340.015 | Amm.to elaboratori | ECONOMICO_COSTO | — | B.10.b | DARE |
| 340.017 | Amm.to autovetture | ECONOMICO_COSTO | — | B.10.b | DARE |
| 340.018 | Amm.to apparati telefonici | ECONOMICO_COSTO | — | B.10.b | DARE |
| 370.001 | Imposte e tasse indirette (bollo, TARI) | ECONOMICO_COSTO | — | B.14 | DARE |
| 370.002 | Perdite su crediti | ECONOMICO_COSTO | — | B.14 | DARE |
| 370.008 | Oneri diversi di gestione | ECONOMICO_COSTO | — | B.14 | DARE |
| 380.001 | Interessi passivi banca c/c | ECONOMICO_COSTO | — | C.17 | DARE |
| 380.003 | Interessi passivi su finanziamenti | ECONOMICO_COSTO | — | C.17 | DARE |
| 390.001 | IRES corrente | ECONOMICO_COSTO | — | 20 | DARE |
| 390.002 | IRAP corrente | ECONOMICO_COSTO | — | 20 | DARE |
| 400.001 | Ricavi prestazioni di servizi — Italia | ECONOMICO_RICAVO | — | A.1 | AVERE |
| 400.002 | Ricavi prestazioni di servizi — UE | ECONOMICO_RICAVO | — | A.1 | AVERE |
| 400.003 | Ricavi prestazioni di servizi — Extra-UE | ECONOMICO_RICAVO | — | A.1 | AVERE |
| 400.030 | Ricavi da abbonamenti e contratti ricorrenti | ECONOMICO_RICAVO | — | A.1 | AVERE |
| 420.001 | Plusvalenze da realizzo cespiti | ECONOMICO_RICAVO | — | A.5 | AVERE |
| 420.002 | Sopravvenienze attive | ECONOMICO_RICAVO | — | A.5 | AVERE |
| 420.004 | Contributi in conto esercizio | ECONOMICO_RICAVO | — | A.5 | AVERE |
| 430.001 | Interessi attivi bancari | ECONOMICO_RICAVO | — | C.16.d | AVERE |
| 430.002 | Interessi attivi su crediti | ECONOMICO_RICAVO | — | C.16.d | AVERE |

### 6.2 Mapping Categoria Spesa → Conto (suggerimento automatico)

| Categoria (pattern nome) | Conto suggerito | Voce CE |
|--------------------------|----------------|---------|
| consulen* | 310.001 | B.7 |
| utenz*, energia*, luce* | 310.010 | B.7 |
| telefon*, mobile* | 310.014 | B.7 |
| internet*, connett* | 310.015 | B.7 |
| assicuraz* | 310.020 | B.7 |
| banca*, commissioni bancarie* | 310.030 | B.7 |
| pubblicit*, promozione* | 310.040 | B.7 |
| trasferta*, rimborso spese* | 310.050 | B.7 |
| affitto*, locazione* | 320.001 | B.8 |
| noleggio auto* | 320.002 | B.8 |
| leasing* | 320.005 | B.8 |
| compenso amministrat* | 330.040 | B.7 |
| IRES | 390.001 | 20 |
| IRAP | 390.002 | 20 |
| fattura attiva, ricavo* | 400.001 | A.1 |

Il matching usa `includes()` case-insensitive sul nome della categoria. È sovrascrivibile manualmente.

---

## 7. Integrazione OCR / XML

Quando viene importato un file XML, il parser esistente in `src/app/api/ocr/` viene esteso per estrarre i nuovi campi:

| Campo XML (XPath) | Campo app |
|-------------------|-----------|
| `//CedentePrestatore/DatiAnagrafici/Anagrafica/Denominazione` | `Anagrafica.denominazione` |
| `//CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdCodice` | `Anagrafica.partitaIva` |
| `//CedentePrestatore/DatiAnagrafici/CodiceFiscale` | `Anagrafica.codiceFiscale` |
| `//CedentePrestatore/DatiAnagrafici/RegimeFiscale` | `Anagrafica.regimeFiscale` — RF19 o RF20 → `regimeForfettario=true` |
| `//DatiGenerali/DatiGeneraliDocumento/TipoDocumento` | `Operazione.tipoDocumentoSdi` |
| `//DatiRiepilogo/Natura` | `Operazione.naturaOperazioneIva` (mappatura N6 → N6_x) |
| `//DatiRiepilogo/EsigibilitaIVA = "S"` | `Operazione.splitPayment = true` |
| `//DatiGenerali/DatiRitenuta/TipoRitenuta` | `Ritenuta.tipoRitenuta` |
| `//DatiGenerali/DatiRitenuta/AliquotaRitenuta` | `Ritenuta.aliquota` |
| `//DatiGenerali/DatiRitenuta/ImportoRitenuta` | `Operazione.importoRitenuta` |
| `//DatiGenerali/DatiCassaPrevidenziale/ImportoContributoCassa` | `Ritenuta.cassaPrevidenza` |
| `//DatiPagamento/DettaglioPagamento/DataScadenzaPagamento` | suggerisce `dataPagamento` |

**Ricerca anagrafica esistente:** cerca per `partitaIva` esatto (se non null); se trovata collega l'esistente; se non trovata crea nuova con `autoCreataOcr = true`.

---

## 8. API Routes

| Method | Route | Descrizione | Auth |
|--------|-------|-------------|------|
| PATCH | `/api/utente/preferenze` | Aggiorna `modalitaAvanzata`, `modalitaCommercialista` | `getSessionUser()` |
| GET | `/api/anagrafiche` | Lista anagrafiche (filtro tipo, societaId) | `getSessionUser()` |
| POST | `/api/anagrafiche` | Crea anagrafica | `getSessionUser()` |
| GET | `/api/anagrafiche/[id]` | Dettaglio | `getSessionUser()` |
| PATCH | `/api/anagrafiche/[id]` | Aggiorna | `getSessionUser()` |
| DELETE | `/api/anagrafiche/[id]` | Elimina (blocca se con operazioni) | `getSessionUser()` |
| GET | `/api/piano-dei-conti` | Lista conti | `getSessionUser()` |
| POST | `/api/piano-dei-conti/inizializza` | Seed piano standard per societaId | `getSessionUser()` |
| POST | `/api/piano-dei-conti` | Crea conto (solo modalitaCommercialista) | `getSessionUser()` |
| PATCH | `/api/piano-dei-conti/[id]` | Modifica (solo modalitaCommercialista) | `getSessionUser()` |
| DELETE | `/api/piano-dei-conti/[id]` | Elimina conto non usato (solo modalitaCommercialista) | `getSessionUser()` |
| GET | `/api/registri-iva` | Dati registro IVA (filtro tipo, anno, periodo) | `getSessionUser()` |
| GET | `/api/ritenute` | Lista ritenute (filtro stato, anno) | `getSessionUser()` |
| PATCH | `/api/ritenute/[id]/versa` | Segna come versata | `getSessionUser()` |
| GET | `/api/chiusura-esercizio/[anno]` | Stato chiusura | `getSessionUser()` |
| POST | `/api/chiusura-esercizio` | Crea/apri chiusura esercizio | `getSessionUser()` |
| PATCH | `/api/chiusura-esercizio/[anno]/saldi` | Aggiorna saldi apertura/chiusura | `getSessionUser()` |
| POST | `/api/chiusura-esercizio/[anno]/calcola-ratei` | Calcola ratei/risconti automatici | `getSessionUser()` |
| GET | `/api/bilancio/[anno]` | Dati bilancio provvisorio aggregati | `getSessionUser()` |
| PATCH | `/api/operazioni/[id]/dati-contabili` | Aggiorna solo campi dati contabili | `getSessionUser()` |
| GET | `/api/liquidazioni-iva` | Lista liquidazioni IVA | `getSessionUser()` |

Tutte le route verificano che la risorsa richiesta appartenga a `user.societaId`.

---

## 9. Comportamenti Critici e Casi Limite

**Toggle OFF con dati contabili esistenti:** i dati NON vengono cancellati. Al riattivo sono ancora presenti.

**Operazione senza dati contabili:** valida e funzionante come in modalità base. Inclusa nel bilancio con i dati disponibili, contata come "incompleta" nel tab Avanzamento.

**Conto bifacciale (es. `130.001`):** il bilancio calcola il saldo a runtime e assegna la voce SP corretta in base al segno.

**Primo accesso — piano dei conti non inizializzato:** wizard di seed mostrato alla prima visita a `/bilancio/piano-dei-conti`.

**P.IVA opzionale per fornitori extra-UE/privati:** campo non richiesto; avviso (non errore) se vuoto per soggetto italiano.

**Ritenuta su forfettario:** campo disabilitato con tooltip esplicito (Art. 1 c. 67 L. 190/2014).

**Operazione con PianoPagamento:** `statoPagamentoFattura` non mostrato (il master stato è su `PianoPagamento`).

---

## 10. Criteri di Verifica per Ogni Modulo

| Modulo | Criterio |
|--------|---------|
| Toggle sidebar | Persiste dopo logout/login; aggiorna `Utente.modalitaAvanzata` via API; `useSession()` riflette il nuovo valore dopo `router.refresh()` |
| Tab Dati Contabili | Visibile solo con modalità avanzata; salvataggio parziale via PATCH funziona; operazione base senza tab funziona normalmente |
| Anagrafica OCR | XML con RF19 → `regimeForfettario=true`; P.IVA esistente → collega, non duplica; `autoCreataOcr=true` sul record |
| Piano dei conti seed | ~75 conti creati; codici e descrizioni corretti; `modificabile=false` in modalità Avanzata, `true` in Commercialista |
| Mapping categoria→conto | Categoria "Consulenze" suggerisce 310.001; sovrascrivibile; nessun crash se categoria non mappata |
| Ritenuta RF19 | Toggle disabilitato con tooltip; nessun record Ritenuta creato |
| Ritenuta professionista | Calcolo automatico: lordo=1000, aliquota=20%, base=100% → ritenuta=200, netto=800 |
| Scadenza F24 | Operazione del 15/03 → scadenza 16/04; visualizzata in Ritenute |
| Ratei/risconti | Affitto annuale €12.000 pagato il 1/12: risconto attivo = 11/12 × 12.000 = 11.000 |
| Bilancio provvisorio | CE mostra aggregati corretti; SP mostra saldi corretti; banner se operazioni incomplete |
| Registri IVA | Tutti i campi richiesti da Art. 23/24/25 DPR 633/72; filtro periodo funziona |
| Ritenute scadenziario | Alert "scade entro 7 giorni" appare; "Segna versato" aggiorna stato |

---

## 11. Normativa di Riferimento

| Norma | Argomento |
|-------|-----------|
| Artt. 2423-2435-ter C.C. | Struttura e obblighi bilancio d'esercizio |
| Art. 2424-bis c. 5 C.C. | Ratei e risconti |
| Art. 25 DPR 600/73 | Ritenuta su lavoro autonomo (invariata fino al 31/12/2026) |
| Art. 1 c. 67 L. 190/2014 | Esenzione ritenuta forfettari |
| Art. 7 DPR 542/1999 + Art. 11 DPR 435/2001 | Liquidazione IVA trimestrale |
| Art. 6 L. 405/1990 | Acconto IVA dicembre (invariato fino al 31/12/2026) |
| Art. 21-bis D.L. 193/2016 | LIPE — scadenze |
| Artt. 23, 24, 25 DPR 633/72 | Registri IVA obbligatori |
| DPR 642/1972, DM 17/06/2014 | Bollo virtuale €2 su documenti senza IVA > €77,47 |
| D.Lgs. 127/2015 + Provvedimento AdE 31/01/2025 | Fattura elettronica — tracciato v1.9 dal 1/4/2025 |
| Direttiva UE 2020/285 (RF20) | Regime transfrontaliero dal 1/1/2025 |
| OIC 12 (2014) | Criteri classificazione voci bilancio |
| OIC 34 (vigente 1/1/2024) | Ricavi da contratti con clienti |
| D.Lgs. 125/2024 | Soglie dimensionali bilancio (CSRD) |
| D.Lgs. 10/2026 | Testo Unico IVA — efficace dal 1/1/2027 |
| D.Lgs. 33/2025 | Testo Unico Versamenti — efficace dal 1/1/2027 |

---

## 12. Fuori Scope (Fase 1)

- Personale (dipendenti, cedolini, TFR, INPS, INAIL) → Fase 2
- Magazzino e rimanenze → Fase 3
- Partecipazioni e immobilizzazioni finanziarie → Fase 4
- Export XBRL per Camera di Commercio → Fase 4
- Generazione Nota Integrativa e Relazione sulla Gestione → Fase 4
- Generazione modello F24 → futura considerazione
- Generazione Certificazione Unica → futura considerazione
- Integrazione bancaria automatica → futura considerazione
- Libro giornale completo in partita doppia → Fase 4

---

*Spec aggiornata con tutti i fix dalla revisione automatica. Fonti normative verificate a marzo 2026.*
