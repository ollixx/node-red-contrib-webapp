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
status: done
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

## Result

- **delivered:** Renderer half of ui-repeat (ADR 0017 Schicht 2). Added `"repeat"` to the
  renderer's `componentKindSchema` (runtime mapping stays P165). In `packages/renderer/src/renderer.ts`:
  (1) **template expansion** — `expandRepeat` resolves `items` via the structural resolver, builds
  `{item,index}` frames (array → n×, object → `{key,value}` entries, scalar/empty → 0), clones the
  `REPEAT_SLOT` (`container:<repeatId>/content`) child subtree per item and flattens it into the host
  region; (2) **render-time scope** — a new `itemScope` STACK on `BindingSources` plus `item` /
  `item.<path>` / `index` cases in `resolveBinding` (the FIRST scope-local binding kinds), resolved
  against the innermost frame; (3) **keyed clones** — per-instance id `<itemKey>#<childId>` (keyField
  value → object entry key → index) feeds the existing keyed morph so focus/scroll/DOM of unchanged
  instances survive reorder/insert/delete; (4) **reactive/wire path** — store/query `items` change
  re-renders a fresh snapshot with the correct count, no child fan-out. Spec + catalogue extended.
- **stats:** 5 files (2 src, 1 new test, 2 docs); **+21 renderer snapshot tests**
  (`packages/renderer/test/p164-repeat-template-clone.test.ts`). `pnpm validate` exit 0 — schema 296,
  editor 96, renderer **92**, runtime 952 unit tests green; lint + check:roadmap + check:links + build
  green. Develop regression: render-side E2E **0 failed** across the slices that ran (199 view-dir +
  62 render-slice tests green before the host's slow E2E was interrupted) — `verify:unit` acceptance
  (the 21 renderer snapshot tests) is the contract and is fully met.
- **notes:** **Outside a repeat** — `item`/`index` resolve to `undefined` (defined, no throw); a
  binding `fallback` applies, else the display normalizes to `"?"` (P104); bare `item` on an object
  element → `"?"` (non-scalar), no crash. **Nested repeats** — the scope is an immutably-rebuilt
  stack; innermost frame wins for `item`/`index`; inner repeats expand recursively with chained
  per-instance ids (`<outerKey>#<innerKey>#<childId>`), collision-free; explicit *outer*-level naming
  is documented follow-up. Stage-1 read-only (no row write-back — that is ADR 0017 §5). Worktree-sanity
  self-heal: worktree arrived on orphan base `db4f4ff`; recreated `phase/P164` from the explicit
  develop SHA, P163 ancestry confirmed before any work. The browser proof of the end-to-end flow is
  **P165** (verify:browser).
- **cost:** session aa91b560cd2e8fa6d, ~22m.
