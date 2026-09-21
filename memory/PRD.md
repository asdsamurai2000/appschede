# GymCode — PRD

## Product
Mobile app (React Native / Expo) per creare e distribuire schede di allenamento di palestra tramite codice a 6 cifre. Nessun login: l'host attiva un flag locale per gestire le schede; il cliente riceve dal proprio coach un codice a 6 cifre per accedere alla scheda dedicata.

## User Roles
- **Host (coach)**: crea, modifica ed elimina schede. Flag `isHost` in AsyncStorage.
- **Cliente**: accede con codice a 6 cifre alla propria scheda, esegue sessioni, effettua check-in.

## Core Features
1. Access code entry con toggle "Modalità Host"
2. Host Dashboard: lista schede con codice cliente + stats (n. clienti, sessioni totali)
3. Scheda Editor: nome scheda, nome cliente, 1-5 sessioni con esercizi (serie/reps/peso/recupero/note)
4. Libreria esercizi (15 preseed italiani) + picker in editor, add/delete lato host
5. Client Dashboard: numero settimana in evidenza, stats week/month/year/total, chart 12 settimane, elenco sessioni, storico check-in
6. Active Session: chip serie tap-to-complete, rest timer full-screen con barra depleting + "salta / +30s", CTA "termina & registra" che crea check-in con `session_name`
7. Settings: toggle tema chiaro (bianco/rosso) ↔ scuro (nero/rosso) con persistenza, toggle modalità host, reset codice, link libreria

## Backend Endpoints (`/api`)
- `POST /schede`, `GET /schede`, `GET /schede/{code}`, `PUT /schede/{code}`, `DELETE /schede/{code}`
- `POST /checkins`, `GET /checkins/{code}`, `GET /checkins/{code}/stats`, `DELETE /checkins/{id}`
- `GET /exercises`, `POST /exercises`, `DELETE /exercises/{id}` (seed automatico se DB vuoto)

## Storage (MongoDB)
- `schede` (id, code, name, client_name, sessions[], created_at, updated_at)
- `checkins` (id, code, session_id, session_name, timestamp)
- `exercises` (id, name, muscle_group, description)

## Design
"5 Brutalist Mobile" — bordi 2pt neri, radius 0, palette bianco/rosso ↔ nero/rosso (#E52020 light / #FF3333 dark), typografia system con monospace per le metriche numeriche.

## Auth (v1.1)
- Host mode è protetta da **password server-side** (bcrypt-hashed in `HOST_PASSWORD_HASH`).
- Endpoint `POST /api/host/verify` verifica la password con `bcrypt.checkpw` in threadpool + rate limit in-memory 5/min per IP.
- Frontend: schermata `/host-unlock` con `TextInput secureTextEntry`, occhio per rivelare, gestione errori (401 / 429). Flag `gymcode.host.verified.v1` in SecureStore/AsyncStorage.
- Password default: `gymhost2026` — cambiabile aggiornando il .env e riavviando il backend.

## Non-Goals (v1)
- Autenticazione / registrazione
- Sync multi-device
- Notifiche push
- AI generation
