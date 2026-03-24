# Specifica Tecnica — Sotto-progetto 4: Registri IVA Completi + Liquidazioni + LIPE

> **Stato:** In attesa approvazione utente
> **Data:** 2026-03-24
> **Progetto padre:** Upgrade a contabilita professionale
> **Riferimenti normativi:** `docs/normativa/registri-iva-lipe-riferimenti.md`

---

## 1. Contesto e Obiettivo

L'app Prima Nota ha gia:
- Pagina registri IVA (`/bilancio/registri-iva`) con tabelle per vendite/acquisti/corrispettivi, filtri per anno/mese, filtri estere/reverse charge, totali imponibile/IVA
- API registri IVA (`/api/registri-iva`) che interroga le operazioni per registro, anno, mese
- Tabella `LiquidazioneIva` in Prisma con campi: ivaEsigibile, ivaDetraibile, saldo, creditoPeriodoPrecedente, accontoVersato, importoVersato, codiceTributo, statoVersamento, lipeInviata
- API liquidazioni IVA (`/api/liquidazioni-iva`) con calcolo scadenze versamento
- IVA engine completo (classifier, autofattura, doppia registrazione, plafond)
- Sezionali fattura (`SezionaleFattura`) per la fatturazione elettronica
- Scritture contabili con `registroIvaSezionale` e `protocolloIva`

### Cosa manca
1. **Registri IVA print-ready** — totali per aliquota, riepilogo annuale, numerazione pagine, esportazione PDF
2. **Liquidazione IVA potenziata** — calcolo automatico da registri, acconto dicembre, riporto credito, integrazione F24
3. **LIPE** — generazione XML nel formato ministeriale IVP18

### Principio delle tre modalita
- **Semplice:** liquidazione IVA calcolata automaticamente, nessun dettaglio visibile
- **Avanzata:** registri con totali per aliquota, liquidazione visibile con dettaglio, esportazione PDF
- **Commercialista:** LIPE XML, stampa definitiva con numerazione, configurazione sezionali IVA, acconto IVA

---

## 2. Modello Dati

### 2.1 Modifiche alla tabella LiquidazioneIva

La tabella esistente e gia ben strutturata. Campi da aggiungere:

| Campo | Tipo | Note |
|---|---|---|
| totaleOperazioniAttive | Decimal(12,2) | VP2: imponibile vendite + non imponibili + esenti |
| totaleOperazioniPassive | Decimal(12,2) | VP3: imponibile acquisti + non imponibili + esenti |
| debitoPeriodoPrecedente | Decimal(12,2) @default(0) | VP7: debito < EUR 25,82 non versato |
| creditoAnnoPrecedente | Decimal(12,2) @default(0) | VP9: credito da dichiarazione anno precedente |
| versamentiAutoUE | Decimal(12,2) @default(0) | VP10 |
| creditiImposta | Decimal(12,2) @default(0) | VP11 |
| interessiDovuti | Decimal(12,2) @default(0) | VP12: 1% maggiorazione trimestrali |
| metodoAcconto | Int? | 1=storico, 2=previsionale, 3=analitico |
| stampaDefinitiva | Boolean @default(false) | Se il registro e stato stampato in via definitiva |
| dataStampaDefinitiva | DateTime? | Data della stampa definitiva |

I campi esistenti rimangono invariati:
- `ivaEsigibile` = VP4
- `ivaDetraibile` = VP5  (nota: nel codice attuale e mappato come `ivaDetraibile`, corrisponde a `IvaDetratta` nella LIPE)
- `saldo` = VP6 (positivo = debito, negativo = credito)
- `creditoPeriodoPrecedente` = VP8
- `accontoVersato` = VP13
- `importoVersato`, `codiceTributo`, `dataVersamento`, `statoVersamento` = gestione F24
- `lipeInviata`, `lipeDataInvio` = tracking invio LIPE

### 2.2 Nuova tabella: LipeInvio

Per tracciare i file LIPE generati.

