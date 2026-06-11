---
id: P150
node: ui-divider
epic: nodes/ui-divider
title: "ui-divider: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-divider label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/display/ui-divider.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
dependencies: [P113]
status: done
---
# P150 — ui-divider: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Reines Editor-Paket.

## Befund (heute)
- `label` ist ein nacktes `<input type="text">`. (`orientation` bleibt Enum-Select.)

## Zielmodell
- `label` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-divider-E2E grün.

## spec / tests
- spec: `docs/nodes/display/ui-divider.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-divider.tests.md` (neu/erweitern): label-Binding.

## Result

- **delivered:** ui-divider `label` converted to the canonical value/display typedInput (P113
  set, default string), attached to `#node-input-label`, persisted as a binding object with a
  load-shim for legacy plain strings — mirrors P144/P145. Schema `label` →
  `z.union([bindingSchema, z.string()]).optional()`; editor mapper `bindingOrString`; webapp.js
  adds `divider` to the label-binding routing. The P139 base-field group (visibleBinding/
  disabledBinding/colorBinding/size) and central "Layout" heading on this reference node were left
  fully intact; `label` was added to ui-divider's minimal-coverage field list. Touched
  `nodes/view/ui-divider.html`, `packages/schema/src/node-definitions.ts`, `nodes/webapp.js`,
  `packages/editor/src/nodes.ts`, `tests/e2e/nodes/editor/minimal-coverage.spec.ts`.
- **stats:** 5 files changed, +43/−6. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (clean re-run, 11.8m); unit 891 green; check:roadmap +
  check:links OK. `label` optional → no required/validate.
- **notes:** The first full-suite run hit **3 page-load timeouts** (ui-divider minimal-coverage,
  navigate-target-modes, ui-stepper) with 50-minute durations and a 1.9h total — caused by a
  **hung leftover Node-RED instance on port 1882** from a prior run, not P150 (two of the three
  specs are unrelated to ui-divider; all three were `page.waitForLoadState`/`waitForFunction`
  timeouts). After killing the stray process (pid 77573) the clean re-run was 520/0. P139
  base-field assertions undisturbed.
- **cost:** session a1ffc4c082793e19b, ~8m (+ orchestrator E2E incl. the hung-run recovery).
