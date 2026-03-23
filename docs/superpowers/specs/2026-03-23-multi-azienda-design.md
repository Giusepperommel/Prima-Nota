# Specifica Tecnica — Sotto-progetto 2: Multi-Azienda e RLS

> **Stato:** In approvazione
> **Data:** 2026-03-23
> **Progetto padre:** Upgrade a contabilita professionale

---

## 1. Contesto e Obiettivo

Oggi un utente puo appartenere a una sola societa. Questo impedisce:
- A un commercialista di gestire piu clienti dallo stesso account
- A un socio di partecipare a piu SRL
- Di creare una dashboard operativa cross-azienda

**Obiettivo:** Permettere a un Utente di accedere a N societa con ruoli diversi per ciascuna, con switch rapido, dashboard multi-azienda con note/scadenze/alert, e log attivita consultabile per azienda.

---

## 2. Modello Dati

### 2.1 Nuova tabella: UtenteAzienda (bridge table)

| Campo | Tipo | Note |
|---|---|---|
| id | Int PK | Auto-increment |
| utenteId | Int FK → Utente | |
| societaId | Int FK → Societa | |
| ruolo | Enum(ADMIN, STANDARD, COMMERCIALISTA) | Ruolo per questa azienda |
| attivo | Boolean @default(true) | Disattivabile senza eliminare |
| ultimoAccesso | DateTime? | Aggiornato ad ogni switch |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indici:**
- `@@unique([utenteId, societaId])` — un utente ha un solo record per societa
- `@@index([utenteId])`
- `@@index([societaId])`

### 2.2 Nuova tabella: NotaAzienda

| Campo | Tipo | Note |
|---|---|---|
| id | Int PK | |
| utenteAziendaId | Int FK → UtenteAzienda | Nota per-utente per-azienda |
| testo | String @db.Text | Contenuto libero |
| colore | String? @db.VarChar(20) | yellow, red, green, blue |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indici:**
- `@@index([utenteAziendaId])`

### 2.3 Nuova tabella: ScadenzaAzienda

| Campo | Tipo | Note |
|---|---|---|
| id | Int PK | |
| societaId | Int FK → Societa | Visibile a tutti gli utenti della societa |
| createdByUtenteId | Int FK → Utente | Chi l'ha creata |
| descrizione | String @db.VarChar(500) | |
| dataScadenza | DateTime @db.Date | |
| completata | Boolean @default(false) | |
| dataCompletamento | DateTime? | |
| tipoScadenza | Enum(FISCALE, CONTABILE, GENERICA) | |
| priorita | Enum(ALTA, MEDIA, BASSA) | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indici:**
- `@@index([societaId, dataScadenza])`
- `@@index([societaId, completata])`

### 2.4 Nuova tabella: AlertAzienda

| Campo | Tipo | Note |
|---|---|---|
| id | Int PK | |
| societaId | Int FK → Societa | |
| tipo | Enum(SCADENZA_IMMINENTE, SCRITTURA_PROVVISORIA, IVA_DA_LIQUIDARE, BILANCIO_NON_QUADRA, GENERICO) | |
| messaggio | String @db.VarChar(500) | |
| livello | Enum(INFO, WARNING, ERRORE) | |
| letto | Boolean @default(false) | |
| link | String? @db.VarChar(255) | Deep link alla pagina pertinente |
| createdAt | DateTime | |

**Indici:**
- `@@index([societaId, letto])`
- `@@index([societaId, createdAt])`

### 2.5 Nuovi enum

```
RuoloAzienda: ADMIN, STANDARD, COMMERCIALISTA
TipoScadenza: FISCALE, CONTABILE, GENERICA
PrioritaScadenza: ALTA, MEDIA, BASSA
TipoAlert: SCADENZA_IMMINENTE, SCRITTURA_PROVVISORIA, IVA_DA_LIQUIDARE, BILANCIO_NON_QUADRA, GENERICO
LivelloAlert: INFO, WARNING, ERRORE
```

**CRITICO — Strategia ruoli:**

`UtenteAzienda.ruolo` diventa la UNICA fonte autorevole per il ruolo nell'azienda. Per mantenere la retrocompatibilita senza toccare le 30+ route API che controllano `user.ruolo`:

