---
id: P153
node: ui-badge
epic: nodes/ui-badge
title: "ui-badge: valuePath→value (kanonischer Wert-typedInput)"
findings:
  - "Field-Typing-Audit (2026-06-11): ui-badge valuePath ist ein nacktes Textfeld; sollte value heissen + den Wert-Satz bekommen."
verify: browser
spec: docs/nodes/feedback/ui-badge.md
tests: tests/e2e/nodes/view/ui-badge.tests.md
dependencies: [P113]
status: done
---
# P153 — ui-badge: valuePath → value-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. Reines Editor-Paket.

## Befund (heute)
- `valuePath` ist ein nacktes `<input type="text">` (Anzeige-Wert des Badge).
  `displayType`/`variant` bleiben Enum-Select bzw. Farb-Rolle.

## Zielmodell
- `valuePath` → **`value`** (kanonischer Wert-typedInput, `category:"value"`),
  Default string. Migration `valuePath`→`{kind:"state", path}` (Muster P137).

## acceptance (observierbar, browser)
- `value`-typedInput bietet den vollen Satz; Literal/Store/state/reactive zeigen
  den Live-Wert im Badge; `valuePath`-Migration verlustfrei; Round-Trip;
  bestehende ui-badge-E2E grün.

## spec / tests
- spec: `docs/nodes/feedback/ui-badge.md` — `value` (typedInput, Umbenennung).
- tests: `tests/e2e/nodes/view/ui-badge.tests.md` um value-Binding + Migration erweitern.

## Result

- **delivered:** ui-badge `valuePath` renamed to `value` as the canonical P113 value/display
  typedInput (default string), with a lossless load-shim `valuePath`→`{kind:"state", path}` —
  mirrors P137 (ui-progress). The editor wires the typedInput on `#node-input-valueBinding` with
  the migration shim in `oneditprepare` + `oneditsave` persistence; editor mapper uses
  `isBindingObject` with `valuePath` fallback. `displayType`/`variant` unchanged. webapp.js needed
  no change (already `getBinding(config.value, valuePath fallback)` since P92); schema `value:
  bindingSchema` was already correct. Touched `nodes/view/ui-badge.html`,
  `packages/editor/src/nodes.ts`.
- **stats:** +6 unit tests (`packages/runtime/test/p153-badge-value-typedinput.test.ts`, runtime
  →897) + 1 ui-badge migration E2E (13 total). Develop verification: `pnpm build` exit 0, full
  Playwright suite **521 passed / 0 failed** (8.8m, +1 net new); check:roadmap + check:links +
  lint OK; ui-badge minimal-coverage (name/mount) intact.
- **notes:** First Welle-2 phase; consumed the shared P113 helper, mirrored P137. Clean — no
  follow-up fix.
- **cost:** session ae154890cb8c453c9, ~25m (orchestrator develop-E2E + a branch-state recovery:
  the sub-agent's `git switch` had left the main checkout on phase/P153, so the merge to develop
  was redone explicitly).
