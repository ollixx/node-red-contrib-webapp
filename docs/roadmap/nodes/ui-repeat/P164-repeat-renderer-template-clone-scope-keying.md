---
id: P164
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat Renderer: Template-Klon pro Item, Render-Zeit-Scope (item/index), keyed Morphing"
findings:
  - "Owner-Idee (2026-06-11): Der Knoten erzeugt einen Kontext, hat einen Default Slot als Container; Kinder greifen auf den Kontext zu und binden relativ. Beim Empfangen einer Liste/Object die items einzeln rendern."
  - "Owner-Entscheidung (2026-06-12): Render-Zeit-Scope (wie routeParam), nicht im Store."
acceptance:
  - "items-Array → die Default-Slot-Schablone wird n-mal geklont (n = Länge); ein Objekt wird als Einträge {key,value} iteriert."
  - "Ein Kind mit item.<pfad> löst gegen das aktuelle Element auf, index gegen die Position; verschiedene Instanzen zeigen verschiedene Werte."
  - "item/index außerhalb eines ui-repeat → undefined (kein Crash, sauber resolved)."
  - "Keyed Morphing: Umsortieren/Einfügen/Löschen der items erhält DOM/Fokus der unveränderten Instanzen (Per-Instanz-Key = keyField×childId, sonst Index)."
  - "Reaktiv: Änderung der items-Quelle erzeugt einen frischen Snapshot mit korrekter Instanzzahl."
verify: unit
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P163]
status: pending
---
# P164 — ui-repeat Renderer: Klon + Scope + Keys

> Zweite Schicht (ADR 0017). Der Renderer macht die n×-Expansion und löst die
> neue scope-lokale Binding-Art auf. Setzt auf das Schema aus **P163** auf.

## Umfang

1. **Template-Expansion:** `items` auflösen → über das Array iterieren (Objekt →
   `{key,value}`-Einträge) → die Default-Slot-Kinder **pro Item klonen**.
2. **Render-Zeit-Scope:** beim Klonen `{item, index}` auf einen Scope-Stapel
   schieben; `item`/`item.<pfad>`/`index` der Kinder **gegen den Scope** auflösen;
   nach dem Item poppen. **Keine** Persistenz, **kein** Store-Schreiben.
   - Auflösung reiht sich in die bestehenden Binding-Kinds ein (heute
     literal/state/query/routeParam/store/reactive — siehe
     [[renderer-resolves-five-binding-kinds]]); `item`/`index` ist die **erste
     scope-lokale** Art.
   - Außerhalb eines Repeats: `item`/`index` → `undefined` (definiert, kein Wurf).
3. **Keying:** Per-Instanz-Key = `keyField`-Wert (sonst Index) **×** Kind-Knoten-
   ID; an das bestehende keyed Morphing übergeben, damit Fokus/Scroll/DOM bei
   Reorder/inkrementeller Änderung erhalten bleiben.
4. **Wire-Pfad:** `msg.payload`-Array setzt `items` und löst einen frischen
   Snapshot aus (kein Fan-out an Kinder — Render-Iteration, nicht Wire-Split).

## acceptance / verify

- `verify: unit` — Renderer-Snapshot-Tests in `packages/renderer/test` decken die
  acceptance-Zeilen ab. (Der **browser**-Beweis des Gesamt-Flows liegt in P165.)

## Risiken / Hinweise

- **Verschachtelte Repeats** (mehrere `item`-Ebenen) sind ein offener Punkt der
  Spec — der Scope ist ein **Stapel**; die innerste Ebene gewinnt für `item`.
  Mindestens **nicht crashen**; saubere Mehr-Ebenen-Benennung ist Folgearbeit.
- **Stufe 1 read-only:** nur Lesen aus `item.*`. Schreiben aus der Zeile ist
  Stufe 2 (ADR 0017 §5) — hier **nicht** bauen.
