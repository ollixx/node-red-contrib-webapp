---
id: P248
node: ui-breadcrumb
title: "Konformitäts-Pass ui-breadcrumb (leicht) — `separator`-String-Feld ist inert (Serializer nutzt separator-Region), `navigate`-Event ungetestet; Kern solide"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-19.** Leichter Pass; beide Feld-Befunde **gemessen** aufgelöst.

### `separator` — gemessen doppelt inert → implementiert (ehrlich gemacht)

`mapConfig` trug `separator` in die Definition, aber die generische Props-Assembly
in `toComponentDefinitions` (webapp.js) enumeriert Props explizit und hatte **keine
`separator`-Zeile** → fiel vor dem Serializer weg; der Static-Items-Zweig las
`props.separator` ohnehin nie. `separator=">"` hatte **null** DOM-Wirkung (Shoelace
zeigte immer das native `/`). **Lower-risk implement** gewählt: `separator` fließt
jetzt in `component.props`, und ein nicht-leerer String wird als
`<span slot="separator">…</span>` geslottet (überschreibt das native `/`).
**Gemessen:** `separator=">"` → `sl-breadcrumb > span[slot='separator']` count=1,
text=`>`; ohne separator → count=0. Der region-basierte Separator
(`layout="breadcrumb"`, Kind im Slot `separator`) ist unberührt + gegenseitig
exklusiv per Modus — dokumentiert.

### `navigate` — gemessen NICHT emittiert → ehrlicher Lock (nicht entfernt)

Gute Agent-Entscheidung: die `events:["navigate"]` im Schema sind **intentionaler
P75-Back-Compat** (durch einen bestehenden Schema-Test gepinnt), NICHT zu entfernen.
Zur Laufzeit emittiert `mapConfig` `events:["click"]`; der Client dispatcht für
Breadcrumb-Items nur `click` (der `navigate`-Client-Pfad braucht
`data-webapp-navigate-path`, das der Breadcrumb-Serializer nie emittiert — P95-Design:
Navigation via `click` → `ui-action navigate` verdrahten). Ein „navigate feuert"-E2E
ist damit **unmöglich**; stattdessen ein ehrlicher Lock: ein Route/Pfad-Item
(`action="/customers"`) feuert `click` (nicht `navigate`) mit korrektem
`msg.ui`-Envelope. Spec + Katalog sagen die navigate-Wahrheit explizit.

### Verifikation (Haupt-Checkout, autoritativ)

Beide P247+P248 zusammen im **sauberen** Voll-Lauf: **800 passed, 0 failed,
`--retries=0`, 15,3 min.** (Dieser Lauf ersetzt einen vorherigen, den der
Orchestrator selbst sabotiert hatte, indem er Port 1882 killte, während der Lauf
noch lief — 279 Scheinfehler; siehe [[e2e-verify-build-and-no-tail]]. Der saubere
Lauf beweist: kein echter P247/P248-Regress.) Unit `p95-breadcrumb-redesign` 23
passed (+4). `pnpm validate` + Tripwires grün. Agent committete VOR der Verifikation
und stoppte alle Prozesse (Port 1882 frei).