1. Il JWT callback popola `user.ruolo` DALLA `UtenteAzienda.ruolo` dell'azienda corrente (non piu da `Socio.ruolo`)
2. Quando l'utente switcha azienda, `user.ruolo` si aggiorna automaticamente
3. `COMMERCIALISTA` viene mappato a `ADMIN` per i check di accesso (il commercialista ha accesso completo come da design)
4. `SUPER_ADMIN` resta un ruolo piattaforma su `Utente` (nuovo campo `isSuperAdmin Boolean @default(false)`) — non legato alla singola azienda
5. `Socio.ruolo` viene deprecato — resta nel DB per retrocompatibilita ma non viene piu letto

Cosi le 30+ route con `user.ruolo !== "ADMIN"` continuano a funzionare senza modifiche.

### 2.5b Nuova tabella: InvitoAzienda

| Campo | Tipo | Note |
|---|---|---|
| id | Int PK | |
| societaId | Int FK → Societa | Azienda che invita |
| email | String | Email dell'invitato |
| ruolo | RuoloAzienda | Ruolo proposto |
| token | String @unique | Token per accettazione |
| scadenza | DateTime | 7 giorni dalla creazione |
| accettato | Boolean @default(false) | |
| createdByUtenteId | Int FK → Utente | Chi ha creato l'invito |
| createdAt | DateTime | |

**Indici:** `@@unique([societaId, email])` — un solo invito attivo per email per azienda

### 2.6 Modifiche a tabelle esistenti

#### Utente
- Aggiungere `nome String @db.VarChar(100)` — nome dell'utente (decoupled dal Socio)
- Aggiungere `cognome String @db.VarChar(100)` — cognome dell'utente
- Aggiungere `isSuperAdmin Boolean @default(false)` — ruolo piattaforma (non legato ad azienda)
- `socioId` resta per retrocompatibilita ma viene deprecato. Non viene piu usato per la sessione.
- Aggiungere relazione `aziende UtenteAzienda[]`
- Al momento della migration, `nome` e `cognome` vengono copiati dal `Socio` collegato

#### Socio
- Rimuovere `email @unique` globale
- Aggiungere `@@unique([societaId, email])` — email unica per societa
- Aggiungere check applicativo: per Soci con `societaId IS NULL` (registrazione), verificare unicita email prima di creare
- Aggiungere `utenteId Int?` opzionale — collegamento Socio → Utente. Questo e il link primario (Utente.socioId e deprecato)
- `ruolo` (RuoloUtente) resta nel DB ma viene deprecato — il ruolo autorevole e su UtenteAzienda

#### Societa
- Aggiungere relazione `utentiAzienda UtenteAzienda[]`
- Aggiungere relazioni `scadenze ScadenzaAzienda[]`, `alert AlertAzienda[]`, `inviti InvitoAzienda[]`

#### LogAttivita
- Aggiungere `societaId Int?` — per filtrare i log per azienda senza join complessi
- Indice: `@@index([societaId, createdAt])`
- Migration: popolare societaId sui log esistenti dal record collegato (ove possibile)

### 2.7 Sessione JWT — Nuova struttura

```typescript
interface SessionUser {
  // Campi dall'Utente (non piu dal Socio)
  id: number;           // Utente.id
  email: string;
  nome: string;         // ORA da Utente.nome (non piu Socio.nome)
  cognome: string;      // ORA da Utente.cognome
  emailVerificata: boolean;
  isSuperAdmin: boolean;
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;

  // Campi dall'azienda corrente (da UtenteAzienda + Socio)
  societaId: number | null;      // azienda corrente
  socioId: number | null;        // socio nella azienda corrente (null se commercialista)
  ruolo: string;                 // RETROCOMPATIBILE: popolato da UtenteAzienda.ruolo
                                 // COMMERCIALISTA viene mappato a "ADMIN" per i check esistenti
  ruoloAzienda: string | null;   // ruolo originale (ADMIN|STANDARD|COMMERCIALISTA)
  quotaPercentuale: number;      // 0 se commercialista esterno

  // Multi-azienda: solo conteggio nel JWT (non la lista completa — evita bloat)
  numeroAziende: number;         // quante aziende ha l'utente
}
```

