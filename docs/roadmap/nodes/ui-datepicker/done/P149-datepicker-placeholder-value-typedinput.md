---
id: P149
node: ui-datepicker
epic: nodes/ui-datepicker
title: "ui-datepicker: placeholder auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-datepicker placeholder ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-datepicker.md
tests: tests/e2e/nodes/view/ui-datepicker.tests.md
dependencies: [P113]
status: done
---
# P149 — ui-datepicker: placeholder → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`label` bereits typed (P98/P130) — hier `placeholder`.

## Befund (heute)
- `placeholder` ist ein nacktes `<input type="text">`. (`min`/`max` bleiben als
  Datum-Config — separat zu entscheiden, nicht Teil dieses Pakets.)

## Zielmodell
- `placeholder` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `placeholder`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-datepicker-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-datepicker.md` — `placeholder` als typedInput.
- tests: `tests/e2e/nodes/view/ui-datepicker.tests.md` erweitern.

## Result

- **delivered:** ui-datepicker `placeholder` converted to the canonical value/display typedInput
  (P113 set, default string), persisted as a binding object with a load-shim for legacy plain
  strings — **mirrors ui-datepicker's own existing `labelBinding` convention (P130)**, i.e.
  `#node-input-placeholderBinding` + applyValueBinding, keeping the node internally consistent
  (not the ui-button direct-attach style). Schema `placeholder` →
  `z.union([bindingSchema, z.string()]).optional()`; editor mapper `bindingOrString`; webapp.js
  adds `datepicker` to the placeholderBinding routing. Touched
  `packages/schema/src/node-definitions.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-datepicker.html`. `min`/`max` left as date config (out of scope).
- **stats:** 4 files changed, +40/−7. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (clean re-run); unit 891 green; check:roadmap + check:links OK.
  `placeholder` optional → no required/validate.
- **notes:** First full-suite run hit one **unrelated flake** —
  `ui-alert.spec.ts:265` ("countdown=true + duration … alert hides after countdown"), a timing
  test on a node P149 doesn't touch; it passed on isolated re-run (19/19) and the clean full re-run
  was 520/0. (ui-alert countdown timing is a flake candidate worth hardening.) Routine Welle-1
  field-typing; consumed the shared P113 helper.
- **cost:** session a3e747435877604ca, ~5m (orchestrator develop-E2E + flake recheck on top).
