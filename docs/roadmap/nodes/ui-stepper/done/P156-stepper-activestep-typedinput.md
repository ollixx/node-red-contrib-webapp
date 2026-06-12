---
id: P156
node: ui-stepper
epic: nodes/ui-stepper
title: "ui-stepper: activeStepPath→value (zweiseitig + Change-Event)"
findings:
  - "Field-Typing-Audit (2026-06-11): activeStepPath ist ein nacktes Textfeld; der aktive Step ist zweiseitig (Binding + Change-Event)."
verify: browser
spec: docs/nodes/navigation/ui-stepper.md
tests: tests/e2e/nodes/view/ui-stepper.tests.md
dependencies: [P113]
status: done
---
# P156 — ui-stepper: activeStep als typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. **Nur** der aktive Step — die **Step-Definition** (`steps`)
> ist separat (Collections).

## Befund (heute)
- `activeStepPath` ist ein nacktes Textfeld; `orientation` bleibt Enum-Select.

## Zielmodell
- `activeStepPath` → **`activeStep`**: kanonischer Wert-typedInput, **zweiseitig**
  (Store/State lesen + schreiben) **plus** das bestehende step-change-Event.
  Migration `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `activeStep` an einen Store gebunden: Step-Wechsel schreibt zurück; externe
  Store-Änderung aktiviert den Step; change-Event bleibt. Migration verlustfrei;
  bestehende ui-stepper-E2E grün.

## spec / tests
- spec: `docs/nodes/navigation/ui-stepper.md` — `activeStep` als typedInput.
- tests: `tests/e2e/nodes/view/ui-stepper.tests.md` (neu): activeStep zweiseitig + Event.

## Result

- **delivered:** ui-stepper `activeStepPath`→`activeStep` canonical **two-way** value typedInput
  (ADR 0012), mirroring P155 (ui-tabs) / P154 (ui-pagination): reads the active step from a
  Store/state binding via `bind.value` (renderer resolves → serializer marks the active step), the
  existing step-change event writes the chosen step back to the bound store, legacy
  `activeStepPath` migrates losslessly to `{kind:"state",path}`. Scope limited to the active step —
  `steps` and `orientation` untouched. The webapp.js `mapConfig`+`bind.value` routing for
  `activeStep` already pre-existed (built like ui-tabs); only a props-forward guard was added so a
  bound activeStep isn't also forwarded as a numeric prop. Touched `nodes/view/ui-stepper.html`,
  `packages/{schema,editor,renderer}/src`, `nodes/webapp.js`, spec doc.
- **stats:** 10 files; +10 unit (`p156-...test.ts`, runtime →925) + 4 new ui-stepper E2E
  (A03/A04/E01/M01); editor navigation-nodes guard updated to `activeStepBinding`. Develop
  verification: `pnpm build` exit 0, full Playwright suite **538 passed / 0 failed** (8.8m);
  check:roadmap + check:links + lint OK.
- **notes:** Mirrored P155/P154 (reused input-value write-back/event machinery). New E2E live under
  `tests/e2e/nodes/composite/ui-stepper.spec.ts` (where the node's spec already lived). Clean — no
  follow-up fix.
- **cost:** session a9096de5b82dee040, ~32m (orchestrator develop-E2E on top).
