---
id: P155
node: ui-tabs
epic: nodes/ui-tabs
title: "ui-tabs: activeTabPath→value (zweiseitig + Change-Event)"
findings:
  - "Field-Typing-Audit (2026-06-11): activeTabPath ist ein nacktes Textfeld; der aktive Tab ist zweiseitig (Binding + Change-Event) wie ein Input-value."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P113]
status: done
---
# P155 — ui-tabs: activeTab als typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. **Nur** der aktive Tab — die **Tab-Definition** (`tabs`)
> und dynamische Slots sind separat (Collections / [[P142]]).

## Befund (heute)
- `activeTabPath` ist ein nacktes Textfeld.

## Zielmodell
- `activeTabPath` → **`activeTab`**: kanonischer Wert-typedInput, **zweiseitig**
  (Store/State lesen + schreiben) **plus** das bestehende tab-change-Event.
  Migration `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `activeTab` an einen Store gebunden: Tab-Wechsel schreibt zurück; externe
  Store-Änderung aktiviert den Tab; change-Event bleibt. Migration verlustfrei;
  bestehende ui-tabs-E2E grün. (`tabs`-Definition unverändert.)

## spec / tests
- spec: `docs/nodes/navigation/ui-tabs.md` — `activeTab` als typedInput (zweiseitig + Event).
- tests: `tests/e2e/nodes/view/ui-tabs.tests.md` (neu): activeTab zweiseitig + Event, Migration.

## Result

- **delivered:** ui-tabs `activeTabPath`→`activeTab` canonical **two-way** value typedInput (ADR
  0012), mirroring P154's ui-pagination `currentPage`: reads the active tab from a Store/state
  binding via `bind.value` (renderer resolves → serializer marks the matching `sl-tab` active), the
  existing tab-change event writes the chosen tab back to the bound store, legacy `activeTabPath`
  migrates losslessly to `{kind:"state",path}`. Scope limited to the active tab — the `tabs` list
  is untouched (dynamic slots are separate Collections/P142 work). The missing piece vs P113 was
  routing `activeTab` through `bind.value` in the p16Kind component-builder for the `tabs` kind.
  Touched `nodes/webapp.js`, `packages/{schema,editor,renderer}/src`, `nodes/view/ui-tabs.html`,
  spec doc.
- **stats:** 6 source files + 1 new unit (`p155-...test.ts`, +10) + new view E2E
  `tests/e2e/nodes/view/ui-tabs.spec.ts` (7, replacing the old composite spec). Develop
  verification: `pnpm build` exit 0, full Playwright suite **534 passed / 0 failed** (8.9m); unit
  915 green; check:roadmap + check:links + lint OK.
- **notes:** Mirrored P154 exactly (reused the input-value write-back/event machinery, not
  reinvented). Old `tests/e2e/nodes/composite/ui-tabs.spec.ts` removed and rewritten fresh under
  `view/` per node-testing.md. Clean — no follow-up fix.
- **cost:** session afc992e6fafca0636, ~14m (orchestrator develop-E2E on top).
