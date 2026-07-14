---
id: P230
node: ui-divider
title: "Konformitäts-Pass ui-divider — Felder/Spec/Inline-Hilfe/Akzeptanz/Tests"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/display/ui-divider.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
---
# P230 — Konformitäts-Pass ui-divider (Pilot)

> Ablauf/Checkliste: [epic.md](epic.md). Pilot zum Kalibrieren.

> **Pilot-Ergebnis (2026-07-14):** ✅ Spec-Drifts (label bindbar; visible/color-
> Laufzeit) + Inline-Hilfe (Doku-Link, Bindbarkeit) korrigiert. ✅ Tests grün:
> orientation, label (Literal + Store-Binding), ports. 🔴 **color + visible blockiert
> durch einen systemischen Bug:** Base-Fields fehlen im Schema → Zod strippt sie →
> `component.color === undefined` zur Laufzeit. Cross-Cutting, eigenes Paket
> **[P231](../../aspects/editor/done/P231-base-fields-in-schema-and-runtime.md)**; die
> color/visible-Divider-Tests sind `test.fixme` (Verweis P231) und werden dort grün
> gezogen. Kalibrierung: ein per-Knoten-Pass deckt systemische Bugs auf; E2E nicht
> parallel zum Orchestrator fahren (Port 1882).

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

## Result

**Delivered.** Konformitäts-Pass ui-divider (Pilot der `node-conformance`-Epic) — Spec-Drift korrigiert, Inline-Hilfe vervollständigt, Tests von No-Crash auf gemessene Feature-Tests umgestellt.
- **Spec** `docs/nodes/display/ui-divider.md`: `label` = voller Wert-typedInput-Binding (P150, war „kein Binding"); stale „Laufzeit folgt mit dem Rollout" für visible/color + „Offene Punkte" korrigiert.
- **Inline-Hilfe** `nodes/view/ui-divider.html`: Orientation/label/color bindbar erwähnt + **Link zur Voll-Doku** (fehlte).
- **Tests** `tests/e2e/nodes/view/ui-divider.spec.ts`: der verbotene „renders without crashing"-Test raus; frische Feature-Tests (orientation, label literal + gebunden P150, ports). Die color- + visible-Render-Tests waren `test.fixme` (Base-Fields vom Schema gestrippt) — der Pilot deckte damit den **systemischen Fehler** auf → eigenes Paket **[P231](../../editor/done/P231-base-fields-in-schema-and-runtime.md)**. Nach P231 ent-fixmed + grün.

**Verify (browser, gemessen — Haupt-Checkout).** `ui-divider.spec.ts` **9/9 passed** (nach P231): orientation (h/v im DOM), label literal + gebunden (P150 Live-Wert), **color** gebunden → `sl-divider --color` (computed-style gemessen), **visible=false** → nicht gerendert (Render-Gate), 0 In-/Out-Ports. Katalog `ui-divider.tests.md` aktualisiert.

**Epic-Ertrag.** Der Pilot hat seinen Zweck erfüllt: er kalibrierte den Konformitäts-Ablauf UND fand den Cross-Cutting-Schema-Strip-Bug (P231), der ADR 0037 auf ~30 Knoten untergrub.

**Cost.** Owner-WIP (Doc/Hilfe/Tests) + Orchestrator (P231-Diagnose/Fix, Katalog, E2E-Verifikation). Token-Zeilen in `.ai/agent-runs.jsonl`.
