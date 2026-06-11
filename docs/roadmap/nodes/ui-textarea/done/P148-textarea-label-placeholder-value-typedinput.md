---
id: P148
node: ui-textarea
epic: nodes/ui-textarea
title: "ui-textarea: label + placeholder auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-textarea label und placeholder sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/input/ui-textarea.md
tests: tests/e2e/nodes/view/ui-textarea.tests.md
dependencies: [P113]
status: done
---
# P148 — ui-textarea: label + placeholder → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P128) — hier `label` + `placeholder`.

## Befund (heute)
- `label` und `placeholder` sind nackte `<input type="text">`.

## Zielmodell
- Beide → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label` und `placeholder` bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-textarea-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-textarea.md` — `label`/`placeholder` als typedInput.
- tests: `tests/e2e/nodes/view/ui-textarea.tests.md` erweitern.

## Result

- **delivered:** ui-textarea `label` and `placeholder` converted to canonical value/display
  typedInputs (P113 set, default string), each attached directly to its `#node-input-<field>` id,
  persisted as binding objects with load-shims for legacy plain strings — mirrors P144–P147.
  Schema both → `z.union([bindingSchema, z.string()...])`; editor mapper `bindingOrString`;
  webapp.js adds `textarea` to the label+placeholder binding routing. Touched
  `packages/schema/src/node-definitions.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-textarea.html`.
- **stats:** phase 4 files (+92/−12) + fix 2 files (+33/−5). Develop verification: `pnpm build`
  exit 0, full Playwright suite **520 passed / 0 failed** (14.1m); unit 891 green; check:roadmap +
  check:links OK.
- **notes:** **Orchestrator follow-up fix (`fix/P148-textarea-label`):** the initial cut dropped
  ui-textarea's `label` **required-validation** (the old default had `required:true`; the test
  `ui-textarea.spec.ts:160` "label drives validity" guards it). Restored `required:true` + a
  typedInput-aware `validate` (mirrors the P145/ui-input fix), and switched that spec's label
  interaction to the `fillTypedInput`/`readTypedInput` helpers (the now-hidden backing input can't
  be `.fill()`ed). `placeholder` stays optional. Same regression shape as P145 — worth folding a
  "preserve required-label validity + use typedInput helpers in specs" reminder into the field-
  typing playbook.
- **cost:** session aacbcd636a5c56247 (~4m) + fix session ae0b0b9a7eda8e5c2 (~4m); plus
  orchestrator develop-E2E.
