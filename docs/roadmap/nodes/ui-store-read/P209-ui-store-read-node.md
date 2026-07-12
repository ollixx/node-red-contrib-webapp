---
id: P209
node: ui-store-read
title: "neuer Knoten ui-store-read: referenz-basierter On-Demand-Leser eines ui-store — jeder Input triggert Read; Path-Override msg.ui.store.path › msg.path › config; per-client, nicht-mutierend; payload + msg.ui.store"
epic: nodes/ui-store-read
findings:
  - "Owner (2026-07-10): 'Wir bleiben bei dem extra knoten. jeder input erzeugt die antwort, aber: Wenn der input ein msg.ui.store.path enthält oder direkt ein msg.path, dann wird der default path überschrieben und genutzt.'"
  - "Owner (2026-07-10, Motivation): 'Wenn mehrere usecases auf den store im backend zugreifen, ist das wieder zu wenig. … ein extra knoten, der auf einen store bindet und der NUR das read anbietet. Der könnte mehrfach genutzt werden.'"
  - "Kontext (ADR 0028): ui-store bleibt unverändert (kein read-Op, kein 2. Port). Der Leser ist ein eigener, referenz-basierter Knoten — beliebig oft platzierbar. Vier-Datei-Muster (js+html+schema+runtime), /node-red-node-Skill."
acceptance:
  - "Neuer Knoten `ui-store-read` ist registriert (nodes/webapp.js WEBAPP_NODE_TYPES + node-red.nodes in package.json) mit 1 Input, 1 Output. Config-Felder: `store` (Referenz auf einen ui-store, Node-Picker Preset Stores), `path` (optional, Default-Sub-Pfad, Textfeld), `parent` (App-Referenz, required — Deploy-Fehler wenn leer, wie P205)."
  - "Runtime: JEDE eingehende Message triggert einen Read. Gelesen wird der aktuelle Server-Zustand am `statePath` des referenzierten Stores (+ Sub-Pfad), NICHT-mutierend (keine State-Änderung, kein Snapshot-Push)."
  - "Path-Override-Präzedenz (belegt): `msg.ui.store.path` gewinnt über `msg.path`, das über den Config-`path`; ist nichts gesetzt → ganzes Slice am statePath. Unit/E2E deckt alle vier Fälle ab."
  - "Per-Client: der Read nutzt `msg.ui.clientId` → liest den per-client-Zustand dieses Clients (getClientState); ohne clientId → broadcast/liveState. Scope-Regel wie beim Schreiben: `client-only`-Store ohne clientId → strukturierter Scope-Fehler (server.store.scope-violation), kein stiller Leer-Read."
  - "Output-Form: der Knoten emittiert `msg.payload = <Wert>` UND `msg.ui.store = { id:<storeId>, event:'read', path, fullPath, value:<Wert>, clientId }`. `value` = ganzes Slice oder Teilwert je nach aufgelöstem Pfad."
  - "Browser/Integration (E2E, gemessen): Flow mit ui-store (client-only, initial {name:'A', city:'X'}) + ui-store-read; ein ui-input schreibt per-client name='B'; ein Trigger feuert den Reader → dessen Output-`msg.payload` = {name:'B', city:'X'} (aktueller per-client-Zustand). Mit `msg.path='name'` am Trigger → payload = 'B' (Override). Beweis über die emittierte Message (z. B. wired an einen Rück-Kanal/Debug), nicht über bloße Knoten-Registrierung."
  - "Doku: neue Spec docs/nodes/state/ui-store-read.md (jedes Feld: Typ/Default/Wirkung, Path-Präzedenz, per-client/scope, Output-Form) + Abgrenzung zu ui-store (schreiben+changed) und ui-query (externe read-only Daten). Editor-HTML-Hilfe. Node-Test-Katalog tests/e2e/nodes/state/ui-store-read.tests.md."
verify: browser
spec: docs/nodes/state/ui-store-read.md
tests: tests/e2e/nodes/state/ui-store-read.tests.md
dependencies: []
status: in_progress
---
# P209 — neuer Knoten `ui-store-read` (On-Demand-Store-Leser)

> Entscheidung & Begründung: [ADR 0028](../../../adr/0028-store-reads-are-a-separate-reference-node.md).
> Vier-Datei-Muster — vor dem Lesen von Quellcode den `/node-red-node`-Skill
> aufrufen (Templates + Checkliste).

## Kern

Ein reiner, referenz-basierter Leser. Beliebig oft platzierbar (kein Fan-out-
Nadelöhr auf ui-store). `ui-store` bleibt unangetastet.

```
[Trigger] → [ui-store-read • store=Entity, path?] → [DB upsert liest msg.payload]
```

- **Input:** jede Message → Read.
- **Pfad:** `msg.ui.store.path` › `msg.path` › Config-`path` › ganzes Slice.
- **Output:** `msg.payload = <Wert>` + `msg.ui.store = {id,event:'read',path,fullPath,value,clientId}`.
- **Nicht-mutierend, per-client** (`msg.ui.clientId`), Scope-Regel wie Schreiben.

## acceptance / verify

- `verify: browser` — Integrationsbeweis im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]): per-client editieren → Read
  triggern → emittiertes `msg.payload` = aktueller Zustand; Path-Override greift.
  Gemessen an der Message, nicht an der Registrierung.

## Risiken / Hinweise

- **`parent` required** (P205-Muster) — app-gebundener Referenz-Knoten.
- Nicht mit `ui-query` verwechseln: das liest **externe** Daten; `ui-store-read`
  liest **eigenen Client-Zustand**.
- Sub-Pfad ist EINE Ebene relativ zum `statePath` (ADR 0013), konsistent mit den
  Schreib-Ops und store-Bindings.
