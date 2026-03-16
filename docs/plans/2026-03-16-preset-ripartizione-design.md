# Design: Preset di Ripartizione Personalizzati

## Obiettivo

Permettere agli utenti di creare preset di distribuzione predefiniti per le operazioni, configurabili e ordinabili, che appaiono come opzioni aggiuntive nel selettore di ripartizione del form operazione.

## Database

### Nuovi modelli

**PresetRipartizione**
- `id` — Int, autoincrement, PK
- `nome` — String (es. "50/50 ufficio")
- `ordinamento` — Int (per ordinamento drag & drop)
- `tipiOperazione` — JSON array di TipoOperazione (es. ["COSTO", "FATTURA_ATTIVA"])
- `societaId` — FK verso Societa
- `createdAt`, `updatedAt` — DateTime

**PresetRipartizioneSocio**
- `id` — Int, autoincrement, PK
- `presetRipartizioneId` — FK verso PresetRipartizione
- `socioId` — FK verso Socio
- `percentuale` — Float

### Vincoli
- La somma delle percentuali per preset deve essere 100%
- Cascade delete: eliminando un preset si eliminano le righe PresetRipartizioneSocio
- I soci eliminati non causano eliminazione del preset (solo warning in UI)

## UI — Configurazione

Nuova sezione in `/configurazione` → tab "Ripartizioni" (accanto a Soci e Categorie):

- Lista dei preset ordinabili con drag & drop
- Ogni preset mostra: nome, tipi operazione associati (badge), distribuzione percentuale per socio
- Badge warning arancione se un socio incluso nel preset è inattivo
- Azioni: crea, modifica, elimina, riordina

### Form creazione/modifica preset
- Campo nome
- Selezione multipla tipi operazione (FATTURA_ATTIVA, COSTO, CESPITE) con checkbox
- Tabella soci con campo percentuale per ciascuno
- Validazione: somma percentuali = 100%

## UI — Form Operazione

Nel selettore di ripartizione (radio buttons):
- I preset appaiono come opzioni aggiuntive dopo COMUNE, SINGOLO, CUSTOM
- Mostrati nell'ordine configurato dall'utente (campo `ordinamento`)
- Filtrati per tipo operazione corrente (se stai creando un COSTO, vedi solo preset associati a COSTO)
- Selezionando un preset, la tabella mostra le percentuali pre-compilate (non modificabili)
- Se un preset contiene un socio inattivo → badge warning arancione + tooltip

### Link di aiuto
Sotto i radio buttons: link "Gestisci preset di ripartizione →" che porta a `/configurazione` nella tab Ripartizioni.

## Gestione soci inattivi

I preset con soci inattivi restano visibili ovunque ma con un badge arancione "Socio inattivo". L'utente deve aggiornarli manualmente dalla configurazione.

## API

- `GET /api/preset-ripartizioni` — lista preset della società, ordinati per `ordinamento`
- `POST /api/preset-ripartizioni` — crea preset con soci e percentuali
- `PUT /api/preset-ripartizioni/[id]` — modifica preset
- `DELETE /api/preset-ripartizioni/[id]` — elimina preset
- `PUT /api/preset-ripartizioni/riordina` — aggiorna ordinamento di tutti i preset
