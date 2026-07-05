---
id: P201
node: ui-store
epic: nodes/ui-store
title: "client-only Store: per-client-Update (set/replace mit clientId) aktualisiert einen store-gebundenen View NICHT live — bleibt beim Initialwert; test-first reproduzieren + fixen"
findings:
  - "Owner (2026-06-20, Dev-Flow Entity Editor, mit Erlaubnis gelesen): ui-store 'Entity Editor' (id=3a9484aa9ec7aa4b, statePath='entity', scope='client-only', initial {name:'Eine Entität'}). Ein ui-list-itemClick → function setzt msg.ui.store={id, op:'replace', value:{name:…}} MIT msg.ui.clientId (aus dem Event). Ein ui-text (id=c81e12efb4774169) bindet value={kind:'store', path:'3a9484aa9ec7aa4b', subPath:{literal:'name'}} = store(entity).name."
  - "Symptom: der ui-text zeigt IMMER den Initialwert; der neue per-client-Wert erscheint nie (auch nach Reload). Der Store-Op GREIFT aber: Debug am Out-Port zeigt msg.ui.store.event='changed', op='replace', clientId gesetzt (per-client)."
  - "Server-Read-Through (korrekt auf dem Papier): applyStoreOperation replace schreibt statePath korrekt; der Caller ruft setClientState(clientId) + pushSnapshotToClients(clientId) (webapp.js:5844). buildAppSnapshot (webapp.js:2188-2192) wählt per-client-State wenn getClientState(appId,clientId) vorhanden, sonst broadcast; mergeDeep(base, override) lässt override (per-client) gewinnen. Client nutzt EINE clientId (localStorage) für SSE UND Events → kein Mismatch. Trotzdem bleibt der View am Initial → der Bug ist subtil (per-client-State beim Push nicht gefunden ODER client-seitiges Morphen des store-subPath-Texts). KEINE E2E-Fixture nutzt bisher scope='client-only'."
acceptance:
  - "Reproduktion (test-first, E2E): eine Fixture spiegelt den Fall — client-only ui-store (initial {name:'A'}), ein ui-text mit store(x).name-Binding (subPath-literal), ein Auslöser der eine per-client-Store-Op mit msg.ui.clientId schickt (op replace/set, wechselnder Wert). Assertion: der ui-text aktualisiert sich LIVE (ohne Reload) auf den neuen Wert. Dieser Test ist ZUERST ROT (Bug reproduziert), nach dem Fix GRÜN."
  - "Root-Cause identifiziert + gefixt: die Reproduktion legt die exakte Zeile offen (Kandidaten: getClientState liefert beim Push nicht die frisch per setClientState geschriebene Entry; ODER die per-client-Snapshot-Auflösung/das client-seitige Morphing eines store-subPath-Texts). Fix an der Wurzel, kein Symptom-Patch."
  - "Reload zeigt danach ebenfalls den aktuellen per-client-Wert (State-Persistenz je Client, P15)."
  - "Regression: der Broadcast-Fall (scope='any', ohne clientId) aktualisiert store-gebundene Views weiterhin (nicht durch den Fix gebrochen); der Scope-Guard bleibt (client-only ohne clientId → scope-violation)."
  - "Store-subPath-Binding (P131/P132) und store-whole-slice-Binding beide abgedeckt (der Owner nutzt subPath 'name')."
verify: browser
spec: docs/nodes/state/ui-store.md
tests: tests/e2e/nodes/state/ui-store.tests.md
dependencies: []
status: pending
---
# P200 — client-only Store: per-client-Update erreicht den gebundenen View nicht

> **Bug (Owner, reproduzierbar).** Ein `client-only`-Store wird per-client
> aktualisiert (Op greift, Debug zeigt `changed` + clientId), aber ein
> `store`-gebundener `ui-text` bleibt beim **Initialwert**. Broadcast-Updates sind
> E2E-getestet — **client-only ist es nicht** (keine Fixture). Genau da sitzt der
> Fehler.

## Vorgehen (test-first)

1. **Reproduzieren:** eine E2E-Fixture, die den Owner-Fall minimal spiegelt
   (client-only Store + `store(x).name`-Text + per-client-Op mit `clientId`). Die
   Assertion „Text aktualisiert sich live" ist der rote Test.
2. **Wurzel finden:** an der Reproduktion entlang — ist `effectiveState` beim
   Push für die richtige clientId aufgelöst (getClientState-Treffer)? Enthält der
   gepushte Snapshot bereits den neuen Wert (Server), oder kommt er an und der
   `store`-subPath-Text morpht client-seitig nicht (Client)?
3. **Fixen** an der identifizierten Stelle; die Reproduktion wird grün; als
   dauerhafter Regressionstest behalten.

## acceptance / verify

- `verify: browser` — die Reproduktions-E2E (rot → grün) im Haupt-Checkout durch
  den Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Nicht raten:** die Server-Kette liest sich korrekt (State-Auswahl, mergeDeep,
  effectiveState). Erst reproduzieren, dann fixen — sonst Symptom-Patch.
- Der Fix darf den **Broadcast**-Pfad und den **Scope-Guard** nicht brechen.
- Fällt die Reproduktion server-seitig aus (Snapshot hat schon den neuen Wert),
  liegt es im Client (webapp-client.js Morph des store-subPath-Textknotens) —
  dann dort fixen.
