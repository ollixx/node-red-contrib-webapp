---
id: P146
node: ui-slider
epic: nodes/ui-slider
title: "ui-slider: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-slider label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-slider.md
tests: tests/e2e/nodes/view/ui-slider.tests.md
dependencies: [P113]
status: done
---
# P146 — ui-slider: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P126) — hier nur `label`.

## Befund (heute)
- `label` ist ein nacktes `<input type="text">`.

## Zielmodell
- `label` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert; Round-Trip;
  bestehende ui-slider-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-slider.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-slider.tests.md` um label-Binding erweitern.

## Result

- **delivered:** ui-slider `label` converted to the canonical value/display typedInput (P113 set,
  default string), attached directly to `#node-input-label`, persisted as a binding object with a
  load-shim for legacy plain strings — mirrors P144/P145. Schema `label` →
  `z.union([bindingSchema, z.string()]).optional()`; editor mapper `bindingOrString`; webapp.js
  adds `"slider"` to the labelBinding routing set (getBinding + plain-string fallback). Touched
  `packages/schema/src/node-definitions.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-slider.html`.
- **stats:** 4 files changed, +49/−6. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (8.8m); unit 891 green; check:roadmap + check:links + lint OK.
- **notes:** ui-slider `label` is **optional** (spec: "Pflicht: optional") so no `required`/
  `validate` added (unlike ui-input P145). `#node-input-label` kept in place so the
  minimal-coverage ui-slider field guard passes unchanged; no view.spec ui-slider label
  interaction existed. Legacy plain-string labels migrate to `{kind:"literal",value:…}` on open.
  Clean run — no follow-up fix needed.
- **cost:** session ad6682ae798328402, ~8m (orchestrator develop-E2E on top).
