# SP9: Riconciliazione Bancaria

## Overview
Bank reconciliation module: import bank statements via CSV, auto-match with operations,
manual reconciliation UI.

## Schema
- `MovimentoBancario` — bank movements with reconciliation status

## Engine (`src/lib/riconciliazione/`)
- `csv-parser.ts` — configurable CSV parser for bank statements
- `matcher.ts` — automatic matching by amount + date proximity

## APIs
- `POST /api/riconciliazione/importa` — upload CSV, parse, save
- `GET /api/riconciliazione/movimenti` — list bank movements
- `POST /api/riconciliazione/riconcilia` — link movement to operation
- `GET /api/riconciliazione/suggerimenti` — auto-match suggestions

## UI
- `/riconciliazione-bancaria` — upload, split view, match/unmatch
