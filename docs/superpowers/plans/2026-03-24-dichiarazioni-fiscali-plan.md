# Dichiarazioni Fiscali — Implementation Plan

**Data:** 2026-03-24

---

## Fase 1: Schema DB
- [ ] Aggiungere modelli F24Versamento, F24Riga, CertificazioneUnica, DichiarazioneFiscale
- [ ] Aggiungere enums StatoF24, StatoCU, StatoDichiarazione, TipoDichiarazione, SezioneF24
- [ ] Aggiungere relazioni a Societa
- [ ] Eseguire prisma migrate dev

## Fase 2: F24 Engine
- [ ] Creare src/lib/dichiarazioni/f24/f24-types.ts — tipi, codici tributo, costanti
- [ ] Creare src/lib/dichiarazioni/f24/calcola-f24.ts — costruzione F24 da imposte
- [ ] Creare src/lib/dichiarazioni/f24/compensazione.ts — logica compensazione crediti
- [ ] Test: calcolo righe, compensazione, limiti

## Fase 3: CU Engine
- [ ] Creare src/lib/dichiarazioni/cu/cu-types.ts
- [ ] Creare src/lib/dichiarazioni/cu/genera-cu.ts — aggregazione ritenute per percipiente
- [ ] Test: aggregazione, mapping causali, totali

## Fase 4: Redditi/IRAP
- [ ] Creare src/lib/dichiarazioni/redditi/calcola-redditi.ts
- [ ] Usa tax-utils.ts esistente
- [ ] Produce riepilogo JSON con dati principali

## Fase 5: APIs
- [ ] POST /api/dichiarazioni/f24/genera
- [ ] GET /api/dichiarazioni/f24
- [ ] PATCH /api/dichiarazioni/f24/[id]/paga
- [ ] POST /api/dichiarazioni/cu/genera
- [ ] GET /api/dichiarazioni/cu
- [ ] GET /api/dichiarazioni/riepilogo

## Fase 6: UI
- [ ] Pagina /dichiarazioni con dashboard
- [ ] Sezione scadenze
- [ ] Sezione F24
- [ ] Sezione CU
- [ ] Sezione Redditi/IRAP
- [ ] Link sidebar

## Fase 7: Test
- [ ] F24 calculation tests
- [ ] CU aggregation tests
- [ ] Compensazione tests
- [ ] Redditi summary tests