**Strategia JWT size:** il JWT contiene solo `numeroAziende` (un intero), non la lista completa. La lista viene fetchata da `GET /api/aziende` quando serve (dropdown sidebar, pagina "Le mie aziende"). Questo evita il problema dei 4KB per commercialisti con 50+ aziende.

**Strategia login senza Socio (commercialista):**

Il flusso `authorize` in auth.ts cambia:
1. Trova Utente per email (come oggi)
2. `nome`/`cognome` vengono da `Utente.nome`/`Utente.cognome` (non piu da Socio)
3. Cerca `UtenteAzienda` per questo utente → popola `numeroAziende`
4. Se ha 1 azienda → seleziona automaticamente, popola `societaId`/`socioId`/`ruolo`
5. Se ha 0 o >1 aziende → `societaId = null`, redirect a `/aziende` o `/crea-societa`
6. Se per l'azienda selezionata esiste un Socio con `utenteId = utente.id` → `socioId = socio.id`
7. Se non esiste Socio (commercialista) → `socioId = null`, `quotaPercentuale = 0`

---

## 3. Flussi Operativi

### 3.1 Switch azienda

1. Utente clicca sul nome azienda nella sidebar (dropdown)
2. Vede lista aziende con ruolo per ciascuna
3. Seleziona un'altra azienda
4. `POST /api/auth/switch-societa { societaId }` — verifica UtenteAzienda attivo, aggiorna JWT (societaId, socioId, ruoloAzienda), aggiorna ultimoAccesso
5. Pagina si ricarica con i dati della nuova azienda
6. Le 80+ route API continuano a leggere `session.societaId` — zero modifiche necessarie

### 3.2 Login con piu aziende

- 1 azienda → dashboard diretta (come oggi)
- \>1 azienda → pagina `/aziende` (dashboard multi-azienda)
- 0 aziende → `/crea-societa` (come oggi)

### 3.3 Invito commercialista

1. ADMIN va in Configurazione > Accessi
2. "Invita commercialista" → inserisce email
3. `POST /api/azienda/invita-commercialista { email }`
   - Se utente esiste: crea UtenteAzienda con ruolo COMMERCIALISTA
   - Se non esiste: invia email di invito con link di registrazione
4. Il commercialista fa login → vede la nuova azienda nella lista

### 3.4 Persona socio in piu aziende

1. ADMIN della SRL Beta invita mario@rossi.it (gia socio della SRL Alfa)
2. `POST /api/soci/invita { email, societaId }`
   - Trova Utente con quell'email
   - Crea NUOVO record Socio per la SRL Beta
   - Crea UtenteAzienda { utenteId, societaId: Beta, ruolo: STANDARD }
3. Mario fa login → vede entrambe le aziende

### 3.5 Creazione nuova azienda

Qualsiasi utente (titolare o commercialista) puo creare una nuova azienda:
1. Dalla pagina "Le mie aziende" → "Crea nuova azienda"
2. Wizard come oggi (ragione sociale, P.IVA, ecc.)
3. `POST /api/societa` → crea Societa + Socio + UtenteAzienda { ruolo: ADMIN }
4. Switch automatico alla nuova azienda

---

## 4. Dashboard "Le mie aziende"

### 4.1 Pagina `/aziende`

Griglia di card, una per azienda. Ogni card mostra:

**Header:** ragione sociale, tipo (SRL/SRLS/...), P.IVA, badge ruolo (ADMIN/STANDARD/COMMERCIALISTA), freccia per entrare

**KPI rapidi:** fatturato YTD, costi YTD, margine % — calcolati da API aggregata

**Alert:** conteggio + lista ultimi 3 alert non letti per azienda. Tipi:
- SCADENZA_IMMINENTE — scadenza entro 7 giorni
- SCRITTURA_PROVVISORIA — N scritture da completare
- IVA_DA_LIQUIDARE — periodo IVA da liquidare
- BILANCIO_NON_QUADRA — se il bilancio di verifica non quadra
- Click su alert → deep link alla pagina pertinente nell'azienda

