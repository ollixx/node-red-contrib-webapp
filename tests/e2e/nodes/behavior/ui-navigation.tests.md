# Testkatalog: ui-navigation

> Format gemäß `.ai/agents/node-testing.md`. ui-navigation ist als deprecated
> markiert (bevorzugt `ui-action` Typ `navigate`), trägt aber seit P119
> (ADR 0011 §5) denselben Zielquellen-Umschalter wie ui-action.

## P119 — Zielquellen-Umschalter angeglichen (ADR 0011 §5)

Browser-E2E: `tests/e2e/nodes/editor/navigate-target-modes.spec.ts`,
`tests/e2e/nodes/behavior/ui-navigation.spec.ts`.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Drei-Modus-Umschalter sichtbar | `navigate-target-modes.spec.ts` → „ui-navigation shows the same three-mode switcher" | Segmente `wire` / `route` / `url` vorhanden; Legacy-`to`-Config öffnet im `url`-Modus. |
| Render bleibt heil ohne Referenz | `ui-navigation.spec.ts` → „deploying a ui-navigation node alone…" | Eine ui-navigation allein bricht das Rendering nicht. |
| Navbar-Button + Navigation | `ui-navigation.spec.ts` → „clicking a navbar button wired to a ui-action(navigate)…" | Klick auf Navbar-Button → Client folgt zur Zielroute. |
| Panel öffnet ohne Crash, App-Picker | `behavior-state.spec.ts` → „ui-navigation — opens without crash…" | `name`/`parent` vorhanden, App im Picker gelistet, 1 Input-Port. |

Unit-Belege (nicht-Browser):
- `to` ist seit P119 optional (Route-Modus addressiert via `routeId`): eine
  ui-navigation ohne `to` assembliert und bleibt aus der `to`-gekeyeden
  navigations-Liste — `packages/runtime/test/node-set-runtime.test.ts`
  („P119: a route-mode ui-navigation (no `to`)…").
- ui-navigation wird weiterhin als `url`-Ziel mit `to` in den Aktionen
  gespiegelt — `packages/runtime/test/node-set-runtime.test.ts` („mirrors
  ui-navigation nodes into typed navigate actions…").
