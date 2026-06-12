# Testkatalog: ui-repeat

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung der
> ui-repeat-Welle (ADR 0017) und in P163–P165 zu befüllen.

## Geplante Testziele

### Schema + Binding-Art `item`/`index` (P163) — abgedeckt (unit)

> Umgesetzt in `packages/schema/test/p163-repeat-item-binding.test.ts`
> (`verify: unit`). Kein E2E-Spec in dieser Schicht.

- `ui-repeat`-Knotendefinition validiert (`items` Pflicht-Wert-Binding,
  optionales `keyField`, fester Default-Slot `content` = `REPEAT_SLOT`). Negativ:
  fehlende `items` und leeres `keyField` bleiben rot; Knoten ohne `mount`/`parent`
  rot.
- Binding-Art `item` (ganzes Element), `item.<pfad>` (ein-/mehrstufig, z. B.
  `address.city`) und `index` (nullbasiert, pfadlos) ist im Binding-Union
  zugelassen, **scope-lokal** markiert und schema-validierbar; `item.<pfad>`
  roundtrippt durch parse/serialize. Negativ: unbekannte Binding-Art bleibt rot;
  `index` mit Pfad und malformierte `item`-Pfade (führender/Doppel-Punkt) rot.
- Fixtures: `itemBindingFixture`, `indexBindingFixture`,
  `minimalRepeatNodeSetFixture` (Array-Quelle + Kind mit `item.name`).

### Renderer — Template-Klon + Render-Zeit-Scope (P164) — abgedeckt (unit)

> Umgesetzt in `packages/renderer/test/p164-repeat-template-clone.test.ts`
> (`verify: unit` — diese Snapshot-Tests SIND die Akzeptanz dieser Schicht). Der
> Browser-Beweis des Gesamt-Flows liegt in P165.

- `items`-Array → die Schablone wird n-mal geklont (n = Array-Länge); leeres Array
  / Skalar → 0 Klone (kein Crash); Objekt → Iteration als `{key,value}`
  (`item.key` / `item.value`).
- `item.<pfad>` (ein-/mehrstufig, z. B. `address.city`) in einem Kind löst gegen
  das aktuelle Element auf; `index` gegen die Position; verschiedene Instanzen
  zeigen verschiedene Werte. Bare `item` auf ein Objekt → `"?"` (P104), kein Wurf.
- `item`/`index` **außerhalb** eines Repeats → `undefined` (greift `fallback`,
  sonst `"?"`; kein Crash).
- Keyed Morphing: Per-Instanz-Id `<itemKey>#<childId>` (Key = `keyField`-Wert,
  sonst Objekt-Eintrags-`key`, sonst Index) bleibt bei Umsortieren/Einfügen/Löschen
  für unveränderte Instanzen stabil — speist das bestehende keyed Morphing
  (Fokus/Scroll-Erhalt wird im Browser in P165 bewiesen).
- Reaktiv: Änderung der `items`-Quelle (Store via `replaceState`, Query via
  `replaceQueries`) → frischer Snapshot mit korrekter Instanzzahl.
- Verschachtelte Repeats: Scope-Stapel, innerster Frame gewinnt; Ids verketten
  beide Ebenen kollisionsfrei (`<aussenKey>#<innenKey>#<childId>`).

### Editor + Node-Registrierung (P165, browser)

- `ui-repeat` ist im Editor anlegbar; `items`-typedInput + `keyField`-Feld
  sichtbar; Mount-Picker.
- Default-Slot nimmt Kind-Knoten auf (Mount in den Repeat-Slot).
- End-to-End: ein Store-Array + ui-repeat mit ui-text-Kind (`item.name`) rendert
  je Element eine Zeile; Array-Änderung aktualisiert sichtbar.

## Editor: Basis-Felder (P139, ADR 0015 — Referenzknoten)

- Anwendbarkeit der „Allgemein"/„Erweitert"-Basis-Felder noch zu klären (Container
  mit Slot — `visible` anwendbar; `disabled`/`color`/`size` ggf. N/A).