| Campo | Tipo | Note |
|---|---|---|
| id | Int @id | PK |
| societaId | Int | FK -> Societa |
| anno | Int | Anno d'imposta |
| trimestre | Int | 1-4 |
| xmlContent | Text (LongText) | XML generato |
| nomeFile | String(50) | es. IT01234567890_LI_00001.xml |
| progressivoFile | String(5) | Progressivo nel nome file |
| stato | Enum(StatoLipe) | BOZZA, GENERATA, INVIATA |
| dataGenerazione | DateTime | |
| dataInvio | DateTime? | |
| scadenzaInvio | DateTime | Scadenza prevista per legge |
| createdAt | DateTime | |

```prisma
enum StatoLipe {
  BOZZA
  GENERATA
  INVIATA
  @@map("stato_lipe")
}
```

### 2.3 Nuova tabella: RiepilogoRegistroIva

Per i totali per aliquota di ciascun periodo (cache dei calcoli per stampa definitiva).

| Campo | Tipo | Note |
|---|---|---|
| id | Int @id | PK |
| societaId | Int | FK -> Societa |
| registroIva | RegistroIva | VENDITE, ACQUISTI, CORRISPETTIVI |
| sezionale | String?(10) | Codice sezionale (null = tutti) |
| anno | Int | |
| periodo | Int | Mese (1-12) o trimestre (1-4) |
| tipoPeriodo | TipoLiquidazione | MENSILE o TRIMESTRALE |
| aliquotaIva | Decimal(5,2) | |
| naturaIva | String?(10) | Natura operazione (N1, N2, ...) per operazioni non imponibili |
| totaleImponibile | Decimal(12,2) | |
| totaleImposta | Decimal(12,2) | |
| numeroOperazioni | Int | |

---

## 3. Registri IVA — Miglioramenti UI

### 3.1 Stato attuale
La pagina esistente (`registri-iva-content.tsx`) mostra una tabella con: protocollo, data, soggetto, tipo doc, nazione, descrizione, imponibile, aliquota, IVA, natura. Include filtri per anno/mese, filtro estere, filtro reverse charge, totali in fondo.

### 3.2 Miglioramenti previsti

#### a) Totali per aliquota
Sotto la tabella delle registrazioni, aggiungere una sezione **Riepilogo per aliquota** che mostra:

| Aliquota / Natura | N. operazioni | Totale imponibile | Totale IVA |
|---|---|---|---|
| 22% | 45 | EUR 120.000,00 | EUR 26.400,00 |
| 10% | 12 | EUR 30.000,00 | EUR 3.000,00 |
| N2.2 (non soggetto) | 3 | EUR 5.000,00 | EUR 0,00 |
| **Totale** | **60** | **EUR 155.000,00** | **EUR 29.400,00** |

Implementazione: calcolo client-side sui dati gia caricati, raggruppando per `aliquotaIva` e `naturaOperazioneIva`.

#### b) Riepilogo annuale
Quando il filtro mese e "Tutti i mesi", aggiungere un pannello **Riepilogo annuale** collassabile che mostra i totali per aliquota dell'intero anno.

#### c) Filtro per sezionale
Aggiungere un selettore di sezionale (se il campo `registroIvaSezionale` delle scritture contabili e valorizzato). In modalita semplice, il filtro non e visibile.

#### d) Esportazione PDF (stampa)
Bottone **"Esporta PDF"** che genera un PDF print-ready usando `@react-pdf/renderer` o `html2canvas + jspdf`:
- Intestazione: ragione sociale, P.IVA, tipo registro, anno, sezionale
- Tabella delle registrazioni
- Totali per aliquota per periodo
- Numerazione pagine progressiva
- In modalita commercialista: opzione "Stampa definitiva" che segna il periodo come stampato

---

## 4. Liquidazione IVA — Miglioramenti

### 4.1 Calcolo automatico
Nuovo endpoint `POST /api/liquidazioni-iva/calcola` che:
1. Interroga il registro vendite per il periodo → calcola VP2 (totale operazioni attive) e VP4 (IVA esigibile)
2. Interroga il registro acquisti per il periodo → calcola VP3 (totale operazioni passive) e VP5 (IVA detratta)
3. Calcola VP6 = VP4 - VP5
4. Recupera VP7 (debito precedente), VP8 (credito precedente), VP9 (credito anno precedente)
5. Applica VP12 (interessi 1%) se trimestrale e non IV trimestre
6. Calcola VP14 (importo da versare o a credito)
7. Salva/aggiorna il record `LiquidazioneIva`

