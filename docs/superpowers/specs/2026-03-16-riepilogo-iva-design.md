# Riepilogo IVA — Design Spec

## Obiettivo

Aggiungere un tab "Riepilogo IVA" nella pagina Report esistente che mostri la situazione IVA annuale: IVA a debito (fatture attive), IVA a credito (detraibile dai costi), saldo, grafico mensile e possibilita di esportare in PDF.

## Contesto

L'IVA e gia tracciata per ogni operazione nel DB (campi: `aliquotaIva`, `importoIva`, `ivaDetraibile`, `ivaIndetraibile` nella tabella `Operazione`). Le operazioni hanno un campo `tipo` che distingue `FATTURA_ATTIVA`, `COSTO` e `CESPITE`. Non esiste attualmente una vista aggregata di questi dati.

La pagina Report (`src/app/report/report-client.tsx`) usa un sistema a Tabs con 4 tab esistenti. Ogni tab ha: filtro (anno o periodo), bottone genera, bottone PDF, card riassuntive e tabella dettaglio.

## Design

### 1. API Route — `GET /api/report/iva?anno=YYYY`

**File:** `src/app/api/report/iva/route.ts`

**Logica:**
- Filtra operazioni per anno e societaId (dall'auth)
- Aggrega:
  - `ivaDebito`: somma di `importoIva` dove `tipo = FATTURA_ATTIVA`
  - `ivaCredito`: somma di `ivaDetraibile` dove `tipo IN (COSTO, CESPITE)`
  - `ivaIndetraibile`: somma di `ivaIndetraibile` dove `tipo IN (COSTO, CESPITE)`
  - `saldoIva`: `ivaDebito - ivaCredito`
- Aggrega per mese (12 mesi) con gli stessi calcoli

**Response shape:**
```ts
type RiepilogoIvaData = {
  anno: number;
  societa: { ragioneSociale: string; partitaIva: string };
  totali: {
    ivaDebito: number;
    ivaCredito: number;
    ivaIndetraibile: number;
    saldoIva: number;
  };
  andamentoMensile: Array<{
    mese: string;       // "2026-01", "2026-02", ...
    meseLabel: string;  // "Gen", "Feb", ...
    ivaDebito: number;
    ivaCredito: number;
  }>;
};
```

### 2. Tab UI — in `report-client.tsx`

**Nuovo tab:** `<TabsTrigger value="iva">Riepilogo IVA</TabsTrigger>`

**Struttura (stessa dei tab stima fiscale):**
1. Selettore anno + "Genera Riepilogo" + "Scarica PDF"
2. 3 KPI cards:
   - IVA a Debito (importo)
   - IVA a Credito (importo)
   - Saldo IVA (rosso se positivo/dovuta, verde se negativo/credito)
3. Grafico BarChart (Recharts):
   - 12 mesi sull'asse X
   - Due barre per mese: IVA a Debito (colore primario) e IVA a Credito (verde)
4. Tabella riepilogativa:
   | Voce | Importo |
   |------|---------|
   | IVA su fatture attive (debito) | ... |
   | IVA su costi detraibile (credito) | ... |
   | IVA su costi indetraibile | ... |
   | **Saldo IVA** | **...** |

**Componente preview:** `RiepilogoIvaPreview` — funzione interna a `report-client.tsx`, come gli altri preview.

### 3. PDF — `RiepilogoIvaPdf`

**File:** `src/components/report/riepilogo-iva-pdf.tsx`

**Struttura:** Stessa impostazione degli altri PDF (@react-pdf/renderer):
- Header con ragione sociale, partita IVA, anno
- Tabella totali (debito, credito, indetraibile, saldo)
- Tabella andamento mensile (mese, debito, credito, saldo mensile)

### 4. State nel componente Report

Nuovi stati (pattern identico alla stima fiscale):
- `ivaAnno`, `ivaData`, `ivaLoading`, `ivaError`, `ivaPdfLoading`
- `fetchIva()` — chiama l'API
- `downloadIvaPdf()` — genera e scarica il PDF

## File coinvolti

| File | Azione |
|------|--------|
| `src/app/api/report/iva/route.ts` | Nuovo — API endpoint |
| `src/app/report/report-client.tsx` | Modifica — nuovo tab + state + preview |
| `src/components/report/riepilogo-iva-pdf.tsx` | Nuovo — componente PDF |

## Fuori scope

- Liquidazione IVA trimestrale/mensile (solo riepilogo annuale)
- Dettaglio per singola fattura
- Filtro per categoria o socio
