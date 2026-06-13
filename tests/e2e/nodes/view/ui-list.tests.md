# Testkatalog: ui-list

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit dem Epic `nodes/ui-list`
> (Angleichung an die geglättete Spec). Bestehende E2E:
> `tests/e2e/nodes/composite/ui-list.spec.ts`.

## Geplante Testziele

### items-typedInput + Item-Schema (P171)

- `items`-typedInput (Wert-Bindings) ersetzt `itemsPath`; `items:null`-Default weg.
- Migration: gespeichertes `itemsPath` (string) → `state`-Binding auf `items`;
  Altflow rendert unverändert.
- Item-Schema `{id?,label,value?,icon?}`: `label` Pflicht rendert; `icon`/`value`
  optional; fehlendes `label` an einem Element → `"?"` nur für diese Zeile;
  Nicht-Array (Skalar/Objekt/null) → leere Liste, kein Crash; Zusatzfelder ignoriert.
- Events: `itemClick`/`itemSelect`-Checkboxen → Output-Ports; `rowId` = `id`
  (sonst Index), `row` = Element.
- Hilfetext nennt Item-Schema + Doku-Link.

### Basis-Felder (P172, ADR 0015)

- „Allgemein"-Gruppe injiziert (idempotent).
- `visible` anwendbar; `disabled` anwendbar (Zeilen-Interaktion); `color`
  anwendbar (non-variant, Literal-Roundtrip); `size` N/A (Hinweis: `displayType`
  steuert die Dichte).
