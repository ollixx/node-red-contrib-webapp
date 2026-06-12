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
status: done
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

## Result

- **delivered:** ui-repeat-Welle (ADR 0017) Schicht 1, **schema-only** per `verify: unit`. New
  `ui-repeat` node definition in `packages/schema` (mountable template container: required `items`
  value-binding, optional `keyField` string, fixed default `content` slot exported as
  `REPEAT_SLOT`); registered in the discriminated union + type-dispatch map, classified
  children-allowed analogous to `ui-container`. New **scope-local** binding kinds `item` /
  `item.<path>` (one- or multi-level dotted path) / `index` (numeric) added to the binding union
  (`SCOPE_LOCAL_BINDING_KINDS`) — **form validation only**, resolution deferred to the renderer
  (P164). Fixtures for a minimal repeat (array source + child `item.name`). Minimal `ui-repeat`
  registration in `packages/editor` (config type/unions/nodeSet entry + `repeatItemsFromConfig`)
  so the editor package type-checks against the new schema union — full editor UX stays P165;
  **no runtime node registered** (not in package.json/webapp.js, no HTML).
- **stats:** 8 files (7 mod, 1 new). Unit **all green**: schema 296 (+P163 suite), editor 96,
  renderer 71, runtime 952. `pnpm validate` exit 0 (check:roadmap + check:links + lint + test +
  build). The schema invariant held — `packages/schema` imports from no other repo package.
- **notes:** `item.name` is correctly ACCEPTED as a two-level field path (the `item.` prefix is
  the KIND; the remaining `name` is the path); unknown binding kinds stay rejected (negative test).
  **Verify limitation (environmental, not P163):** the host Node-RED **admin editor** wedges after
  ~20 editor-panel opens (the full develop run reached **89/89 green** then wedged in the
  editor-panel cluster; an isolated editor-dir run wedged at ~20 — the same wedge that hit the P161
  run, pre-dating P163). Confirmed NOT P163-induced: P163 registers no runtime node and adds no
  editor HTML. P163's acceptance is `verify: unit` and is fully green; render/runtime E2E is
  unaffected (a render-side probe ran 10/10 in 4s). The editor-panel E2E wedge is a host/harness
  issue relevant to **P165** (editor layer), not to P164 (renderer, render-side verifiable).
- **cost:** session a3379415d16cec814, ~9m.
