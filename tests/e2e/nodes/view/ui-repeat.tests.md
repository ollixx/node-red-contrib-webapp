# Testkatalog: ui-repeat

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung der
> ui-repeat-Welle (ADR 0017) und in P163–P165 zu befüllen.

## Geplante Testziele

### Schema + Binding-Art `item`/`index` (P163)

- `ui-repeat`-Knotendefinition validiert (`items` Pflicht-Wert-Binding,
  optionales `keyField`, Default-Slot).
- Binding-Art `item`/`item.<pfad>`/`index` ist im Binding-Union zugelassen und
  schema-validierbar.

### Renderer — Template-Klon + Render-Zeit-Scope (P164)

- `items`-Array → die Schablone wird n-mal geklont (n = Array-Länge); Objekt →
  Iteration als `{key,value}`.
- `item.<pfad>` in einem Kind löst gegen das aktuelle Element auf; `index` gegen
  die Position.
- `item`/`index` **außerhalb** eines Repeats → `undefined` (kein Crash).
- Keyed Morphing: Umsortieren/Einfügen/Löschen erhält Fokus/Scroll der
  unveränderten Instanzen (Key = `keyField`×childId, sonst Index).
- Reaktiv: Änderung der `items`-Quelle → Re-Render mit korrekter Instanzzahl.

### Editor + Node-Registrierung (P165, browser)

- `ui-repeat` ist im Editor anlegbar; `items`-typedInput + `keyField`-Feld
  sichtbar; Mount-Picker.
- Default-Slot nimmt Kind-Knoten auf (Mount in den Repeat-Slot).
- End-to-End: ein Store-Array + ui-repeat mit ui-text-Kind (`item.name`) rendert
  je Element eine Zeile; Array-Änderung aktualisiert sichtbar.

## Editor: Basis-Felder (P139, ADR 0015 — Referenzknoten)

- Anwendbarkeit der „Allgemein"/„Erweitert"-Basis-Felder noch zu klären (Container
  mit Slot — `visible` anwendbar; `disabled`/`color`/`size` ggf. N/A).