**Scadenze:** lista prossime scadenze (30gg), ordinate per data, con:
- Descrizione, data, tipo (badge FISCALE/CONTABILE/GENERICA), priorita
- Checkbox per spuntare come completata
- Le scadute in evidenza (rosso)
- Pulsante "+ Aggiungi scadenza"

**Note:** lista note dell'utente per questa azienda
- Testo libero con colore opzionale
- Modificabili/cancellabili
- Solo per l'utente corrente (per-UtenteAzienda, non condivise)
- Pulsante "+ Aggiungi nota"

### 4.2 Sidebar — Company switcher

Nella sidebar, il nome dell'azienda corrente diventa un dropdown:
- Lista aziende con ruolo
- Click → POST switch-societa → ricarica
- Se una sola azienda, il dropdown non appare (comportamento attuale)

---

## 5. Accessi e Attivita

### 5.1 Pagina `/configurazione/accessi`

Visibile solo al ruolo ADMIN dell'azienda.

**Sezione 1 — Utenti con accesso:**
- Tabella: nome, email, ruolo, ultimo accesso, stato (attivo/disattivato)
- Azioni: modifica ruolo, disattiva/riattiva, rimuovi accesso
- Pulsante "Invita utente" (socio o commercialista)

**Sezione 2 — Log attivita:**
- Filtro per: utente, periodo, tipo azione (INSERT/UPDATE/DELETE), tabella
- Tabella: data/ora, utente, azione, entita, dettaglio (expand per valori prima/dopo)
- Evidenziazione azioni del commercialista (colore diverso)
- Export CSV

Il LogAttivita gia esistente registra `utenteId` per ogni azione. Basta filtrare per `utenteId` degli utenti con ruolo COMMERCIALISTA nell'azienda per isolare le azioni del commercialista.

Il commercialista NON vede questa pagina.

---

## 6. Migrazione Dati Esistenti

### 6.1 Strategia

Script di migrazione che:
1. Per ogni Utente-Socio esistente con societaId, crea un record UtenteAzienda
2. Il ruolo viene copiato da Socio.ruolo (ADMIN → ADMIN, STANDARD → STANDARD)
3. Il collegamento Utente → Socio resta per retrocompatibilita
4. Nessun dato viene perso o modificato

### 6.2 Retrocompatibilita

- `Utente.socioId` resta ma diventa opzionale (per i commercialisti che non sono soci)
- Le route API esistenti continuano a funzionare con `session.societaId`
- Il middleware per utenti con 1 azienda si comporta come prima
- Solo gli utenti con >1 azienda vedono il nuovo flusso

---

## 7. Impatto sulle API

### 7.1 API che NON cambiano (80+)

Tutte le route che leggono `session.user.societaId` per filtrare i dati continuano a funzionare identiche. Il societaId viene ora dal JWT aggiornato tramite switch-societa.

### 7.2 API da modificare

| API | Modifica |
|---|---|
| `src/lib/auth.ts` | JWT callback: popolare aziendeDisponibili da UtenteAzienda, gestire ruoloAzienda |
| `src/middleware.ts` | >1 azienda senza societaId selezionato → redirect `/aziende` |
| `src/types/index.ts` | Aggiornare SessionUser con nuovi campi |
| `POST /api/societa` | Rimuovere check "sei gia associato", creare UtenteAzienda |
| `POST /api/soci/invita` | Creare UtenteAzienda oltre al Socio |

### 7.3 Nuove API

| API | Metodo | Descrizione |
|---|---|---|
| `/api/auth/switch-societa` | POST | Cambia azienda corrente nella sessione JWT |
| `/api/aziende` | GET | Lista aziende dell'utente con KPI, alert, scadenze |
| `/api/azienda/invita-commercialista` | POST | Invita commercialista (crea UtenteAzienda con ruolo COMMERCIALISTA) |
| `/api/azienda/accessi` | GET | Lista utenti con accesso all'azienda corrente (solo ADMIN) |
| `/api/azienda/accessi/[id]` | PUT/DELETE | Modifica ruolo o rimuovi accesso (solo ADMIN) |
| `/api/azienda/log` | GET | Log attivita filtrato per azienda (solo ADMIN) |
| `/api/scadenze` | GET/POST | Lista e crea scadenze per la societa corrente |
| `/api/scadenze/[id]` | PUT/DELETE | Aggiorna (completa) o elimina scadenza |
| `/api/alert` | GET | Lista alert per la societa corrente |
| `/api/alert/[id]/letto` | PUT | Segna alert come letto |
| `/api/note-azienda` | GET/POST | Note dell'utente per l'azienda corrente |
| `/api/note-azienda/[id]` | PUT/DELETE | Modifica/elimina nota |

