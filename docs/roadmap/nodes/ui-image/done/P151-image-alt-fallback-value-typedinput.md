---
id: P151
node: ui-image
epic: nodes/ui-image
title: "ui-image: alt + fallback auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-image alt und fallback sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/display/ui-image.md
tests: tests/e2e/nodes/view/ui-image.tests.md
dependencies: [P113]
status: done
---
# P151 — ui-image: alt + fallback → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `src` ist bereits typed — hier `alt` + `fallback`. Reines Editor-Paket.

## Befund (heute)
- `alt` und `fallback` sind nackte `<input type="text">`. (`width`/`height`
  bleiben Maß-Config; `fit` bleibt Enum-Select.)

## Zielmodell
- `alt` → kanonischer Wert-typedInput (`category:"value"`).
- `fallback` → kanonischer Wert-typedInput (Anzeige-Text/-URL bei Ladefehler);
  Default string.

## acceptance (observierbar, browser)
- `alt` und `fallback` bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-image-E2E grün.

## spec / tests
- spec: `docs/nodes/display/ui-image.md` — `alt`/`fallback` als typedInput.
- tests: `tests/e2e/nodes/view/ui-image.tests.md` erweitern.

## Result

- **delivered:** ui-image `alt` and `fallback` converted to canonical value/display typedInputs
  (P113 set, default string), each attached directly to `#node-input-alt`/`#node-input-fallback`,
  persisted as binding objects with load-shims for legacy plain strings — mirrors P144/P145 and
  ui-image's already-typed `src`. Schema both → `z.union([bindingSchema, z.string()]).optional()`;
  editor mapper `bindingOrString`; assembler routes binding objects through `bind.alt`/
  `bind.fallbackSrc` so the renderer resolves them, while static strings stay in `props`
  unchanged — the serialized `alt` attribute + `<img onerror>` fallback path is unchanged. Touched
  `packages/schema/src/node-definitions.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-image.html`.
- **stats:** 4 files changed, +76/−14. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (10.3m); unit 891 green; check:roadmap + check:links OK. 10
  ui-image E2E (incl. fallback→onerror + alt) green; ui-image minimal-coverage green. Both fields
  optional → no required/validate.
- **notes:** Clean run — no follow-up fix. Completes **Field-Typing Welle 1** (P144–P151:
  ui-button/ui-input/ui-slider/ui-switch/ui-textarea/ui-datepicker/ui-divider/ui-image).
- **cost:** session abe2a62529f172410, ~8m (orchestrator develop-E2E on top).
