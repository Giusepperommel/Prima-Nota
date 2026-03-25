# Dichiarazioni Fiscali — Implementation Plan

**Data:** 2026-03-24
**Completato:** 2026-03-25

---

## Fase 1: Schema DB
- [x] Aggiungere modelli F24Versamento, F24Riga, CertificazioneUnica, DichiarazioneFiscale
- [x] Aggiungere enums StatoF24, StatoCU, StatoDichiarazione, TipoDichiarazione, SezioneF24
- [x] Aggiungere relazioni a Societa
- [x] Eseguire prisma migrate dev

## Fase 2: F24 Engine
- [x] Creare src/lib/dichiarazioni/f24/f24-types.ts — tipi, codici tributo, costanti
- [x] Creare src/lib/dichiarazioni/f24/calcola-f24.ts — costruzione F24 da imposte
- [x] Creare src/lib/dichiarazioni/f24/compensazione.ts — logica compensazione crediti
- [x] Test: calcolo righe, compensazione, limiti

## Fase 3: CU Engine
- [x] Creare src/lib/dichiarazioni/cu/cu-types.ts
- [x] Creare src/lib/dichiarazioni/cu/genera-cu.ts — aggregazione ritenute per percipiente
- [x] Test: aggregazione, mapping causali, totali

## Fase 4: Redditi/IRAP
- [x] Creare src/lib/dichiarazioni/redditi/calcola-redditi.ts
- [x] Usa tax-utils.ts esistente
- [x] Produce riepilogo JSON con dati principali

## Fase 5: APIs
- [x] POST /api/dichiarazioni/f24/genera
- [x] GET /api/dichiarazioni/f24
- [x] PATCH /api/dichiarazioni/f24/[id]/paga
- [x] POST /api/dichiarazioni/cu/genera
- [x] GET /api/dichiarazioni/cu
- [x] GET /api/dichiarazioni/cu/[id]/export — export singola CU come JSON
- [x] GET /api/dichiarazioni/riepilogo

## Fase 6: UI
- [x] Pagina /dichiarazioni con dashboard
- [x] Sezione scadenze
- [x] Sezione F24
- [x] Sezione CU (con export CSV client-side)
- [x] Sezione Redditi/IRAP
- [x] Link sidebar

## Fase 7: Test
- [x] F24 calculation tests (28 tests)
- [x] CU aggregation tests (18 tests)
- [x] Compensazione tests (included in F24)
- [x] Redditi summary tests (14 tests)
- **Totale: 60 test passati**
