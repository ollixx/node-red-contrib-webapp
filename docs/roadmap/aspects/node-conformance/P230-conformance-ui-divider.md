---
id: P230
node: ui-divider
title: "Konformitäts-Pass ui-divider — Felder/Spec/Inline-Hilfe/Akzeptanz/Tests"
epic: aspects/node-conformance
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/display/ui-divider.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
---
# P230 — Konformitäts-Pass ui-divider (Pilot)

> Ablauf/Checkliste: [epic.md](epic.md). Pilot zum Kalibrieren.

## findings (Audit 2026-07-14, mit Belegen)

**1 · Felder** — sauber. Base-Fields verdrahtet (Referenzknoten); `label` ist ein
voller Wert-typedInput-Binding (P150); keine `*Path`-Legacy-Reste, kein totes Feld.
`parent`→`app` bleibt bei P228 (nicht hier).

**2 · Spec-Drift** (`docs/nodes/display/ui-divider.md`):
- `label` ist im Code ein **bindbarer** Wert-typedInput (P150, ADR 0012), die Spec
  sagt aber „Statischer String; **kein Binding**" (Z.53) UND listet unter „Offene
  Punkte" „Bindung des `label`-Felds ist noch nicht vorgesehen" (Z.100) — **falsch/
  stale**.
- Base-Felder `visible`/`color`: „Laufzeit-Auswertung folgt mit dem Rollout"
  (Z.43/45) — **stale** (visible→visibleIf wird bereits ausgewertet, P172; Modell
  jetzt ADR 0037/P224).

**3 · Inline-Hilfe** (`data-help-name`, Z.109–112):
- **kein Link zur Voll-Doku** — obwohl die Spec (§Inline-Hilfe, Z.68–71) genau das
  vorschreibt. Fehlt.
- erwähnt `orientation` nicht und nicht, dass `label`/`color` bindbar sind.

**4 · Akzeptanzkriterien** — bisher keine konsolidierte Liste (nur dünne „geplante
Testziele P150" im Katalog).

**5 · Tests** (`ui-divider.spec.ts`, 4 Tests):
- Test „renders without crashing when only defaults are configured" — **verbotener
  No-Crash-Test** (node-testing.md).
- **fehlt:** `label` als **Binding** (Store/state live) — der P150-Kern, laut Katalog
  „dort zu befüllen", nie geschrieben; `color`-Binding als **gemessene** Linienfarbe;
  `visible`-Binding blendet aus; Platzierung (grid/flow) gemessen.
- Base-Field-**Editor**-Tests sind separat abgedeckt (`base-fields.spec.ts`) — nicht
  duplizieren.

## acceptance (VORSCHLAG — bitte reviewen)

Beobachtbar, im laufenden App/Editor zu beweisen:

- **Orientation:** `horizontal` → `<sl-divider>` ohne `vertical`; `vertical` →
  `<sl-divider vertical>`. Im DOM.
- **Label (Literal):** `label="Abschnitt A"` → Text mittig auf der Linie sichtbar.
- **Label (Binding, P150):** `label` an einen Store/state gebunden → der **Live-Wert**
  wird gerendert; ändert sich der Store, aktualisiert sich das Label (SSE-Re-Render).
- **Color (Binding):** `color` an Literal/Store gebunden → die **gerenderte
  Linienfarbe** entspricht dem Wert (per computed-style **gemessen**, nicht nur Attribut).
- **Visible (dynamic-state, ADR 0037):** `visible=false` (gebunden) → Divider ist
  nicht sichtbar; `true` → sichtbar. *(hängt an P224-Laufzeitmodell; bis dahin:
  visibleIf-Render-Gate.)*
- **Platzierung:** in einem `grid`-Layout mit `row`/`col` korrekt positioniert
  (Bounding-Box gemessen); im Flow-Layout wird `order` respektiert.
- **Ports:** Knoten hat **0 Input-, 0 Output-Ports**; emittiert keine Events.
- **Theming:** Linienfarbe/Label-Typografie erben die App-Tokens (`colorBorder`/
  `colorText`) — bei geändertem Token ändert sich die Darstellung.
- **Inline-Hilfe:** enthält Zweck + Hinweis auf bindbares `label`/`color` + **Link
  zur Voll-Doku**.

## verify

`browser` — jedes acceptance-Kriterium im laufenden App/Editor (Playwright,
Messung per Bounding-Box/computed-style, [[verify-rendering-by-measurement-not-tags]]).

## spec

`docs/nodes/display/ui-divider.md` — Drifts (label-Binding, visible/color-Laufzeit)
korrigieren.

## tests

`tests/e2e/nodes/view/ui-divider.tests.md` + `ui-divider.spec.ts` — No-Crash-Test
raus; Feature-Tests (label-Binding, color-Render, visible, Platzierung) frisch nach
node-testing.md; Katalog aktualisiert.

## geplante Fixes (nach Review)

1. Spec: `label` = bindbarer Wert-typedInput; stale „Offene Punkte" + „Laufzeit folgt"
   korrigieren.
2. Inline-Hilfe: Voll-Doku-Link + bindbares label/color erwähnen.
3. Tests: No-Crash raus, Feature-Tests neu, Katalog aktuell.
4. Felder: keine Änderung (sauber).
