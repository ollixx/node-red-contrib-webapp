---
id: P147
node: ui-switch
epic: nodes/ui-switch
title: "ui-switch: label/labelOn/labelOff auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-switch label, labelOn, labelOff sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/input/ui-switch.md
tests: tests/e2e/nodes/view/ui-switch.tests.md
dependencies: [P113]
status: done
---
# P147 — ui-switch: label/labelOn/labelOff → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P125) — hier die drei Label-Felder.

## Befund (heute)
- `label`, `labelOn`, `labelOff` sind nackte `<input type="text">`.

## Zielmodell
- Alle drei → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`),
  Default string.

## acceptance (observierbar, browser)
- Die drei Label-Felder bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-switch-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-switch.md` — `label`/`labelOn`/`labelOff` als typedInput.
- tests: `tests/e2e/nodes/view/ui-switch.tests.md` um die Label-Bindings erweitern.

## Result

- **delivered:** ui-switch's three label fields (`label`, `labelOn`, `labelOff`) converted to
  canonical value/display typedInputs (P113 set, default string), each attached directly to its
  `#node-input-<field>` id, persisted as binding objects with load-shims for legacy plain strings
  — mirrors P144–P146. Schema: each → `z.union([bindingSchema, z.string()]).optional()`; editor
  mapper `bindingOrString` for all three; webapp.js adds `switch`/`labelOn`/`labelOff` to the
  binding routing (`bind.label`/`bind.labelOn`/`bind.labelOff`, getBinding + plain-string
  fallback); renderer needs no change — its generic `bind` iteration already resolves
  labelOn/labelOff into resolvedProps. Touched `packages/schema/src/node-definitions.ts`,
  `packages/editor/src/nodes.ts`, `nodes/webapp.js`, `nodes/view/ui-switch.html`.
- **stats:** 4 files changed, +126/−22. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (8.8m); unit 1318 green; check:roadmap + check:links + lint OK.
- **notes:** All three labels optional (spec-confirmed) — no `required`/`validate` added.
  `#node-input-label` kept in place so the minimal-coverage ui-switch field guard passes; no
  view.spec ui-switch label interaction needed updating. Plain-string labels in existing flows
  (e.g. `label:"Dark mode"`) still work via the props fallback. Clean run — no follow-up fix.
- **cost:** session ab361cc3e8be42b13, ~19m (orchestrator develop-E2E on top).
