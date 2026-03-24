# Piano — Bilancio Civilistico

> Data: 2026-03-24

## Tasks

### 1. Schema migration
- Aggiungere modello `BilancioGenerato` in schema.prisma
- Relazione con Societa
- Unique constraint su (societaId, anno)
- Eseguire `prisma migrate dev`

### 2. Tipi e costanti bilancio
- Creare `src/lib/bilancio/types.ts` con tipi per struttura SP e CE
- Definire costanti per gerarchia art. 2424 e art. 2425

### 3. SP Builder
- Creare `src/lib/bilancio/sp-builder.ts`
- Parsing delle voci SP (es. "C.IV.1")
- Aggregazione saldi nella struttura gerarchica
- Calcolo subtotali per ogni livello

### 4. CE Builder
- Creare `src/lib/bilancio/ce-builder.ts`
- Parsing delle voci CE (es. "B.7", "B.10.a")
- Struttura scalare con differenze intermedie
- Calcolo risultato d'esercizio

### 5. Engine bilancio
- Creare `src/lib/bilancio/engine.ts`
- Orchestrazione: legge saldi per conto, chiama SP e CE builder
- Restituisce struttura completa bilancio

### 6. XBRL generator
- Creare `src/lib/bilancio/xbrl-generator.ts`
- Mapping voci bilancio → concetti XBRL it-gaap
- Generazione XML instance document

### 7. API POST genera
- `src/app/api/bilancio-civilistico/genera/route.ts`
- Chiama engine, salva risultato in BilancioGenerato
- Upsert su (societaId, anno)

### 8. API GET anno
- `src/app/api/bilancio-civilistico/[anno]/route.ts`
- Restituisce bilancio generato per l'anno

### 9. API GET PDF placeholder
- `src/app/api/bilancio-civilistico/[anno]/pdf/route.ts`
- Ritorna JSON con messaggio placeholder

### 10. API GET XBRL
- `src/app/api/bilancio-civilistico/[anno]/xbrl/route.ts`
- Genera e restituisce XBRL instance document

### 11. UI Page
- `src/app/bilancio/bilancio-civilistico/page.tsx`
- `src/app/bilancio/bilancio-civilistico/bilancio-civilistico-content.tsx`
- Selettore anno, pulsante genera, tab SP/CE, tabelle, export

### 12. Sidebar link
- Aggiungere "Bilancio Civilistico" in bilancioNavItems nel sidebar

### 13. Tests
- Test per SP builder (parsing voci, aggregazione)
- Test per CE builder (struttura scalare, calcolo differenze)
- Test per engine (integrazione SP + CE)
- Test per XBRL generator
