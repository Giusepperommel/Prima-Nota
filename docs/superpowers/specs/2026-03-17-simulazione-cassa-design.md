# Design Spec: Simulazione Cassa

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Aggiungere alla dashboard una sezione "Simulazione Cassa" che mostra il flusso di cassa reale della società, partendo dal capitale sociale come saldo iniziale. Contestualmente, aggiungere tre nuovi tipi di operazione (pagamento imposte, distribuzione dividendi, compenso amministratore) per registrare movimenti finanziari che oggi non è possibile tracciare.

---

## 1. Nuovi Tipi di Operazione

### 1.1 Enum TipoOperazione — nuovi valori

Aggiungere al campo `tipoOperazione` del modello `Operazione` in Prisma:

| Valore | Descrizione | Segno cassa |
|--------|-------------|-------------|
| `PAGAMENTO_IMPOSTE` | Versamento di imposte/contributi all'erario o enti previdenziali | Uscita |
| `DISTRIBUZIONE_DIVIDENDI` | Distribuzione di utili ai soci | Uscita |
| `COMPENSO_AMMINISTRATORE` | Compenso corrisposto all'amministratore | Uscita |

### 1.2 Nuovo campo — sottotipoOperazione

Aggiungere campo opzionale `sottotipoOperazione String?` al modello `Operazione`.

Per `PAGAMENTO_IMPOSTE`, i valori consentiti sono:

| Valore | Descrizione |
|--------|-------------|
| `IVA` | Liquidazione IVA (mensile o trimestrale) |
| `IRES_ACCONTO` | Acconto IRES (giugno / novembre) |
| `IRES_SALDO` | Saldo IRES annuale |
| `IRAP_ACCONTO` | Acconto IRAP |
| `IRAP_SALDO` | Saldo IRAP |
| `INPS` | Contributi INPS soci lavoratori |

Per `DISTRIBUZIONE_DIVIDENDI` e `COMPENSO_AMMINISTRATORE` il campo è `null`.

### 1.3 Comportamento fiscale dei nuovi tipi

- **Nessuna IVA**: tutti e tre i tipi hanno `aliquotaIva = null`, `importoImponibile = null`, `ivaDetraibile = null`, `ivaIndetraibile = null`.
- **Esclusi dai calcoli fiscali**: non contribuiscono a fatturato, costi, utile nei report (rendiconto, stima fiscale, KPI). Sono movimenti finanziari puri.
- **Inclusi nel Riepilogo IVA** solo per `PAGAMENTO_IMPOSTE` con sottotipo `IVA`: l'importo versato appare come "IVA versata" (informativo, non modifica il saldo IVA che è già calcolato).
- **Ripartizione tra soci**: supportata per tutti e tre i tipi, identica al meccanismo esistente (COMUNE / SINGOLO / CUSTOM). Il campo `importoCalcolato` nelle ripartizioni è calcolato su `importoTotale`.

### 1.4 Form operazioni — modifiche

Il dropdown `tipoOperazione` mostra i tre nuovi valori in un gruppo separato "Movimenti Finanziari", distinto da "Operazioni" (fatture, costi, cespiti).

Quando si seleziona `PAGAMENTO_IMPOSTE`, appare un campo select "Tipo imposta" obbligatorio con i 6 sottotipi. Per gli altri due nuovi tipi non compare nessun campo aggiuntivo.

I campi IVA, detraibilità, deducibilità e cespite sono nascosti per tutti e tre i nuovi tipi. La sezione ripartizione soci è sempre visibile.

### 1.5 Lista operazioni — badge

I nuovi tipi appaiono con badge di colore distinto nella lista operazioni:
- `PAGAMENTO_IMPOSTE`: arancione (es. `bg-orange-100 text-orange-800`)
- `DISTRIBUZIONE_DIVIDENDI`: viola (es. `bg-purple-100 text-purple-800`)
- `COMPENSO_AMMINISTRATORE`: azzurro (es. `bg-sky-100 text-sky-800`)

---

## 2. Simulazione Cassa nella Dashboard

### 2.1 Posizione

Nuova sezione in fondo alla pagina `dashboard-content.tsx`, dopo la tabella "Ripartizione per Socio" e prima delle "Ultime Operazioni". Titolo: **"Simulazione Cassa"**, con selettore anno indipendente (default: anno corrente).

### 2.2 Calcolo del saldo

**Saldo iniziale dell'anno** = capitale sociale + net cash flow di tutti gli anni precedenti all'anno selezionato.

Il net cash flow di un anno è: somma `importoTotale` di FATTURA_ATTIVA − somma `importoTotale` di (COSTO + CESPITE + PAGAMENTO_IMPOSTE + DISTRIBUZIONE_DIVIDENDI + COMPENSO_AMMINISTRATORE).

**Saldo progressivo mensile**: per ogni mese M dell'anno selezionato:
```
saldoFineM = saldoInizioAnno + Σ(entrate mesi 1..M) − Σ(uscite mesi 1..M)
```

