---
id: P145
node: ui-input
epic: nodes/ui-input
title: "ui-input: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-input label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-input.md
tests: tests/e2e/nodes/view/ui-input.tests.md
dependencies: [P113]
status: done
---
# P145 — ui-input: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` sind bereits typed (P123) — hier nur `label`. Reines Editor-Paket.

## Befund (heute)

- `label` ist ein nacktes `<input type="text">`.

## Zielmodell

- `label` → kanonischer **Wert/Anzeige**-typedInput (geteilter Helfer,
  `category:"value"`), Default string. Muster wie die übrigen Label-Felder.

## acceptance (observierbar, browser)

- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-input-E2E grün.

## spec / tests

- spec: `docs/nodes/input/ui-input.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-input.tests.md` um label-Binding erweitern.

## Result

- **delivered:** ui-input `label` converted to the canonical value/display typedInput (P113 set,
  default string), attached directly to `#node-input-label`, persisted as a binding object with a
  load-shim for legacy plain strings — mirrors P144/ui-checkbox/ui-select. Schema `label` →
  `z.union([bindingSchema, z.string().min(1)])`; editor mapper `bindingOrString`; webapp.js routes
  label via `bind.label` (literal/plain-string fallback). Touched
  `packages/schema/src/node-definitions.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-input.html`.
- **stats:** 4 files (+66/−5) for the phase, +2 files for the follow-up fix. Develop verification:
  `pnpm build` exit 0, full Playwright suite **520 passed / 0 failed** (8.8m); unit 891 green;
  check:roadmap + check:links OK.
- **notes:** **Orchestrator follow-up fix (`fix/P145-input-label`, commit 60e1a62):** the initial
  cut dropped the label's required-validation — ui-input's `label` is REQUIRED (it drives node
  validity since P123 removed `valuePath`), but the new typedInput had no `validate`/`required`,
  so an empty label no longer marked the node invalid; restored `required: true` + a typedInput-
  aware `validate` (reads `el.typedInput("value")`, falls back to the persisted binding when the
  panel is closed). Also updated `view.spec.ts` to drive the label via the existing
  `fillTypedInput`/`readTypedInput` helpers instead of `.fill()`-ing the now-hidden backing input.
  Both required-label validity assertions pass for real. customers-crud unaffected.
- **cost:** session a236fa7babce5a316 (~8m) + fix session a944b67c5aeda4ff7 (~3m); plus
  orchestrator develop-E2E.