### 4.2 Acconto IVA
Nuovo endpoint `POST /api/liquidazioni-iva/acconto` che:
1. Recupera la liquidazione di dicembre (o IV trimestre) dell'anno precedente
2. Calcola l'88% (metodo storico, default)
3. Permette override con metodo previsionale o analitico
4. Salva nel campo `accontoVersato` della liquidazione di dicembre/IV trimestre corrente

### 4.3 Riporto credito
Logica automatica nel calcolo:
- Se VP14 del periodo N e a credito → diventa VP8 del periodo N+1
- Se VP14 di dicembre/IV trimestre e a credito → diventa VP9 dell'anno successivo (dopo conferma in dichiarazione annuale)

### 4.4 UI Liquidazioni
Pagina `/bilancio/liquidazioni-iva` (nuova o tab nella pagina registri):
- Timeline dei periodi dell'anno con stato (calcolata, da versare, versata, scaduta)
- Dettaglio liquidazione con tutti i campi VP
- Bottone "Ricalcola" per ricalcolare dal registro
- Bottone "Segna come versato" con data e importo
- Acconto dicembre con selettore metodo

---

## 5. LIPE — Generazione XML

### 5.1 Modulo generatore: `src/lib/lipe/`

#### `src/lib/lipe/types.ts`
Tipi TypeScript che mappano la struttura XML:

```typescript
interface LipeFornitura {
  intestazione: LipeIntestazione;
  comunicazione: LipeComunicazione;
}

interface LipeIntestazione {
  codiceFornitura: "IVP18";
  codiceFiscaleDichiarante?: string;
  codiceCarica?: number;
}

interface LipeComunicazione {
  frontespizio: LipeFrontespizio;
  datiContabili: LipeModulo[];
}

interface LipeModulo {
  mese?: number;         // 1-12 per mensili
  trimestre?: number;    // 1-4 per trimestrali
  totaleOperazioniAttive: number;  // VP2
  totaleOperazioniPassive: number; // VP3
  ivaEsigibile: number;           // VP4
  ivaDetratta: number;            // VP5
  ivaDovuta?: number;             // VP6 (se debito)
  ivaCredito?: number;            // VP6 (se credito)
  debitoPrec: number;             // VP7
  creditoPrec: number;            // VP8
  creditoAnnoPrec: number;        // VP9
  versamentiAutoUE: number;       // VP10
  creditiImposta: number;         // VP11
  interessiDovuti: number;        // VP12
  acconto: number;                // VP13
  importoDaVersare?: number;      // VP14 (se debito)
  importoACredito?: number;       // VP14 (se credito)
  metodo?: number;                // metodo acconto
  subfornitura?: number;
  eventiEccezionali?: number;
  operazioniStraordinarie?: number;
}
```

#### `src/lib/lipe/generator.ts`
Funzione che genera l'XML a partire dai dati `LipeFornitura`:
- Usa un template string o libreria XML builder (es. `xmlbuilder2`)
- Applica il namespace `urn:www.agenziaentrate.gov.it:specificheTecniche:schemario:messaggi:v1.0`
- Formato numeri: senza separatore migliaia, punto come decimale, 2 decimali
- Genera il nome file: `IT{codiceFiscale}_LI_{progressivo}.xml`

#### `src/lib/lipe/builder.ts`
Funzione che costruisce `LipeFornitura` a partire dai dati delle liquidazioni:
1. Prende i record `LiquidazioneIva` per il trimestre richiesto
2. Prende i dati della `Societa` (P.IVA, CF, ragione sociale)
3. Costruisce i moduli (1 modulo per trimestre se trimestrali, 3 moduli per mese se mensili)
4. Restituisce la struttura pronta per il generatore XML

### 5.2 API

