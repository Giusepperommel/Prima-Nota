# SP8: Conservazione Sostitutiva

## Overview
Implement digital preservation (conservazione sostitutiva) of accounting documents
per Italian regulations, generating UNI SInCRO compliant packages.

## Schema
- `PacchettoConservazione` — stores package metadata, SHA-256 hash, timestamp, XML index

## Engine (`src/lib/conservazione/`)
- `uni-sincro.ts` — generates UNI SInCRO XML index
- `hash-utils.ts` — SHA-256 hash calculation
- `pacchetto-generator.ts` — orchestrates package generation (ZIP with XML + docs)

## APIs
- `POST /api/conservazione/genera-pacchetto` — generate package for year/type
- `GET /api/conservazione/[id]/download` — download ZIP package

## UI
- `/configurazione/conservazione` — list, generate, download packages
