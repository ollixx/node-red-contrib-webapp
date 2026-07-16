---
id: P236
node: ui-button
title: "Konformitäts-Pass ui-button — Label-Spec-Drift + fehlende Tests (label-Binding/icon/color/visible/msg)"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/display/ui-button.md
tests: tests/e2e/nodes/view/ui-button.tests.md
---
# P236 — Konformitäts-Pass ui-button

> Ablauf/Checkliste: [epic.md](../epic.md). Cross-Cutting: Hilfe-Link → **P232**,
> No-Crash → **P233** (bei ui-button keiner gefunden), `disabledPath`-Legacy →
> **P229** (nicht hier).

## findings (Audit 2026-07-14)

**1 · Felder** — `label` (Binding), `variant`, `size`, `outline`, `linkMode`
(button/url) + `href` (Binding), `icon`, `disabled` (Binding), Base-Fields (P231).
`disabledPath` = residualer Legacy-`*Path`-Zwilling → **P229** (Cross-Cutting).

**2 · Spec-Drift** (`docs/nodes/display/ui-button.md`):
- `label` ist als „Textfeld … **Statischer String; kein typedInput**" (Z.40)
  dokumentiert — **falsch**: der Code hat `label` als vollen Wert-Binding
  (`{kind:"literal",…}` + `validateValueBindingField`). Gleiche Drift-Klasse wie
  ui-divider/ui-progress.
- Prüfen: sind Base-Fields `visible`/`disabled` in „Allgemein" dokumentiert
  (bei anderen Knoten fehlte `visible`).

**3 · Inline-Hilfe** — Doku-Link via **P232** (Sweep).

**4 · Akzeptanzkriterien** — keine konsolidierte Liste.

**5 · Tests** — **solide** (12 Tests): label-Render, variant primary/danger, size
sm/lg, outline, disabled literal true/false (+ kein Click bei disabled), linkMode
url+href, Click-Event. **Kein** No-Crash-Test. **Fehlt:** `label`-**Store-Binding**
(Live), `icon` im Prefix-Slot, Base-Field **color** (gemessen), **visible=false**
(gebunden) blendet aus, **msg.payload** → Label-Update live, `href`-Binding.

## acceptance (VORSCHLAG — bitte reviewen)

- **label (Literal + Store-Binding)** → Button-Text bzw. Live-Wert.
- **variant** → `sl-button[variant=…]`; **size** sm/lg → `sl-button[size=…]`;
  **outline** → outline-Attribut (alle abgedeckt).
- **disabled (Literal + gebunden)** → `sl-button[disabled]` + kein Click-Event.
- **linkMode=url + href (Literal + gebunden)** → Hyperlink mit href.
- **icon** → `<sl-icon>` im Prefix-Slot des Buttons.
- **Base-Field color (gebunden)** → Button-Farbe entspricht dem Wert (computed-style
  **gemessen**; wirkt seit P231).
- **visible=false (gebunden)** → nicht gerendert (Render-Gate, ADR 0037).
- **Click** → `POST /event` mit `event="click"` + `sourceId` (abgedeckt).
- **msg.payload** → aktualisiert `label` live (SSE).
- **Ports:** 1 Input, 1 Output (Click/Pass-Through).

## verify

`browser` — jedes Kriterium im laufenden App (Playwright; Farbe/Sichtbarkeit
gemessen; [[verify-rendering-by-measurement-not-tags]]).

## spec

`docs/nodes/display/ui-button.md` — `label` als vollen Binding korrigieren (nicht
„statischer String"); Base-Fields `visible`/`disabled` dokumentieren.

## tests

`tests/e2e/nodes/view/ui-button.spec.ts` + `.tests.md` — label-Store-Binding, icon,
color (gemessen), visible-Gate, href-Binding, msg.payload ergänzen; Katalog aktuell.

## geplante Fixes (nach Review)

1. Spec: label-Binding-Korrektur; Base-Fields dokumentieren.
2. Tests: label-Binding, icon, color, visible, href-Binding, msg.payload.

## Result

**Delivered.** ui-button Konformitäts-Pass (leicht) — Spec-Drift gefixt + gemessene Tests; jede Assertion vom Agent EMPIRISCH gegen ein Wegwerf-Node-RED verifiziert (nicht geraten).
- **Spec** `docs/nodes/display/ui-button.md`: `label`-Drift korrigiert (voller Wert-Binding, nicht „statischer String"); Basis-Felder-Sub-Abschnitt (`visible` Render-Gate + `variant` aktiv; `disabled`/`size` eigene Controls; `color` N/A — Farbe via `variant`).
- **Tests** (12 bestehende unberührt): Working-Feature-Tests grün (label Store-Binding live via SSE, icon im Prefix-Slot, href Store-Binding). Katalog aktualisiert.

**Konformitäts-Ertrag — 2 ECHTE Bugs aufgedeckt (Gap-Locks: Tests asserten das reale kaputte Verhalten, KEIN Fake-Grün; „flip on fix"):**
1. **`visible`-Render-Gate ungenwired für ui-button (GAP, breit)** — `toComponentDefinitions` behandelt ui-button (und weitere hand-branched Knoten: input/select/table/…) in EIGENEN Zweigen VOR dem generischen `p16Kind`-Block (der `visible→visibleIf` verdrahtet). Diese Zweige verdrahten `visibleIf` NICHT (0 Vorkommen im Special-Branch-Bereich). Ein gebundenes `visible=false` wird verworfen → Knoten rendert immer. **P231s „visible wirkt überall" ist für hand-branched Knoten unvollständig.** → eigene Fix-Phase (Scope-Audit nötig).
2. **`msg.payload`→`label` erreicht den Snapshot nicht** — `computeLiveViewPatch` listet `label` nicht unter den getragenen Feldern; msg-getriebene Label-Updates gehen verloren (mit ui-text-Control bewiesen). → eigene Fix-Phase.
`color`-N/A ist KEIN Bug (by design). Beide Gaps als Task-Chips herausgelöst.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/view/ui-button.spec.ts` **18 passed** (12 alt + Working-Features + Gap-Locks). `check:specs`/`check:fields`/`check:help`/`check:no-crash`/`check:roundtrip`/`check:links`/`pnpm validate` grün.

**Cost.** Sub-Agent `phase/P236` (worktree), ~16 min (empirisch verifiziert); Orchestrator-E2E + Scope-Analyse Gap A. Token-Zeile in `.ai/agent-runs.jsonl`.
