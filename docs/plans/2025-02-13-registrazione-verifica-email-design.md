# Design: Registrazione Account con Verifica Email OTP

**Data:** 13 Febbraio 2025
**Stato:** Approvato

---

## Obiettivo

Implementare la self-registration degli utenti con:
- Form di registrazione minimale (nome, cognome, email, password)
- Verifica email tramite codice OTP a 5 cifre (validità 1 ora)
- Invio email tramite Resend
- Dopo la verifica, l'utente potrà creare/associare una società (wizard futuro)

---

## Decisioni di Design

- **Flusso**: Registrazione minimale → verifica OTP → login → wizard società (futuro)
- **OTP**: 5 cifre, scadenza 1 ora, max 5 tentativi per codice
- **Email provider**: Resend
- **Admin società**: chi registra la società diventa admin, trasferibile con approvazione
- **Super Admin**: ruolo sviluppatore, accesso a tutte le società, creato via seed DB

---

## 1. Schema Database

### Nuova tabella: `VerificaEmail`

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| id | Int | PK, autoincrement | |
| email | String | NOT NULL | Email dell'utente |
| codice | String(5) | NOT NULL | Codice OTP 5 cifre |
| scadenza | DateTime | NOT NULL | Ora creazione + 1 ora |
| verificato | Boolean | DEFAULT false | Codice già usato |
| tentativi | Int | DEFAULT 0 | Tentativi errati (max 5) |
| createdAt | DateTime | DEFAULT now() | |

Indice: `email` + `verificato` + `scadenza`

### Modifiche a `Utente`

- Aggiunta: `emailVerificata` (Boolean, default false)

### Modifiche a `Socio`

- `societaId` diventa **opzionale** (nullable) - alla registrazione il socio non ha società

### Modifiche a `RuoloUtente` enum

- Aggiunta valore: `SUPER_ADMIN`
- `SUPER_ADMIN` non è legato a nessuna società
- Accesso completo a tutti i dati di tutte le società
- Creato solo via seed DB (non registrabile da UI)

---

## 2. Flusso UI

### Pagina `/registrazione` (pubblica)

Form con:
- Nome (obbligatorio)
- Cognome (obbligatorio)
- Email (obbligatorio, formato email)
- Password (obbligatorio, min 8 caratteri)
- Conferma password (deve corrispondere)

Bottone "Registrati" → crea account → invia OTP → redirect a `/verifica-email`

### Pagina `/verifica-email`

- Messaggio: "Abbiamo inviato un codice a 5 cifre a **email@...**"
- 5 input singoli per le cifre (stile OTP)
- Link "Rinvia codice" (cooldown 60 secondi)
- Dopo verifica corretta → redirect a `/login` con messaggio successo
- Dopo 5 tentativi errati → "Troppi tentativi, richiedi un nuovo codice"

### Modifiche a `/login`

- Aggiunta link "Non hai un account? Registrati" → `/registrazione`
- Se login con email non verificata → messaggio + redirect a `/verifica-email`

### Modifiche al middleware

Rotte pubbliche (senza autenticazione):
- `/login`
- `/registrazione`
- `/verifica-email`
- `/api/auth/*`

Dopo il login:
- Se `emailVerificata === false` → redirect a `/verifica-email`
- Se `societaId === null` → redirect a wizard creazione società (futuro)

---

## 3. API Backend

### `POST /api/auth/registrazione`

**Input:**
```json
{ "nome": "Mario", "cognome": "Rossi", "email": "mario@test.com", "password": "password123" }
```

**Logica:**
1. Validazione con Zod (email formato, password min 8, campi obbligatori)
2. Verifica email non già registrata → 409 se esiste
3. Hash password con bcrypt (12 rounds)
4. Transazione DB:
   - Crea `Socio` (nome, cognome, email, `societaId: null`, `ruolo: ADMIN`, `quotaPercentuale: 0`)
   - Crea `Utente` (email, passwordHash, `emailVerificata: false`, `socioId: socio.id`)
5. Genera codice 5 cifre random (10000-99999)
6. Salva in `VerificaEmail` (email, codice, scadenza: now + 1h)
7. Invia email con Resend
8. Risponde 201

### `POST /api/auth/verifica-email`

**Input:**
```json
{ "email": "mario@test.com", "codice": "38472" }
```

**Logica:**
1. Cerca ultimo `VerificaEmail` per email (non verificato, non scaduto)
2. Se non trovato → 400 "Codice scaduto o non trovato"
3. Se `tentativi >= 5` → 429 "Troppi tentativi, richiedi un nuovo codice"
4. Se codice errato → `tentativi++`, 400 "Codice errato"
5. Se codice corretto:
   - `VerificaEmail.verificato = true`
   - `Utente.emailVerificata = true`
6. Risponde 200

### `POST /api/auth/rinvia-codice`

**Input:**
```json
{ "email": "mario@test.com" }
```

**Logica:**
1. Verifica utente esiste e `emailVerificata === false`
2. Rate limit: ultimo invio < 60 secondi fa → 429
3. Invalida vecchi codici (marca come verificati o elimina)
4. Genera nuovo codice 5 cifre
5. Salva + invia con Resend
6. Risponde 200

---

## 4. Template Email

**Oggetto:** "Il tuo codice di verifica: XXXXX"

**Corpo:**
```
Ciao [Nome],

Il tuo codice di verifica per Prima Nota è:

[XXXXX]

Questo codice è valido per 1 ora.

Se non hai richiesto questo codice, puoi ignorare questa email.
```

---

## 5. Sicurezza

- **Brute-force protection**: max 5 tentativi per codice OTP
- **Rate limiting reinvio**: max 1 email ogni 60 secondi
- **Password hashing**: bcrypt con 12 rounds
- **Codice random**: generato con `crypto.randomInt` (crittograficamente sicuro)
- **Scadenza**: codici invalidi dopo 1 ora
- **Email non esposta**: messaggi generici ("codice errato" non rivela se l'email esiste, tranne in registrazione dove è necessario)

---

## 6. Dipendenze da installare

- `resend` - SDK per invio email

---

## 7. File da creare/modificare

### Nuovi file:
- `src/app/registrazione/page.tsx` - Form registrazione
- `src/app/verifica-email/page.tsx` - Pagina verifica OTP
- `src/app/api/auth/registrazione/route.ts` - API registrazione
- `src/app/api/auth/verifica-email/route.ts` - API verifica codice
- `src/app/api/auth/rinvia-codice/route.ts` - API reinvio codice
- `src/lib/email.ts` - Utility invio email con Resend
- `prisma/migrations/XXXX_add_verifica_email/` - Migration DB

### File da modificare:
- `prisma/schema.prisma` - Aggiunta modello VerificaEmail, campo emailVerificata, societaId nullable, SUPER_ADMIN
- `src/middleware.ts` - Rotte pubbliche aggiuntive
- `src/app/login/page.tsx` - Link a registrazione
- `src/lib/auth.ts` - Gestione emailVerificata nel login
- `src/types/index.ts` - Aggiornamento tipi
- `.env` - Aggiunta RESEND_API_KEY
