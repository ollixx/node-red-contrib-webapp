---
id: P169
node: ui-accordion
epic: nodes/ui-accordion
title: "ui-accordion: Kinder definieren Sektionen — neues ui-accordion-section-Kind (Schema+Renderer+Editor), sections-Config entfällt; Browser-Beweis"
findings:
  - "Owner-Entscheidung (2026-06-12): Modell 1a (Kinder definieren die Sektionen) gilt analog für ui-accordion."
acceptance:
  - "Neues Knoten-Schema ui-accordion-section: Container-Kind mit label/icon/order + Default-Slot; eindeutige id/Namen je ui-accordion (Validierung)."
  - "ui-accordion: Config-/JSON-Sektionsfeld entfernt; akzeptiert ui-accordion-section-Kinder, ein Slot pro Kind; Open/Closed-Zustand per Kind-id."
  - "Mount-Tree zeigt ui-accordion als Drop-Ziel + jede Sektion als Container mit Slot."
  - "Migration: bestehende Sektions-Config → ui-accordion-section-Kinder (id/label erhalten), bestehende Mounts re-pointed."
  - "End-to-End (browser): ein ui-accordion mit zwei ui-accordion-section-Kindern rendert zwei aufklappbare Sektionen mit ihrem jeweiligen Inhalt."
verify: browser
spec: docs/nodes/navigation/ui-accordion.md
tests: tests/e2e/nodes/view/ui-accordion.tests.md
dependencies: [P168]
status: done
---
# P169 — ui-accordion: Kinder definieren Sektionen (Spiegel zu ui-tabs)

> Dritte Schicht von ADR 0018 — spiegelt das ui-tabs-Modell (P167/P168) auf
> `ui-accordion`. Setzt darauf auf, um das etablierte Muster (Schema → Renderer →
> Editor → Validierung → Migration) wiederzuverwenden.

## Umfang

1. **Neuer Knoten `ui-accordion-section`** (Schema + Registrierung): Container-
   Kind mit `label`/`icon`/`order` + Default-Slot.
2. **`ui-accordion`-Umbau:** Sektions-Config **raus**; ein Slot pro Kind; Open/
   Closed-Zustand per Kind-id (analog `activeTab`).
3. **Renderer/Editor/Mount-Tree/Validierung/Migration** analog P167/P168.
4. **Spec/Doku:** `docs/nodes/navigation/ui-accordion.md` umschreiben; neues
   `docs/nodes/navigation/ui-accordion-section.md`; Testkatalog befüllen.

## acceptance / verify

- `verify: browser` — wie P168; E2E im Haupt-Checkout durch den Orchestrator.

## Risiken / Hinweise

- Soviel wie möglich aus dem ui-tabs-Muster wiederverwenden (gemeinsame Editor-
  Helfer in `resources/lib/editor-common.js` — **einzige kanonische Kopie**).
- Dynamische Sektionen (ui-repeat → ui-accordion-section) sind P170.

## Result

- **delivered:** Tabs-1a wave (ADR 0018) Schicht 3 — mirrored the ui-tabs children model
  (P167/P168) onto ui-accordion in one phase. New `ui-accordion-section` container node (schema +
  registration: `nodes/view/ui-accordion-section.{js,html}`, package.json node-red.nodes,
  WEBAPP_NODE_TYPES, component bucket, mapConfig, toComponentDefinitions). `ui-accordion` reworked
  to derive one collapsible `sl-details` panel per section child with two-way **`openSection`**
  open-state (rides the same p16 `bind.value` mechanism as `activeTab`); renderer `renderAccordion`
  (open-state by child id, `container:<id>/content` mount alias accepted, content per
  `ui-accordion-section:<id>/content`). Section-id uniqueness deploy validation; legacy
  `sections`→children migration (`migrateLegacyAccordionComponents`, composed before the tab
  migration). Editor: ui-accordion is a container (no sections field, "become a section" hint),
  ui-accordion-section editor = label typedInput + icon + order + mount-picker + base fields;
  mount-tree shows both as containers. Spec rewritten + new `docs/nodes/navigation/ui-accordion-section.md`.
- **stats:** 27 files (+1598/−299); 1 new node type (`ui-accordion-section`); new
  `packages/runtime/test/p169-accordion-children-model.test.ts` + schema block; fresh E2E
  `tests/e2e/nodes/view/ui-accordion.spec.ts` (7) + updated editor specs; obsolete
  `p74-accordion-sections-field.test.ts` + composite accordion spec removed. Unit green (runtime
  969 / schema / renderer 92 / editor 102). Develop verification: `pnpm build` exit 0; **browser
  proof + regression 55/55 green** — accordion R01/R02 (two sl-details, content per panel), O01–O03
  (openSection literal/state binding, external-store→SSE), D01 (default first-by-order open), M01
  (legacy migration); ui-tabs re-verified (no cross-regression); editor navigation-nodes +
  minimal-coverage green. check:roadmap + check:links + lint OK.
- **notes:** Reused the shared `editor-common.js` container machinery and the renderer's
  `createTabMountMatcher` (prefix-parameterized) rather than forking. Regenerated
  `examples/composite/ui-accordion.json` to the legacy-migration form (matching the ui-tabs
  precedent). Dynamic sections (ui-repeat→section) intentionally left to **P170** (the capstone,
  which also depends on P165 — both present). **The Tabs-1a wave (P167+P168 tabs, P169 accordion)
  is complete; only P170 remains.**
- **cost:** session a7e7cde9c072ac4a1, ~95m (+ orchestrator browser proof / editor regression on
  the slow host).