**Entrate** = `importoTotale` delle FATTURA_ATTIVA (lordo IVA inclusa).
**Uscite** = `importoTotale` di COSTO + CESPITE + PAGAMENTO_IMPOSTE + DISTRIBUZIONE_DIVIDENDI + COMPENSO_AMMINISTRATORE.

Nota: usare `importoTotale` per il cash flow è corretto — la cassa si muove per gli importi lordi. L'IVA incassata e poi versata è già tracciata correttamente: entra con la fattura attiva (+), esce con il pagamento IVA (−).

### 2.3 UI — componenti

**Card riepilogative (4, in griglia):**
1. Saldo Iniziale Anno — valore a inizio anno (grigio/neutro)
2. Entrate Lorde — totale FATTURA_ATTIVA anno (verde)
3. Uscite Lorde — totale uscite anno (rosso)
4. Saldo Finale Anno — saldo a fine anno, verde se positivo / rosso se negativo

**Grafico a linea (Recharts `LineChart`):**
- X: mesi (Gen–Dic)
- Y: saldo di cassa progressivo
- Una linea (blu/indaco) con tooltip che mostra il saldo a fine mese
- Linea orizzontale tratteggiata a €0 come riferimento visivo (`ReferenceLine`)
- Area colorata sotto la linea (verde se sopra zero, rosso se sotto) tramite `defs` + `linearGradient`

**Tabella breakdown uscite:**
Sotto il grafico, una tabella compatta con righe per categoria di uscita:

| Categoria | Importo |
|-----------|---------|
| Costi operativi (COSTO) | €X |
| Cespiti (CESPITE) | €X |
| Imposte pagate (PAGAMENTO_IMPOSTE) | €X |
| Dividendi distribuiti | €X |
| Compensi amministratore | €X |

### 2.4 Visibilità per ruolo

- **ADMIN**: visualizza il cash flow completo della società (tutti i movimenti).
- **STANDARD**: visualizza solo il proprio cash flow, calcolando entrate e uscite in base a `importoCalcolato` nelle proprie ripartizioni.

### 2.5 Esclusione bozze

Le operazioni con `bozza: true` sono escluse dal calcolo (coerente con il resto della dashboard).

---

## 3. API — nuovo endpoint

### `GET /api/dashboard/cassa?anno=YYYY`

**Response:**
```typescript
{
  anno: number;
  saldoIniziale: number;           // capitale sociale + cash flow anni precedenti
  mensile: Array<{
    mese: number;                  // 1-12
    meseLabel: string;             // "Gen", "Feb", ...
    entrate: number;               // FATTURA_ATTIVA importoTotale
    uscite: number;                // somma tutte le uscite
    uściteDettaglio: {
      costiOperativi: number;
      cespiti: number;
      imposte: number;
      dividendi: number;
      compensiAmm: number;
    };
    saldoProgressivo: number;      // cumulativo a fine mese
  }>;
  totali: {
    entrate: number;
    uscite: number;
    saldoFinale: number;
  };
}
```

**Logica:** stessa del trend esistente ma su `importoTotale` e con tutti i tipi di operazione. Per utenti STANDARD, usa `importoCalcolato` dalle ripartizioni (come KPI/trend esistenti).

---

## 4. Modifiche al DB (Prisma schema)

```prisma
// Aggiungere al modello Operazione:
sottotipoOperazione  String?   @map("sottotipo_operazione")

// Aggiornare enum TipoOperazione:
enum TipoOperazione {
  FATTURA_ATTIVA
  COSTO
  CESPITE
  PAGAMENTO_IMPOSTE        // nuovo
  DISTRIBUZIONE_DIVIDENDI  // nuovo
  COMPENSO_AMMINISTRATORE  // nuovo
}
```

Migration Prisma: `prisma migrate dev --name add-tipi-finanziari`.

---

## 5. File impattati

| File | Modifica |
|------|----------|
| `prisma/schema.prisma` | Nuovo enum values + campo `sottotipoOperazione` |
| `src/app/operazioni/operazione-form.tsx` | Nuovi tipi nel dropdown, campo sottotipo |
| `src/app/operazioni/operazioni-list.tsx` | Nuovi badge per i 3 tipi |
| `src/app/api/operazioni/route.ts` | Gestione nuovi tipi nel POST |
| `src/app/api/operazioni/[id]/route.ts` | Gestione nuovi tipi nel PUT |
| `src/app/api/dashboard/cassa/route.ts` | **Nuovo** endpoint cash flow |
| `src/app/dashboard/dashboard-content.tsx` | Nuova sezione Simulazione Cassa |

I report fiscali esistenti (KPI, trend, rendiconto, stima-fiscale) non richiedono modifiche: filtrano già per tipo operazione specifico e i nuovi tipi sono esclusi implicitamente.

---

## 6. Considerazioni out-of-scope

- Export PDF del cash flow (può essere aggiunto in seguito)
- Proiezioni future / scenari "what-if"
- Integrazione con conti bancari reali
