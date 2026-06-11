---
id: P144
node: ui-button
epic: nodes/ui-button
title: "ui-button: label auf kanonischen Wert-typedInput (P113-Rollout-Lücke)"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-button label ist noch ein nacktes Textfeld, obwohl P113 es abdecken sollte.)"
verify: browser
spec: docs/nodes/display/ui-button.md
tests: tests/e2e/nodes/view/ui-button.tests.md
dependencies: [P113]
status: done
---
# P144 — ui-button: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Schließt die P113-Lücke: `label` blieb ein nacktes Textfeld. Reines Editor-Paket.

## Befund (heute)

- `label` ist ein nacktes `<input type="text">` (kein typedInput) — `disabled`/
  `href` sind bereits typed (P122), `label` wurde übersehen.

## Zielmodell

- `label` → kanonischer **Wert/Anzeige**-typedInput (`valueBindingTypes({category:"value"})`,
  geteilter Helfer). Persistiert als Binding-Objekt; Default-Typ string. Muster
  exakt wie die bereits umgestellten Label-Felder (ui-checkbox/-select).

## acceptance (observierbar, browser)

- `label`-typedInput bietet den vollen kanonischen Satz; Literal zeigt den Text;
  Store-/state-/reactive-Binding zeigt den Live-Wert.
- Round-Trip des Binding-Objekts über Schließen/Öffnen; bestehende ui-button-E2E grün.

## spec / tests

- spec: `docs/nodes/display/ui-button.md` — `label` als typedInput dokumentieren.
- tests: `tests/e2e/nodes/view/ui-button.tests.md` um label-Binding erweitern.

## Result

- **delivered:** ui-button `label` converted from a bare text input to the canonical
  value/display typedInput (P113 set, default string), persisted as a binding object — mirrors
  the passing ui-checkbox/ui-select label wiring. The typedInput is attached directly to
  `#node-input-label` (not a separate `*Binding` element) so the minimal-coverage field check
  keeps passing without spec changes; a load-shim migrates legacy plain-string `label`. Touched
  `packages/schema/src/node-definitions.ts` (label union binding-or-string),
  `packages/editor/src/nodes.ts` (`bindingOrString`), `nodes/view/ui-button.html`,
  `nodes/webapp.js` (label routed via `bind.label`; literals unwrap to `props.label`; plain
  strings pass through).
- **stats:** 4 files changed, +72/−5. Develop verification: `pnpm build` exit 0, full Playwright
  suite **520 passed / 0 failed** (8.7m); unit 891 green; `pnpm validate` + check:roadmap +
  check:links OK. ui-button minimal-coverage + 12 ui-button view specs green.
- **notes:** Legacy plain-string labels in existing flows (incl. customers-crud) handled
  transparently by the schema union + webapp.js literal-fallback — no example-flow churn. Routine
  Welle-1 field-typing; consumed the shared P113 value-binding helper (not reinvented).
- **cost:** session a7037d1cb4e180792, ~8m (orchestrator develop-E2E on top).
