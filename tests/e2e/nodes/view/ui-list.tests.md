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

### Basis-Felder (P172, ADR 0015)

- „Allgemein"-Gruppe injiziert (idempotent).
- `visible` anwendbar; `disabled` anwendbar (Zeilen-Interaktion); `color`
  anwendbar (non-variant, Literal-Roundtrip); `size` N/A (Hinweis: `displayType`
  steuert die Dichte).
