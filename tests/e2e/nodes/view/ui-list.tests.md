# Testkatalog: ui-list

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit dem Epic `nodes/ui-list`
> (Angleichung an die geglättete Spec). Bestehende E2E:
> `tests/e2e/nodes/composite/ui-list.spec.ts`.

## Geplante Testziele

### items-typedInput + Item-Schema (P171)

- `items`-typedInput (Wert-Bindings) ersetzt `itemsPath`; `items:null`-Default weg.
- **Typ-Einschränkung:** `str`/`num`/`bool` im typedInput nicht anwählbar; `json`
  (Array) + state/store/query/routeParam/msg/flow/global/jsonata/env vorhanden.
- Migration: gespeichertes `itemsPath` (string) → `state`-Binding auf `items`;
  Altflow rendert unverändert.
- **Array-of-Strings:** `["A","B"]` → `[{label:"A"},{label:"B"}]`; gemischtes Array
  (String + Objekt) rendert.
- Item-Schema `{id?,label,value?,icon?}`: `label` Pflicht rendert; fehlendes
  `label` (Objektform) → `"?"` nur für diese Zeile; Nicht-Array-Wurzel → leere
  Liste, kein Crash; Zusatzfelder ignoriert.
- **value/displayValue:** Default `none` → `value` nicht sichtbar, aber im Event;
  `secondary` → trailing Text; `badge` → Badge in `badgeVariant`-Farbe
  (Variant-SelectBox, `SEVERITY_VARIANTS`; Feld nur bei `badge` sichtbar). `value`
  (String|Number) stets in `row.value`.
- `itemClick`-Event → Output-Port; `params {rowId,row}` + clientId/sourceId/appId;
  `rowId` = `id` (sonst Index), `row` = ganzes Element inkl. `value`.
- Hilfetext nennt Item-Schema + String-Kurzform + value/displayValue + Doku-Link.

### Single-Select (P173)

- `selectable` (Default false) schaltet Single-Select; Klick markiert die Zeile.
- `selectedId` (zweiseitig): externe Store-Änderung markiert die Zeile (SSE);
  Klick auf andere Zeile schreibt den Store; ungültige id → keine Markierung.
- `itemSelect` feuert nur bei `selectable` + Auswahlwechsel; `params {rowId,row}`
  + clientId/sourceId/appId; ohne `selectable` wirkungslos.

Umgesetzt in `tests/e2e/nodes/view/ui-list.spec.ts` (`describe` „single-select (P173)"):

- **S01** `selectable` aus → kein `aria-selected`, keine `webapp-list-item--selected`-Klasse.
- **S02** `selectable` an + `selectedId`-State-Binding markiert die passende Zeile (Read).
- **S03** externe Store-Änderung → SSE-Re-Render verschiebt die Markierung.
- **S04** Zwei-Wege-Roundtrip: Klick → `itemSelect` → verdrahtetes `ui-store set` →
  Zeile wird via `selectedId` markiert.
- **S05** `itemSelect` feuert nur bei `selectable` + Auswahlwechsel; Payload
  `{rowId,row}` + `sourceId`.
- **S06** `selectable` aus → Klick emittiert nur `itemClick`, nie `itemSelect`;
  kein `data-webapp-selectable`.

Ergänzende Renderer-Unit-Coverage: `packages/runtime/test/p173-list-single-select-behaviour.test.ts`
(mapConfig-Pass-through/Migration + Selected-State-Markierung inkl. Index-Fallback-`rowId`).

### Basis-Felder (P172, ADR 0015)

- „Allgemein"-Gruppe injiziert (idempotent).
- `visible` anwendbar; `disabled` anwendbar (Zeilen-Interaktion); `color`
  anwendbar (non-variant, Literal-Roundtrip); `size` N/A (Hinweis: `displayType`
  steuert die Dichte).

### Per-Item-Icon (P176)

Das Item-Schema `{id?,label,value?,icon?}` verspricht ein führendes `icon`.
`icon` ist ein backend-neutraler Icon-Wert (bare Name gegen die Shoelace-
Default-Library ODER `{library?,name}`), gerendert als führendes
`<sl-icon class="webapp-list-item-icon …">` vor dem Label — in interaktiven
UND nicht-interaktiven Zeilen; fehlendes `icon` → kein Icon-Element (unverändert);
String-Kurzform (Item ist ein String) → kein Icon.

Umgesetzt in `tests/e2e/nodes/view/ui-list.spec.ts` (`describe` „per-item icon (P176)"):

- **I01** Nicht-interaktiv: Item mit bare-String-Icon `"star"` → `<sl-icon
  class="webapp-list-item-icon" name="star">`; Item ohne Icon → kein Icon.
- **I02** Interaktiv (itemClick): Icon als führendes Kind im `<a>`; ohne Icon → kein Icon.
- **I03** Objekt-Form `{name:"bell"}` rendert; String-Kurzform hat kein Icon und kein Crash.
- **I04** Icon + value (badge) koexistieren: Icon führt, Badge folgt dem Label.
