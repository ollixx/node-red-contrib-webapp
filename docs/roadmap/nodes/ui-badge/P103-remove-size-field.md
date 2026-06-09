---
id: P103
title: "ui-badge: size-Feld komplett entfernen (Schema, mapConfig, Serializer, Editor, Fixtures, Tests, Docs)"
epic: nodes/ui-badge
status: pending
dependencies: [P92]
node: ui-badge
verify: browser
spec: docs/nodes/feedback/ui-badge.md
tests: tests/e2e/nodes/view/ui-badge.tests.md
---
# P103 — ui-badge: size-Feld komplett entfernen

## Findings
> Owner-Vorgabe.

- Das in P92 eingeführte `size`-Feld muss **komplett raus** aus ui-badge. Ohne ein zweites Backend, das Badge-Sizing nativ kann, ist die reine `data-size`-Emission totes Gewicht. Größenunterschiede werden – falls nötig – per Theme/CSS am Einsatzort gelöst, nicht über ein Knotenfeld. Die Doc ist bereits angepasst; der Code muss nachziehen.

## Acceptance
> `verify: browser` — im laufenden Editor + Render zu beweisen.

- Schema: `size` ist aus `uiBadgeNodeDefinitionSchema` (`packages/schema/src/node-definitions.ts`) entfernt. Eine Badge-Definition mit gesetztem `size` aus einem **alten Flow** wird ohne Fehler geladen (unbekanntes Feld wird ignoriert, kein Validierungsfehler) — Back-Compat-Test.
- Editor: das Property-Panel von ui-badge zeigt **keine** „Size"-SelectBox mehr (`nodes/view/ui-badge.html`).
- Laufzeit: `nodes/webapp.js` (mapConfig) assembliert `size` für badge nicht mehr; der Serializer/Adapter emittiert **kein** `data-size` mehr auf dem gerenderten Badge — im DOM ist kein `data-size`-Attribut vorhanden (Outcome-Test).
- Fixtures: `packages/schema/src/fixtures.ts` setzt für das Badge-Fixture kein `size` mehr (falls vorhanden).
- Tests: die badge-Unit-Tests (p92) und der E2E-/Test-Katalog sind aktualisiert — alle `size`/`data-size`-Assertions entfernt bzw. in „kein data-size"-Assertions gedreht; Katalog `ui-badge.tests.md` aktuell.
- Docs: [ui-badge.md](../../../nodes/feedback/ui-badge.md) ist bereits angepasst (kein `size`-Feld, „Kein size"-Hinweis) — Konsistenz prüfen.

## Notes
- `componentSizeSchema`/`COMPONENT_SIZES` bleiben bestehen (andere Knoten nutzen sie) — nur die badge-Verwendung entfällt.
- Reines Entfernen, kein Ersatz. Die Cross-Backend-Warnung (P102) ist hiervon unabhängig und derzeit zurückgestellt.