---

## 8. Nuove Pagine UI

| Pagina | Visibilita | Descrizione |
|---|---|---|
| `/aziende` | Tutti con >1 azienda | Dashboard multi-azienda con card, KPI, alert, scadenze, note |
| `/configurazione/accessi` | Solo ADMIN | Gestione accessi + log attivita commercialista |

### Componenti condivisi

| Componente | Uso |
|---|---|
| `CompanySwitcher` | Dropdown nella sidebar per switch rapido |
| `ScadenzaCard` | Card scadenza con checkbox, colore priorita |
| `NotaCard` | Card nota con colore, edit inline |
| `AlertBadge` | Badge con conteggio alert non letti |

---

## 9. Sicurezza e RLS

### 9.1 Validazione accesso cross-azienda

Creare una utility `requireCompanyAccess(utenteId, societaId)` usata in:
- `POST /api/auth/switch-societa` — valida PRIMA di aggiornare il JWT
- Middleware opzionale per le route piu sensibili

```typescript
// src/lib/auth-utils.ts
export async function requireCompanyAccess(utenteId: number, societaId: number): Promise<UtenteAzienda | null> {
  return prisma.utenteAzienda.findUnique({
    where: { utenteId_societaId: { utenteId, societaId } },
  });
}
```

### 9.2 Protezione switch-societa

L'endpoint `POST /api/auth/switch-societa` deve:
1. Verificare che esista un `UtenteAzienda` attivo per (utenteId, societaId)
2. Se non esiste → 403 Forbidden
3. Se esiste ma `attivo = false` → 403 Forbidden
4. Solo se valido → aggiornare il JWT

### 9.3 Considerazioni per il futuro

In un secondo momento si potra aggiungere un Prisma client extension che inietta automaticamente `where: { societaId }` in tutte le query, come safety net aggiuntivo. Per ora il pattern per-route e sufficiente (gia consolidato in 80+ route).

---

## 10. Decisioni Architetturali

| Decisione | Motivazione |
|---|---|
| Bridge table UtenteAzienda | Separa "chi accede" (Utente) da "chi possiede" (Socio) |
| Commercialista non e Socio | Nessuna quota societaria, nessuna ripartizione, solo accesso |
| `user.ruolo` popolato da UtenteAzienda.ruolo | Retrocompatibilita: le 30+ route con `user.ruolo !== "ADMIN"` funzionano senza modifiche |
| COMMERCIALISTA mappato a ADMIN nei check | Il commercialista ha accesso completo come da requisito |
| `nome`/`cognome` su Utente (non solo Socio) | Permette login senza Socio (commercialista esterno) |
| JWT contiene solo `numeroAziende` (non la lista) | Evita bloat del JWT per commercialisti con 50+ aziende |
| `societaId` aggiunto a LogAttivita | Permette filtro per azienda senza join complessi |
| Note per-UtenteAzienda, non per-Societa | Privacy: ogni utente ha le sue note, non vede quelle degli altri |
| Scadenze per-Societa | Condivise: tutti gli utenti dell'azienda vedono le stesse scadenze |
| Alert generati dal sistema | Automatici, non manuali. L'utente li legge e li dismissare |
| InvitoAzienda con token e scadenza | Traccia inviti pendenti, previene duplicati, supporta utenti non ancora registrati |
| Switch-societa aggiorna JWT, non crea nuova sessione | Mantiene l'utente loggato, cambia solo il contesto |
| `requireCompanyAccess` utility | Validazione centralizzata dell'accesso cross-azienda |
| Socio.email unique per societa (non globale) | Permette a mario@rossi.it di essere socio in N societa. Check applicativo per `societaId IS NULL` |
| Socio.utenteId e il link primario (Utente.socioId deprecato) | Direzione corretta: N Soci → 1 Utente. Il vecchio path resta per retrocompatibilita |
