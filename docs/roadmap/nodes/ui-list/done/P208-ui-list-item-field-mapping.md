---
id: P208
node: ui-list
title: "ui-list Item-Feld-Mapping: labelField/valueField/idField/iconField — rohe Entities direkt binden, ohne Reshape (Default label/value/id/icon = rückwärtskompatibel)"
epic: nodes/ui-list
findings:
  - "Owner (2026-07-10): 'wir brauchen projection eigentlich für die ui-list. Da sind die original entities blöd. Gibt es einen besseren weg, als tingo aufbohren o.ä.?'"
  - "Owner (2026-07-10, nach Analyse): plane C ein — ui-list bekommt konfigurierbares Item-Feld-Mapping; simple Feldnamen-Strings mit Default-Fallback zum Start."
  - "Code-Befund: ui-list codiert die Item-Feldnamen HART — der Serializer liest `row.label` (resources/lib/webapp-serializer.js:1231-1233), `row.id` (:1234, → rowId für itemClick + selectedId), `row.value` (:1237) und `row.icon` (:1254). Eine rohe Entity {_id, name, city} hat kein `.label` → das Label rendert als '?'. DB-Projection kann das NICHT lösen (sie lässt Felder weg, benennt aber `name`→`label` nicht um) — das Shaping gehört an die Liste, nicht an die DB."
acceptance:
  - "Schema (packages/schema): der ui-list-Kontrakt erhält vier optionale String-Felder `labelField`, `valueField`, `idField`, `iconField`. Absent ⇒ Defaults `label`/`value`/`id`/`icon` (Unit-Test: Defaults gesetzt; explizite Werte übernommen)."
  - "Serializer (resources/lib/webapp-serializer.js): die vier hart codierten Zugriffe lesen stattdessen `row[labelField]`, `row[idField]`, `row[valueField]`, `row[iconField]` (Feldnamen aus den component.props, mit den Defaults). Flache Feldnamen (kein Dot-Pfad) in dieser Stufe."
  - "Browser (E2E, gemessen): ein ui-list mit `items` = rohe Entities `[{_id:'e1', name:'Alpha'}, {_id:'e2', name:'Bravo'}]`, `labelField='name'`, `idField='_id'` rendert die Zeilen-Labels als 'Alpha'/'Bravo' (DOM-Textmessung, nicht Tag). Ein itemClick liefert `params.rowId = 'e1'` (aus idField) und `params.row` = die VOLLE rohe Entity (unverändert)."
  - "Rückwärtskompatibel: bestehende Listen mit bereits geformten Items {id,label,value,icon} und OHNE gesetzte *Field-Optionen rendern unverändert (Defaults greifen). Bestehende ui-list-E2E bleiben grün."
  - "Konsistenz idField: das gerenderte `rowId` (aus idField) ist derselbe Schlüssel, den selectable/selectedId (P173) und der itemSelect-Roundtrip nutzen — Auswahl markiert die richtige Zeile, wenn idField gesetzt ist."
  - "Editor (nodes/view/ui-list.html): vier Textfelder Label/Value/Id/Icon-Field mit sichtbaren Defaults (label/value/id/icon). Öffnen→speichern→Werte round-trippen."
  - "Doku (docs/nodes/display/ui-list.md): das Feld-Mapping ist dokumentiert (jedes Feld: Default, Wirkung, flach-nur-Limitation, Hinweis dass itemClick.row die volle Entity behält). Node-Test-Katalog tests/e2e/nodes/view/ui-list.tests.md listet die neuen Tests."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: done
---
# P208 — ui-list Item-Feld-Mapping (rohe Entities direkt binden)

> Owner-Feature (2026-07-10): eine ui-list soll rohe Query-Entities ohne
> Reshape/Function und ohne DB-Projection anzeigen — indem sie liest, WELCHES
> Entity-Feld das Label/Value/Id/Icon ist.

## Kern

Vier optionale Feldnamen auf ui-list, Default = die heutigen harten Namen:

