---
id: P110
title: "ui-store: scope-Guard (Any / Broadcast Only / Client Only) — verhindert versehentliches Überbügeln per falscher Message"
epic: nodes/ui-store
status: in_progress
dependencies: [P15, P80]
node: ui-store
verify: browser
spec: docs/nodes/state/ui-store.md
tests: tests/e2e/nodes/state/ui-store.tests.md
---
# P110 — ui-store: scope-Guard

## Findings
> Owner-Entscheidung 2026-06-09 (Review-Gap 1). Kein neues State-Feature — ein
> **Write-seitiger Guard**, der den deklarierten Store-Typ erzwingt und so das
> stille, destruktive „aus Versehen alle Daten überbügelt" zu einem lauten
> Fehler macht.

- Broadcast-vs-Per-Client wird heute pro Message über `msg.ui.clientId` on/off entschieden ([webapp.js Per-Client-Write/Read](../../../../nodes/webapp.js)). Ein `scope`-Feld am `ui-store` deklariert den **gewollten** Typ und weist verletzende Messages ab. Nebeneffekt: weil die Misch-Nutzung verboten wird, kann die alte Read-Kollision (Per-Client-Client sieht keine Broadcasts) gar nicht mehr entstehen.

## Acceptance
> `verify: browser` — Editor-Feld + Message-Round-Trip im laufenden Node-RED.

- Editor: `ui-store` hat ein `scope`-Feld (SelectBox) mit `Any` (Default) / `Broadcast Only` / `Client Only`.
- **Any** (Default): keine Prüfung — heutiges Verhalten, back-compat (alte Configs ohne `scope` = `Any`). Test.
- **Broadcast Only**: eine Store-Op-Message **mit** `clientId` → strukturierter Fehler `server.store.scope-violation` mit klarer Meldung „ClientID auf Broadcast-Only-Store nicht erlaubt" (P80-Pfad). Op wird **nicht** ausgeführt. Eine Message **ohne** clientId → läuft durch. Tests (beide Richtungen).
- **Client Only**: eine Store-Op-Message **ohne** `clientId` → Fehler `server.store.scope-violation` „Broadcast nicht erlaubt: Store ist Client Only". Eine Message **mit** clientId → läuft durch. Tests.
- Pass-Through fremder Messages unverändert (wie P80).
- Reads bleiben unverändert (kein Merge nötig — siehe Findings).
- Doc: ui-store.md um das `scope`-Feld + die Guard-Semantik + die drei Werte ergänzt; Test-Katalog `tests/e2e/nodes/state/ui-store.tests.md` angelegt/aktuell.

## Notes
- Begleitend ein **kurzer ADR** „Store state model: write-clientId-driven; `scope` as an optional guard; per-client-merge & true per-client stores deferred" — hält fest, *warum* wir **keine** Per-Store-State-Architektur / keinen Read-Merge gebaut haben (verhindert Re-Litigation). Klein, kein Epic.
- Echte per-client-Stores als produktives Feature (Fan-out-Semantik, Lebensdauer) bleiben **deferred**, bis ein konkreter Multi-User-Privat-Bedarf auftaucht.
