---
id: P171
node: ui-list
epic: nodes/ui-list
title: "ui-list an die Spec angleichen: items als Wert-typedInput (itemsPath migrieren), Item-Schema-Validierung, Events-Checkboxen, Hilfetext"
findings:
  - "Owner (2026-06-13): 'Die Docs wurden noch nicht umgesetzt.' Der Editor nutzt heute ein nacktes itemsPath-Textfeld plus ein ungenutztes items:null — statt des items-typedInput aus der Spec."
  - "Owner (2026-06-13): 'In der Spec fehlt die exakte Beschreibung des Schemas, das ein Item in items haben kann/muss. Das ist auch der Schwachpunkt des Knotens, dass der Nutzer hier genau verstehen muss, was mit dem Datenmodell passiert.'"
  - "Owner (2026-06-13): 'Wir sollten ein Array of Strings erlauben und intern auf label mappen.'"
  - "Owner (2026-06-13): 'Was bringt es, eine ID und ein value feld zu unterstützen? ... Die Semantik ist mir nicht 100% klar.' → Entscheidung: id = Identität (Event-rowId+Key); value = Anwendungswert, stets im Event (row.value); Anzeige via neuem Node-Feld displayValue (none/secondary/badge), bei badge ein badgeVariant-typedInput."
  - "Owner (2026-06-13): 'Im Feld items sollten dann alle Types raus, die kein valides Model liefern können. Also String, number, boolean etc.'"
acceptance:
  - "Editor: ein items-typedInput ersetzt das itemsPath-Textfeld; das ungenutzte items:null-Feld ist weg. Die typedInput-Typen sind eingeschränkt — Skalar-Literale (str/num/bool) NICHT anwählbar; erlaubt nur json (Array) + state/query/store/routeParam/msg/flow/global/jsonata/env."
  - "Migration: ein gespeichertes itemsPath (plain string) wird beim Laden als state-Binding auf items übernommen; bestehende Flows rendern unverändert weiter (test-bar)."
  - "Array-of-Strings: ein String-Element wird auf {label:<string>} gemappt; gemischte Arrays (Strings + Objekte) rendern."
  - "Item-Schema: items löst zu einem Array von String|{id?,label,value?,icon?} auf; label Pflicht (Objektform); fehlt label → \"?\" nur für diese Zeile; Nicht-Array-Wurzel → leere Liste, kein Crash; Zusatzfelder ignoriert; kein implizites Mapping."
  - "value-Semantik: value (String|Number) wird — wenn vorhanden — stets im Event mitgeliefert (row.value). Das Node-Feld displayValue (none/secondary/badge, Default none) steuert NUR die Anzeige; bei badge erscheint badgeVariant (Variant-SelectBox mit SEVERITY_VARIANTS, Default neutral) und value rendert als Badge in dieser Farbe. displayValue/badgeVariant sind node-weit."
  - "itemClick-Event: Output-Port; params {rowId, row} + clientId/sourceId/appId (Standardformat); rowId = id (sonst Index), row = ganzes Element inkl. value. (itemSelect/Single-Select: siehe P173.)"
  - "Hilfetext nennt das Item-Schema (label Pflicht, String-Kurzform, value/displayValue, kein implizites Mapping) + Doku-Link."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: in_progress
---
# P171 — ui-list: items-typedInput + Item-Schema

> Gleicht den Knoten an die (frisch geglättete) Spec an. Kernpunkt ist das
> **Datenmodell**: `items` als Wert-typedInput mit dem festen Item-Schema, das der
> Autor verstehen können muss.

## Umfang

1. **`items`-typedInput** (Wert-Bindings) ersetzt das nackte `itemsPath`-Textfeld;
   das ungenutzte `items: null`-Default entfällt. **Typ-Einschränkung:** Skalar-
   Literale (`str`/`num`/`bool`) ausblenden — nur `json`(Array) + die Binding-Arten,
   die ein Array/Objekt liefern. Folgt ADR 0012.
2. **Migration** `itemsPath` (string) → `state`-Binding auf `items` (verlustfrei,
   beim Laden); analog `activeTabPath`→`activeTab` bei ui-tabs. **Mapping
   präzise:** führendes `state.` abziehen (`state.foo.bar` → Pfad `foo.bar`), sonst
   ganzer String als State-Pfad — kein doppeltes `state.state.…`.
3. **Item-Schema-Vertrag** (Schema/Renderer/Validierung):
   - Element = **String** (→ `{label}`) **oder** Objekt `{id?,label,value?,icon?}`.
   - `label` Pflicht (Objektform); Nicht-Array-Wurzel → leere Liste; fehlendes
     `label` → `"?"` pro Zeile; Zusatzfelder ignoriert; **kein implizites Mapping**.
4. **value-Anzeige:** neues Node-Feld **`displayValue`** (SelectBox
   `none`/`secondary`/`badge`, Default `none`) + **`badgeVariant`** (Variant-
   **SelectBox** mit `SEVERITY_VARIANTS` wie ui-badge, nur sichtbar bei `badge`,
   Default `neutral`). `value` immer im Event (`row.value`); Anzeige rein über
   `displayValue`; beide node-weit.
5. **Events-Editor:** `itemClick`-Checkbox → Output-Port (heute im Schema, aber
   ohne Editor-Control); `params {rowId,row}` + `clientId`/`sourceId`/`appId`.
   (`itemSelect` + Single-Select sind **P173**.)
6. **Hilfetext** gemäß Spec (Item-Schema + String-Kurzform + value/displayValue).

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*`/Playwright). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Schema-Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- Basis-Felder sind **P172** (separat, hängt auf diesem auf).
- `examples/customers-crud/flow.json` nur via `pnpm gen:example`.
