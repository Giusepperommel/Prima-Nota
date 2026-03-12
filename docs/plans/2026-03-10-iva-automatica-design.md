# Design: Gestione IVA Automatica e Regole Fiscali per Tipo Attivita

Data: 2026-03-10

## Obiettivo

Automatizzare la gestione IVA nel form operazioni, adattando aliquote e detraibilita al tipo di societa/regime fiscale. L'utente inserisce solo l'importo totale e seleziona la categoria; il sistema calcola tutto. Per categorie con trattamenti variabili (auto, telefonia mobile, alberghi), un toggle in linguaggio semplice chiede il contesto d'uso.

## 1. Schema DB

### 1.1 Nuovi enum

```prisma
enum TipoAttivita {
  SRL
  SRLS
  SNC
  SAS
  STP
  DITTA_INDIVIDUALE
  LIBERO_PROFESSIONISTA
  AGENTE_COMMERCIO
}

enum RegimeFiscale {
  ORDINARIO
  FORFETTARIO
}
```

### 1.2 Modifiche a Societa

- `regimeFiscale` da String? a enum `RegimeFiscale` (default ORDINARIO)
- Nuovo campo `tipoAttivita` enum `TipoAttivita`

### 1.3 Modifiche a CategoriaSpesa

Nuovi campi:
- `aliquotaIvaDefault` Decimal(5,2) default 22 — aliquota IVA di default
- `percentualeDetraibilitaIva` Decimal(5,2) default 100 — % IVA detraibile
- `haOpzioniUso` Boolean default false — se mostra toggle uso nel form
- `opzioniUso` Json? — configurazione opzioni uso (vedi sotto)

Formato `opzioniUso`:
```json
[
  {
    "label": "Uso misto (personale + lavoro)",
    "codice": "MISTO",
    "detraibilitaIva": 40,
    "deducibilitaCosto": 20
  },
  {
    "label": "Solo lavoro",
    "codice": "ESCLUSIVO",
    "detraibilitaIva": 100,
    "deducibilitaCosto": 100
  }
]
```

### 1.4 Modifiche a Operazione

Nuovi campi:
- `percentualeDetraibilitaIva` Decimal(5,2)? — % IVA detraibile applicata
- `ivaDetraibile` Decimal(10,2)? — importo IVA detraibile
- `ivaIndetraibile` Decimal(10,2)? — importo IVA non detraibile (diventa costo)
- `opzioneUso` String? — codice opzione uso selezionata (es. "MISTO")

### 1.5 Nuova tabella PreferenzaUsoCategoria

```prisma
model PreferenzaUsoCategoria {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  categoriaId Int      @map("categoria_id")
  opzioneUso  String   @map("opzione_uso") @db.VarChar(50)
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([userId, categoriaId])
  @@map("preferenze_uso_categoria")
}
```

## 2. Categorie Default per Tipo Attivita

### 2.1 Categorie con opzioni uso (toggle nel form)

#### Per SRL/SRLS/SNC/SAS/STP/Ditta/Professionista:

| Categoria | Aliquota IVA | Opzione "Uso misto" | Opzione "Solo lavoro" |
|-----------|-------------|---------------------|----------------------|
| Carburante auto | 22% | IVA detr. 40%, costo ded. 20% | IVA detr. 100%, costo ded. 100% |
| Manutenzione auto | 22% | IVA detr. 40%, costo ded. 20% | IVA detr. 100%, costo ded. 100% |
| Assicurazione auto | 22% | IVA detr. 40%, costo ded. 20% | IVA detr. 100%, costo ded. 100% |
| Leasing/noleggio auto | 22% | IVA detr. 40%, costo ded. 20% | IVA detr. 100%, costo ded. 100% |
| Telefonia mobile | 22% | IVA detr. 50%, costo ded. 80% | IVA detr. 100%, costo ded. 100% |
| Alberghi e ristoranti | 10% | IVA detr. 100%, costo ded. 75% (business) | IVA detr. 0%, costo ded. con limiti (rappresentanza) |

#### Eccezione Agente di Commercio:

Le categorie auto diventano:
- Opzione "Uso misto": IVA detr. 100%, costo ded. 80% (max 25.822,84 EUR)
- Opzione "Solo lavoro": IVA detr. 100%, costo ded. 100%

### 2.2 Categorie senza toggle (regole fisse)

