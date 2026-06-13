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
status: done
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

## Result

- **delivered:** ui-list aligned to spec (ADR 0012). (1) `items` is now a **structural**
  value-typedInput — new `structural` category in `valueBindingTypes` (editor-common.js) that
  excludes scalar literals (str/num/bool/date) and keeps `json` + array/object-yielding kinds
  (store/query/routeParam/reactive/msg/jsonata/flow/global/env); unused `items:null` default
  removed; routes through `bind.items` via the shared structural resolver (menu/table/select path).
  (2) Lossless `itemsPath`→`state` migration with precise leading-`state.` stripping (webapp.js,
  editor nodes.ts, HTML). (3) Item-schema contract (String → `{label}` | `{id?,label,value?,icon?}`;
  label required; non-array root → empty list; missing label → `"?"` per-row; extra fields ignored;
  no implicit mapping; mixed arrays render). (4) New node-wide `displayValue` (none/secondary/badge)
  + `badgeVariant` (SEVERITY_VARIANTS, shown only at badge); `value` always carried in the event,
  display-only control. (5) `itemClick` events checkbox → output port; client emits `params
  {rowId,row}` + clientId/sourceId/appId (rowId = id else index, row = whole element incl. value).
  (6) Help text + doc link. Touched schema/renderer/webapp.js/editor/ui-list.html + spec.
- **stats:** 10 files + 3 new unit suites (+25 P171 tests) + new E2E. Unit green (runtime 983 /
  renderer 103 / editor 108 / schema). Develop verification: `pnpm build` exit 0; **browser proof +
  editor regression 33/33 green** — ui-list view spec 9/9 (array-of-strings labels, mixed arrays,
  object items + value + `displayValue=badge` → badge in `badgeVariant`, itemsPath migration,
  itemClick `{rowId,row}`) + editor minimal-coverage 24/24 (ui-list guard intact). check:roadmap +
  check:links + lint OK.
- **notes:** Reused the structural-array resolver (P133/P157/P158) and the ui-badge
  SEVERITY_VARIANTS/variant-SelectBox — no new mechanism. Base fields are **P172** and single-select
  /`itemSelect` is **P173** (both deps on this, now unblocked) — intentionally out of scope here.
- **cost:** session a7d830cb0a6b3fd23, ~28m (+ orchestrator develop browser proof).