#### `POST /api/lipe/genera`
Request body:
```json
{
  "anno": 2026,
  "trimestre": 1
}
```
Response:
```json
{
  "data": {
    "id": 1,
    "nomeFile": "IT01234567890_LI_00001.xml",
    "xmlContent": "<?xml ...",
    "stato": "GENERATA",
    "scadenzaInvio": "2026-06-01"
  }
}
```

#### `GET /api/lipe?anno=2026`
Lista dei file LIPE generati per l'anno.

#### `GET /api/lipe/[id]/download`
Restituisce il file XML con `Content-Disposition: attachment`.

### 5.3 UI

Nuova sezione nella pagina liquidazioni (o tab separata):
- Lista trimestri con stato LIPE (non generata / generata / inviata)
- Bottone "Genera LIPE" per trimestre
- Preview dei dati VP prima della generazione
- Download del file XML
- Bottone "Segna come inviata" con data invio

---

## 6. Esportazione PDF Registri

### 6.1 Approccio tecnico
Generazione PDF server-side tramite un endpoint API dedicato, usando `@react-pdf/renderer` (gia nello stack React) oppure `puppeteer` / `playwright` per rendering HTML→PDF.

**Scelta consigliata:** `@react-pdf/renderer` perche:
- Non richiede browser headless
- Funziona bene su Vercel/serverless
- Componenti React per il layout

### 6.2 Endpoint
`GET /api/registri-iva/pdf?registroIva=VENDITE&anno=2026&mese=3&sezionale=FV`

Genera un PDF con:
- Intestazione con dati societa
- Tabella registrazioni del periodo
- Totali per aliquota
- Numerazione pagine
- Se `stampaDefinitiva=true`: segna il periodo come stampato in modo definitivo

### 6.3 Layout PDF

```
+-------------------------------------------------------+
| REGISTRO IVA VENDITE                     Pag. 1 di 3  |
| Societa XYZ S.r.l. — P.IVA 01234567890               |
| Anno 2026 — Marzo — Sezionale: FV                     |
+-------------------------------------------------------+
| Prot. | Data       | Soggetto      | Impon.   | IVA   |
|-------|------------|---------------|----------|-------|
| FV/1  | 01/03/2026 | Cliente A     | 1.000,00 | 220,00|
| FV/2  | 05/03/2026 | Cliente B     | 2.500,00 | 550,00|
| ...   | ...        | ...           | ...      | ...   |
+-------------------------------------------------------+
| RIEPILOGO PER ALIQUOTA                                |
| 22%: Imponibile 120.000,00 — IVA 26.400,00           |
| 10%: Imponibile 30.000,00 — IVA 3.000,00             |
| TOTALE: Imponibile 150.000,00 — IVA 29.400,00        |
+-------------------------------------------------------+
```

---

## 7. Dipendenze

| Dipendenza | Uso | Nuova/Esistente |
|---|---|---|
| `@react-pdf/renderer` | Generazione PDF registri | Nuova |
| `xmlbuilder2` | Generazione XML LIPE | Nuova |
| Prisma | ORM, migrazione schema | Esistente |
| shadcn/ui | Componenti UI | Esistente |

---

## 8. Riepilogo Scope

| Feature | Modalita visibilita | Priorita |
|---|---|---|
| Totali per aliquota nei registri | Avanzata + Commercialista | Alta |
| Riepilogo annuale | Avanzata + Commercialista | Media |
| Calcolo automatico liquidazione | Tutte (background in semplice) | Alta |
| UI liquidazioni con timeline | Avanzata + Commercialista | Alta |
| Riporto credito automatico | Tutte | Alta |
| Acconto IVA | Commercialista | Media |
| Esportazione PDF registri | Avanzata + Commercialista | Media |
| Stampa definitiva | Commercialista | Bassa |
| Generazione LIPE XML | Commercialista | Alta |
| Download XML LIPE | Commercialista | Alta |
| Filtro sezionale nei registri | Commercialista | Media |

---

## Changelog

| Data | Modifica | Motivo |
|---|---|---|
| 2026-03-24 | Creazione documento | Avvio sotto-progetto 4 |
