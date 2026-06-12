---
id: P157
node: ui-menu
epic: nodes/ui-menu
title: "ui-menu: itemsPath→value (Daten-Array), activeRoutePath→value"
findings:
  - "Field-Typing-Audit (2026-06-11): itemsPath und activeRoutePath sind nackte Textfelder; sollten den Wert-Satz bekommen."
verify: browser
spec: docs/nodes/navigation/ui-menu.md
tests: tests/e2e/nodes/view/ui-menu.tests.md
dependencies: [P113]
status: done
---
# P157 — ui-menu: items + activeRoute als typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. ui-menu rendert seine Items **selbst** (kein Slot-pro-Item)
> — `itemsPath` ist eine **Datenquelle** (Array), kein Repeats-Fall (vgl. ui-list
> [[P140]]).

## Befund (heute)
- `itemsPath` (Menü-Items-Array) und `activeRoutePath` (aktive Route) sind nackte
  Textfelder; `displayType` bleibt Enum-Select.

## Zielmodell
- `itemsPath` → **`items`**: kanonischer Wert-typedInput (Array-Quelle via
  Store/Query/Reactive/JSON-Literal).
- `activeRoutePath` → **`activeRoute`**: kanonischer Wert-typedInput (aktive Route;
  typischerweise routeParam/store). Migration der Pfade `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `items` rendert die Menü-Einträge aus einem Store/Query-Array reaktiv.
- `activeRoute` markiert den aktiven Eintrag aus einem Binding.
- Migration verlustfrei; bestehende ui-menu-E2E grün.

## spec / tests
- spec: `docs/nodes/navigation/ui-menu.md` — `items`/`activeRoute` als typedInput.
- tests: `tests/e2e/nodes/view/ui-menu.tests.md` (neu): items-Binding, activeRoute, Migration.

## Result

- **delivered:** ui-menu Field-Typing Welle 2 (ADR 0012). `itemsPath`→`items` is now a canonical
  **structural array** value typedInput (store/query/reactive/json-literal, default editor type
  json) resolved through the SAME `resolveStructuralBinding` path P133 added for ui-select
  `options` — a legit array slice is no longer rejected by the display-scalar guard; routed through
  `bind.items`, never the scalar `bind.value` path. `activeRoutePath`→`activeRoute` is a read-only
  value typedInput whose resolved route is highlighted by the serializer (`data-webapp-active` +
  `aria-current="page"` on the matching `sl-menu-item`). Both legacy paths migrate losslessly to
  `{kind:"state",path}`; `displayType` stays enum-select. Also wired the pre-existing but dead
  `activeItem` field through `bind.activeItem`→renderer→serializer. Touched `nodes/view/ui-menu.html`,
  `packages/{schema,editor,renderer}/src`, `nodes/webapp.js`, `resources/lib/webapp-serializer.js`.
- **stats:** 9 files + 2 new unit test files; +13 runtime (→938) +8 editor (→96) unit tests; new
  `tests/e2e/nodes/view/ui-menu.spec.ts` (6, replacing the discarded composite spec) + 1 editor
  migration test. Develop verification: `pnpm build` exit 0, full Playwright suite **540 passed / 0
  failed** (8.8m); check:roadmap + check:links + lint OK.
- **notes:** Reused P133's structural-array resolution (not reinvented). Sub-agent self-healed a
  worktree orphan-base provisioning bug (recreated `phase/P157` at the correct SHA with P113
  ancestry confirmed). Clean — no follow-up fix. Welle-2 read/structural fields done; remaining
  Welle 2: P158 (ui-table rows), P159 (ui-icon size).
- **cost:** session a315c25d7791d21e5, ~50m (orchestrator develop-E2E on top).
