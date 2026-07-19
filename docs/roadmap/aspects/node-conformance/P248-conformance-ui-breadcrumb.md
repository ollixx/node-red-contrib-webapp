---
id: P248
node: ui-breadcrumb
title: "Konformitäts-Pass ui-breadcrumb (leicht) — `separator`-String-Feld ist inert (Serializer nutzt separator-Region), `navigate`-Event ungetestet; Kern solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-breadcrumb.md
tests: tests/e2e/nodes/view/ui-breadcrumb.tests.md
---
# P248 — Konformitäts-Pass ui-breadcrumb (leicht)

> Audit 2026-07-17. Kern **solide** — 7 outcome-E2E (Objekt-/String-Items, click-
> Dispatch, `aria-current`, Label-als-Action, letzter Eintrag klickbar, leere Liste),
> Base-Fields (visible/color; disabled N/A für non-interaktiven Zustand), Katalog
> vorhanden, Doku-Link korrekt.

## findings

### A. `separator`-String-Feld vermutlich inert
Schema `separator: z.string().optional()`, `mapConfig` trägt es durch
(`separator: config.separator` webapp.js:7899). Aber der Serializer
(`resources/lib/webapp-serializer.js:1126`) rendert den Separator aus einer
**Layout-Region** namens `separator` (`<span slot="separator">…`), **nicht** aus
`props.separator`. Ein `props.separator`-Konsum ist nirgends zu finden ⇒ das
String-Feld erreicht das AppModel, wird aber nicht gerendert. **Zu verifizieren:**
setzt ein `separator="/"` beobachtbar den Breadcrumb-Separator? Falls nein: inert →
implementieren (String → `slot="separator"`) **oder** aus Schema+Editor+Spec entfernen.

### B. `navigate`-Event ungetestet
`events: ["click","navigate"]`. Die E2E prüfen `click`-Dispatch; **`navigate`**
(Item mit Route/Pfad → navigate-Event) ist nicht per Verhaltens-E2E belegt.

### C. Kleinere
- **Legacy-Zwillinge** `itemsJson`/`itemsPath` in `defaults` — ADR-0038-Sweep-Territorium
  (P229 deferred), nur vermerken.
- **Der „empty items → sibling still renders"-Test** ist grenzwertig Presence-artig;
  prüfen, ob die 0-Items-Assertion als echtes Outcome zählt (tut sie: „zero items").

## acceptance

- **`separator` aufgelöst:** ein gesetzter `separator` erzeugt einen **gemessenen**
  Separator im DOM — oder das Feld ist aus Schema+Editor+Spec entfernt (Separator
  bleibt dann rein Region-basiert, dokumentiert). Kein dokumentiertes Feld ohne Wirkung.
- **`navigate`-Verhaltens-E2E:** ein Route/Pfad-Item feuert `navigate` mit korrektem
  `msg.ui`-Envelope (gemessen).
- **Katalog** `ui-breadcrumb.tests.md` spiegelt die neuen Tests.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — separator + navigate per gemessenem DOM/Envelope; die 7 bestehenden bleiben grün.

## spec
`docs/nodes/navigation/ui-breadcrumb.md` — separator-Wahrheit, navigate-Verhalten.

## tests
`tests/e2e/nodes/view/ui-breadcrumb.spec.ts` + Katalog.

## notes for the implementer
- `separator`-String vs -Region ist dasselbe Inert-Muster wie ui-menu displayType /
  ui-dialog modal — am Serializer prüfen, nicht an mapConfig.
- Legacy `itemsJson`/`itemsPath` NICHT hier sweepen (P229).
