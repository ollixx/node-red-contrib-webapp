---
id: P171
node: ui-list
epic: nodes/ui-list
title: "ui-list an die Spec angleichen: items als Wert-typedInput (itemsPath migrieren), Item-Schema-Validierung, Events-Checkboxen, Hilfetext"
findings:
  - "Owner (2026-06-13): 'Die Docs wurden noch nicht umgesetzt.' Der Editor nutzt heute ein nacktes itemsPath-Textfeld plus ein ungenutztes items:null — statt des items-typedInput aus der Spec."
  - "Owner (2026-06-13): 'In der Spec fehlt die exakte Beschreibung des Schemas, das ein Item in items haben kann/muss. Das ist auch der Schwachpunkt des Knotens, dass der Nutzer hier genau verstehen muss, was mit dem Datenmodell passiert.' (Spec ist jetzt glattgezogen — dieser Knoten setzt sie um.)"
acceptance:
  - "Editor: ein items-typedInput (Wert-Bindings literal/state/query/store/routeParam/msg/flow/global/jsonata/env) ersetzt das itemsPath-Textfeld; das ungenutzte items:null-Feld ist weg."
  - "Migration: ein gespeichertes itemsPath (plain string) wird beim Laden als state-Binding auf items übernommen; bestehende Flows rendern unverändert weiter (test-bar)."
  - "Item-Schema: items löst zu einem Array von {id?,label,value?,icon?} auf; pro Element rendert label (Pflicht) + optional icon + value; fehlt label an einem Element → Nicht-darstellbar-Hinweis (\"?\") nur für diese Zeile; Nicht-Array (Skalar/Objekt/null) → leere Liste, kein Crash; Zusatzfelder werden ignoriert."
  - "Events: die itemClick/itemSelect-Checkboxen erzeugen Output-Ports; rowId = id (sonst Index), row = Element."
  - "Hilfetext nennt das Item-Schema (label Pflicht, kein implizites Mapping) + Doku-Link."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: pending
---
# P171 — ui-list: items-typedInput + Item-Schema

> Gleicht den Knoten an die (frisch geglättete) Spec an. Kernpunkt ist das
> **Datenmodell**: `items` als Wert-typedInput mit dem festen Item-Schema, das der
> Autor verstehen können muss.

## Umfang

1. **`items`-typedInput** (Wert-Bindings) ersetzt das nackte `itemsPath`-Textfeld;
   das ungenutzte `items: null`-Default entfällt. Folgt der Field-Typing-Konvention
   (ADR 0012) wie die übrigen `*Path`→Wert-Migrationen.
2. **Migration** `itemsPath` (string) → `state`-Binding auf `items` (verlustfrei,
   beim Laden); analog `activeTabPath`→`activeTab` bei ui-tabs.
3. **Item-Schema-Vertrag** im Renderer/Validierung: `{id?,label,value?,icon?}`,
   `label` Pflicht; Nicht-Array → leere Liste; fehlendes `label` → `"?"` pro Zeile;
   Zusatzfelder ignoriert; **kein implizites Mapping**.
4. **Events-Editor:** `itemClick`/`itemSelect`-Checkboxen → Output-Ports (heute im
   Schema vorhanden, aber ohne Editor-Control).
5. **Hilfetext** gemäß Spec (Item-Schema + Link).

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*`/Playwright). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Schema-Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- Basis-Felder sind **P172** (separat, hängt auf diesem auf).
- `examples/customers-crud/flow.json` nur via `pnpm gen:example`.
