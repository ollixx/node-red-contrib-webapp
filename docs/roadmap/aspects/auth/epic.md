# Epic: auth

App-weite **Authentifizierung/Autorisierung** nach [ADR 0041](../../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md):
IdP-agnostische Identität (`user = {id, name?, email?, groups[]}`),
**trusted-header zuerst** (Reverse-Proxy/IAP-Muster), Identität als
**Binding-Quelle**, Autorisierung **deklarativ + server-erzwungen** an
Route/Dialog. Das Framework besitzt **nie** Credentials.

Aufgelöst wird damit der P107-Offene-Punkt (ui-app: Auth nicht modelliert).

## Pakete

- **P260** — ADR-Contract + Konzept-Doku + `ui-app.auth`-Feld (kein Enforcement)
- **P261** — trusted-header-Quelle: Middleware über alle 7 Endpoints + `user`-Binding
- **P262** — Route-/Dialog-Guards (`requiresGroup[]`), server-erzwungen
- deferred: **P263** per-user-State (koppelt an P210) · **P264** in-App OIDC RP
  (nur falls proxy-loser Betrieb Ziel wird; koppelt an P210)

## Nicht-Ziele

Kein eigener User-Store, keine Passwörter/Passkeys (IdP-Sache), kein Editor-Auth
(Node-RED `adminAuth`, nur dokumentiert), keine API-Token (eigenes Thema).
