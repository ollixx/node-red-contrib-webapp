---
id: P163
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat: Schema-Knotendefinition + neue Binding-Art item/index (scope-lokal)"
findings:
  - "Owner-Idee (2026-06-11): Ein Knoten ui-repeat. Wird gebunden an eine Liste oder Objekt. Erzeugt einen Kontext. Hat einen Default Slot als Container. Kinder greifen auf den Kontext zu und können relativ dazu binden."
  - "Owner-Entscheidung (2026-06-12): Render-Zeit-Scope statt Store; neue Binding-Art item.*/index (wie routeParam, nicht persistiert)."
acceptance:
  - "Schema validiert eine ui-repeat-Knotendefinition: items (Pflicht, Wert-Binding), optionales keyField (String), Default-Slot — Fixtures grün."
  - "Die Binding-Art `item` (mit optionalem `item.<pfad>`) und `index` ist im Binding-Union zugelassen und schema-validierbar; ein item-Binding mit Pfad roundtrippt durch parse/serialize."
  - "Negativ: ein items-Binding mit unbekannter Art bleibt rot; das Schema importiert weiterhin aus keinem anderen Repo-Paket (Invariante)."
verify: unit
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: in_progress
---
# P163 — ui-repeat: Schema + Binding-Art item/index

> Erste Schicht der ui-repeat-Welle (ADR 0017). Rein im `packages/schema` —
> Knotendefinition + die neue **scope-lokale** Binding-Art. Kein Renderer, kein
> Editor (das sind P164/P165).

## Umfang

1. **Knotendefinition `ui-repeat`** (Zod): `mount`/`parent`, `items`
   (Wert-Binding, Pflicht), `keyField` (String, optional), Default-Slot. Einordnen
   in die Container-fähigen Typen (Kinder erlaubt) analog `ui-container`.
2. **Binding-Art `item` / `index`** im Binding-Union ergänzen:
   - `item` → ganzes Element; `item.<pfad>` → ein-/mehrstufiges Feld.
   - `index` → nullbasierte Position (numerisch).
   - **Scope-lokal markiert** — anders als die globalen Arten (state/store/query):
     die Auflösung passiert erst im Renderer gegen den Scope (P164). Hier nur die
     **Form** validieren, nicht auflösen.
3. **Fixtures** für ein minimales Repeat (Array-Quelle + ein Kind mit `item.name`).

## acceptance / verify

- `verify: unit` — siehe Frontmatter. Schema-Tests in `packages/schema/test`.

## Risiken / Hinweise

- **Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- `item.<pfad>` Tiefe: ein- **oder** mehrstufig zulassen (`item.address.city`),
  konsistent mit der Store-subPath-Diskussion (ADR 0013), aber **kein** Slice-
  Zwang — reine Pfad-Validierung.
- Die **Auflösung** von `item`/`index` ist ausdrücklich **nicht** hier (P164).