| Option | Default | Wirkung |
|---|---|---|
| `labelField` | `label` | angezeigter Zeilentext = `row[labelField]` |
| `idField` | `id` | `rowId` (itemClick/selectedId) = `row[idField]` |
| `valueField` | `value` | Event-/Display-Wert = `row[valueField]` |
| `iconField` | `icon` | Leading-Icon = `row[iconField]` |

Serializer statt hart `row.label`/`row.id`/`row.value`/`row.icon` →
`row[<field>]` mit den Props-Werten. `items` bleibt die rohe Entity-Liste;
`itemClick.params.row` bleibt die **volle** Entity (nur die abgeleiteten
label/id/value/icon nutzen das Mapping).

## acceptance / verify

- `verify: browser` — gemessen (DOM-Text der Zeilen = das gemappte Feld; rowId im
  itemClick = idField-Wert), nicht per Tag; im Haupt-Checkout durch den
  Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Rückwärtskompatibilität an einer bestehenden {label,id}-Fixture belegen (Defaults
  greifen, unverändertes Rendering).

## Risiken / Hinweise

- **Nur flache Feldnamen** in dieser Stufe (kein `a.b`-Dot-Pfad). Verschachtelte
  Entities ⇒ vorerst reshapen oder später Dot-Pfad-Ausbau. In der Doku festhalten.
- **idField-Konsistenz:** rowId speist itemClick, selectedId-Markierung (P173) und
  den itemSelect-Roundtrip — überall denselben gemappten Wert nutzen, sonst
  markiert die Auswahl die falsche/keine Zeile.
- Kein Zusammenhang mit DB-Projection: das Shaping bleibt an der Liste; Projection
  ist ein separates optionales Performance-Thema.

## Result

- **delivered:** ui-list can now bind **raw query entities directly** — four optional field-mapping
  strings tell it WHICH entity field is the label/value/id/icon, so a `{_id, name, city}` entity no
  longer renders `?`. Schema (`node-definitions.ts`): optional `labelField`/`valueField`/`idField`/
  `iconField`, defaults `label`/`value`/`id`/`icon` (back-compat). Serializer
  (`resources/lib/webapp-serializer.js`, the ui-list block): the four previously-hardcoded accesses now
  read `row[<field>]` from `component.props` with the defaults (flat field names only this stage).
  `items` stays the raw entity list and **`itemClick.params.row` stays the FULL raw entity** — only the
  derived label/id/value/icon use the mapping. **idField consistency:** the rendered `rowId` (from
  `idField`) is the single key used by itemClick, `selectedId` row-marking (P173), and the itemSelect
  roundtrip — so selection marks the right row when idField is set. Editor (`ui-list.html`): four text
  fields with visible defaults, round-tripping through the mapConfig into props.
- **stats:** 6 source + 3 doc/catalogue files; +6 tests (2 schema unit + 4 E2E). Develop verification:
  build 0; full unit green (**schema 454 / runtime 1107**); **ui-list E2E 30/30 green** — the 4 measured
  P208 proofs: FM01 raw entities `[{_id:'e1',name:'Alpha'},…]` + `labelField='name'`,`idField='_id'`
  render DOM text "Alpha"/"Bravo" (not `?`); FM02 itemClick `rowId='e1'` (from idField) + `row` = the
  full unchanged entity; FM03 selectable + idField marks the matching row; FM04 backward-compat (shaped
  `{id,label}` list, no *Field options → defaults, unchanged); full suite **673 passed** (only the
  pre-existing accordion red); check:specs/links/roadmap + lint green.
- **notes:** Flat field names only (no dot-path) — nested entities documented as reshape-for-now / future
  dot-path. This is the proper fix for raw entities showing `?` (the shaping belongs on the list, not the
  DB — no relation to DB projection). Minor in-pattern editor `nodes.ts` fix (the `.default()`ed schema
  fields become required in the inferred type; mirrored the existing displayValue/badgeVariant pattern to
  keep the build green) — logged in `.ai/friction-log.md`.
- **cost:** session agent-aaa7528aa656d751b, ~18m.
