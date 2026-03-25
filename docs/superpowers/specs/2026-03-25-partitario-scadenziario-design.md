# SP10: Partitario Clienti/Fornitori + Scadenziario

## Overview
Open-item ledger (partitario) for customers and suppliers with payment due date tracking.

## Schema
- `ScadenzaPartitario` — open items per anagrafica with due date, amount, paid amount, status

## Engine (`src/lib/partitario/`)
- `genera-scadenze.ts` — create scadenze from operations
- `calcola-saldo.ts` — open balance per anagrafica + aging analysis

## APIs
- `GET /api/partitario` — open items by anagrafica
- `GET /api/partitario/scadenziario` — upcoming due dates
- `PUT /api/partitario/[id]/paga` — mark as paid (partial or full)

## UI
- `/partitario` — tabs clienti/fornitori, per-anagrafica detail, scadenziario
