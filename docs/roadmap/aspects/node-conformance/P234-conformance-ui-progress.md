---
id: P234
node: ui-progress
title: "Konformitäts-Pass ui-progress — Spec-Drift/Base-Fields-Doku, Akzeptanz, Testabdeckung neu"
epic: aspects/node-conformance
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/feedback/ui-progress.md
tests: tests/e2e/nodes/view/ui-progress.tests.md
---
# P234 — Konformitäts-Pass ui-progress

> Ablauf/Checkliste: [epic.md](epic.md). Cross-Cutting-Anteile: Hilfe-Doku-Link →
> **[P232](done/P232-help-doc-links-sweep.md)**, „renders without crashing"-Test →
> **[P233](done/P233-remove-no-crash-tests-sweep.md)** (hier nicht duplizieren).

## findings (Audit 2026-07-14)

**1 · Felder** — Base-Fields wirken jetzt (Schema `...baseFieldsSchema`, P231);
`value`/`label` sind volle Bindings (P137); `displayType` (bar/spinner/circular);
`showValue`; Input-Port (msg.payload→value). **Fehlt: `max`-Feld** — der Wert ist
„0…100" hart, die Hilfe sagt aber „0…max" (Inkonsistenz). **Owner-Entscheid
2026-07-16: `max`-Feld ergänzen** (Default 100). `min`/`severity` bleiben bewusst
offene Punkte.

**2 · Spec-Drift** (`docs/nodes/feedback/ui-progress.md`):
- `label` ist als **statisches „Textfeld"** dokumentiert (Z.39) + „Offene Punkte:
  Binding-Erweiterung für spätere Phase" (Z.85) — **falsch/stale**: `label` ist
  bereits ein voller Wert-Binding (P137; die Inline-Hilfe weiß das sogar).
- `value` heißt in der Tabelle „**Value Path**" (Legacy-Name) und „0 und 100"
  (Z.38) — sollte „Value/Wert", `number`-Default, „0…max" bzw. max=100 klargestellt.
- **Base-Fields `visible`/`color` fehlen in der „Allgemein"-Tabelle** (der Knoten
  hat sie; vgl. ui-divider-Spec, die sie dokumentiert).

**3 · Inline-Hilfe** — inhaltlich ok (kennt bindbares `value`/`label`), aber **kein
Voll-Doku-Link** → P232.

**4 · Akzeptanzkriterien** — keine konsolidierte Liste.

**5 · Tests** (`ui-progress.spec.ts`, 4 Tests; Katalog = **Stub**, „P137 … zu
befüllen"): abgedeckt sind bar-Render + value-Attr + label-Attr (Literal). Der
No-Crash-Test → P233. **Fehlt:** `displayType` **spinner/circular** (andere
Darstellung), **`value`-Store-Binding** (Live), **indeterminate** (kein Wert →
endlos animiert) als echte Assertion, **`label`-Store-Binding** (P137-Kern),
**`showValue`**, **Base-Fields color/visible** (jetzt wirksam), **msg.payload-Input**.

## acceptance (VORSCHLAG — bitte reviewen)

Beobachtbar, im laufenden App zu beweisen:

- **displayType `bar`** → `<sl-progress-bar>` mit gesetztem Wert; **`spinner`** →
  `<sl-spinner>` (indeterminate, kein Wertbalken); **`circular`** → kreisförmige
  Anzeige (mit Prozent, wenn `showValue`).
- **value (Literal)** → `sl-progress-bar[value=75]`.
- **value (Store-Binding)** → Live-Wert gerendert; Store-Änderung aktualisiert (SSE).
- **value fehlt/`null`** → **indeterminate** (sl-progress-bar indeterminate-Attribut/
  endlos animiert), nicht Wert 0.
- **label (Literal + Store-Binding)** → Text gerendert bzw. Live-Wert (P137).
- **showValue=true** → Prozentwert-Text sichtbar; `false` → nicht; bei indeterminate
  ignoriert.
- **Base-Field `color` (gebunden)** → Füllfarbe des Balkens entspricht dem Wert
  (computed-style **gemessen**; wirkt seit P231).
- **Base-Field `visible=false` (gebunden)** → nicht gerendert (Render-Gate, ADR 0037).
- **msg.payload-Input** → aktualisiert `value` live (SSE).
- **Ports:** 1 Input, 0 Output.
- **`max`-Feld (NEU, Owner-Entscheid 2026-07-16):** optionales Feld, Default `100`;
  Wert-Bereich 0…`max`. Der Balken skaliert korrekt (z.B. `value=50, max=200` →
  25 % gefüllt); `showValue` zeigt den Prozentwert relativ zu `max`. Schema + Editor
  + Renderer + Test.

## verify

`browser` — jedes Kriterium im laufenden App (Playwright; Messung per computed-
style/DOM; [[verify-rendering-by-measurement-not-tags]]).

## spec

`docs/nodes/feedback/ui-progress.md` — Drifts korrigieren (label bindbar; value-Name/
Range; Base-Fields dokumentieren); offene Punkte auf `severity`/`min`/`max` aktualisieren.

## tests

`tests/e2e/nodes/view/ui-progress.spec.ts` + `.tests.md` — frisch nach
node-testing.md (displayType-Varianten, value Binding+indeterminate, label Binding,
showValue, Base-Fields, msg.payload); Katalog aus dem Stub befüllen.

## geplante Fixes (nach Review)

1. Spec: label-Binding; value-Name/Range (0…max); Base-Fields dokumentieren; offene Punkte.
2. Tests: frisch (Feature-Coverage oben); No-Crash raus (P233), Hilfe-Link (P232).
3. **`max`-Feld ergänzen** (Schema/Editor/Renderer/Serializer + Test; Default 100).