| Categoria | IVA | Detr. IVA | Ded. Costo |
|-----------|-----|-----------|------------|
| Telefonia fissa ufficio | 22% | 100% | 100% |
| Cancelleria e materiale ufficio | 22% | 100% | 100% |
| Software e licenze | 22% | 100% | 100% |
| Hardware e computer | 22% | 100% | 100% |
| Affitto ufficio | 22% | 100% | 100% |
| Utenze ufficio | 10% | 100% | 100% |
| Consulenze professionali | 22% | 100% | 100% |
| Spese bancarie | esente (0%) | 0% | 100% |
| Assicurazioni professionali | esente (0%) | 0% | 100% |
| Marketing e pubblicita | 22% | 100% | 100% |
| Spese di rappresentanza | 22% | 0% | con limiti |
| Omaggi (fino a 50 EUR) | 22% | 100% | 100% |
| Omaggi (oltre 50 EUR) | 22% | 0% | con limiti |
| Mobili e arredi | 22% | 100% | 100% |
| Viaggi e trasferte | 22% | 100% | 100% |
| Formazione professionale | 22% | 100% | 100% |
| Pulizie ufficio | 22% | 100% | 100% |

### 2.3 Regime Forfettario

Tutte le categorie: aliquotaIvaDefault = 0, percentualeDetraibilitaIva = 0, haOpzioniUso = false.
La sezione IVA nel form e nascosta.

## 3. UX Form Operazione

### 3.1 Flusso (regime ordinario, COSTO/CESPITE)

1. Utente seleziona categoria
2. Se `haOpzioniUso` = true: appare toggle con label user-friendly, pre-selezionato sull'ultima scelta (da PreferenzaUsoCategoria) o default "Misto"
3. Utente inserisce importo totale (IVA inclusa)
4. Sistema mostra riepilogo fiscale:
   - Imponibile, IVA totale
   - IVA detraibile e indetraibile
   - Base costo deducibile (imponibile + IVA indetraibile)
   - Importo deducibile finale

### 3.2 Calcolo IVA indetraibile nel costo

L'IVA indetraibile si somma all'imponibile ai fini della deducibilita:
- costoFiscale = imponibile + ivaIndetraibile
- importoDeducibile = costoFiscale * percentualeDeducibilita / 100

### 3.3 Override manuale

- Link "Modifica IVA manualmente" espande:
  - Select aliquota IVA (22%, 10%, 5%, 4%, esente, custom)
  - Input % detraibilita IVA (0-100)
- Gia esistente: checkbox "Deducibilita personalizzata" per il costo

### 3.4 Regime forfettario

- Sezione IVA nascosta
- Importo totale = costo intero
- Solo deducibilita costo visibile

### 3.5 FATTURA_ATTIVA

- Nessuna sezione IVA (come ora)
- Importo totale usato direttamente

## 4. Wizard Creazione Societa

### 4.1 Step 1 modificato

Campi:
1. Ragione sociale (text)
2. Partita IVA (text)
3. Indirizzo (text)
4. Tipo attivita (select): SRL, SRLS, SNC, SAS, STP, Ditta individuale, Libero professionista, Agente di commercio
5. Regime fiscale (select, condizionale):
   - Ditta/Professionista/Agente: mostra scelta Ordinario/Forfettario
   - SRL/SRLS/SNC/SAS/STP: automaticamente Ordinario (nascosto o disabilitato)

### 4.2 Generazione categorie

Il backend usa tipoAttivita + regimeFiscale per generare le categorie con le regole corrette.

## 5. Migrazione Dati Esistenti

### 5.1 Societa "Clever"

- Aggiornare record: tipoAttivita = SRL, regimeFiscale = ORDINARIO
- Aggiornare categorie esistenti con nuovi campi IVA

### 5.2 Operazioni esistenti

- Ricalcolare IVA per le operazioni COSTO/CESPITE gia inserite
- Per ogni operazione con importoTotale e aliquotaIva:
  - Calcolare imponibile, IVA totale
  - Applicare detraibilita IVA dalla categoria
  - Calcolare ivaDetraibile, ivaIndetraibile
  - Ricalcolare importoDeducibile (imponibile + ivaIndetraibile) * percentualeDeducibilita
- Le operazioni senza aliquotaIva: assumere 22% come default
