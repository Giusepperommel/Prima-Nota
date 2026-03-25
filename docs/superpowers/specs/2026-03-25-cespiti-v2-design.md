# SP7: Cespiti v2 + Registro Beni Ammortizzabili

## Overview
Enhance the existing cespiti module with:
- Registro beni ammortizzabili a norma (art. 16 DPR 600/73)
- Distinction between ammortamento civilistico vs fiscale
- PDF-ready export of the register

## Schema Changes
Add to `QuotaAmmortamento`:
- `importoQuotaFiscale` — fiscal depreciation quota (may differ from civil)
- `fondoProgressivoFiscale` — cumulative fiscal fund

## API
- `GET /api/cespiti/registro-ammortizzabili?anno=YYYY` — returns formatted register

## Register Format (art. 16 DPR 600/73)
Per asset row:
- Descrizione bene
- Anno acquisto / Data acquisto
- Costo storico
- Aliquota ammortamento
- Quota ammortamento civilistico
- Quota ammortamento fiscale
- Fondo ammortamento civilistico
- Fondo ammortamento fiscale
- Valore residuo

## Plan
1. Add `importoQuotaFiscale` and `fondoProgressivoFiscale` to QuotaAmmortamento via migration
2. Create registro generation engine at `src/lib/cespiti/registro-ammortizzabili.ts`
3. Create API route at `src/app/api/cespiti/registro-ammortizzabili/route.ts`
4. Enhance cespiti page with registro tab
5. Add tests
