---
id: P221
node: ui-text
title: "ui-text: read-only Form-Feld-Modus — Label + Wert wie ein Control gestylt, für Formulare (Beispiel: ID-Feld im Entity Editor)"
epic: nodes/ui-text
status: done
dependencies: []
verify: browser
spec: docs/nodes/display/ui-text.md
tests: tests/e2e/nodes/view/ui-text.tests.md
---
# P221 — ui-text: read-only Form-Feld-Modus

> Rationale: [ADR 0035](../../../../adr/0035-ui-text-form-field-readonly-mode.md).

## findings

Owner (2026-07-13, verbatim):

> „Wir brauchen ggf. eine Lösung für Formulare, die neben den Controls auch einen
> einfachen Text mit Label anzeigen können, genauso gestyled wie die Controls.
> Beispiel: ID-Feld in Entity Editor."

Heute rendert `ui-text` als freier Anzeigetext ohne Formular-Control-Optik — in ein
Formular neben `ui-input`/`ui-select` gesetzt wirkt es unausgerichtet (keine
Label-Spalte, andere Typo). Owner-Entscheid: **neue Option auf `ui-text`** (kein
neuer Knoten, keine Änderung an `ui-input`).

## acceptance

- **Neue Option.** `ui-text` bekommt eine Presentation-Option (z.B.
  `display: text | formField` bzw. boolean `asFormField`), Default = bisheriges
  freies Text-Rendering (bestehende Flows unverändert). Wert/Default in der Spec
  dokumentiert; `check:specs` grün.
- **Form-Feld-Rendering.** Ist der Modus aktiv, rendert `ui-text` als **gelabelte
  Formular-Zeile**: `label` links, (gebundener) Wert rechts, **gleiche Feld-Layout-
  und Typo-Optik wie die Input-Controls** — im Browser **gemessen** (Label-Spalte
  und Wert-Zelle liegen auf denselben Achsen/Baseline wie ein benachbartes
  `ui-input`, per Bounding-Box, nicht per Klassen-Assert; vgl.
  [[verify-rendering-by-measurement-not-tags]]).
- **Read-only.** Keine Editierbarkeit, keine Wert-Emission, kein Input-Event —
  reine Anzeige. Der Wert wird wie bei `ui-text` gebunden (`value`-typedInput inkl.
  `store`-subPath), sodass `store:EntityEditor._id` die ID in der Formularzeile
  zeigt.
- **ADR-0032-Konsistenz.** Ist der gebundene Wert (noch) leer (z.B. `_id` vor dem
  Speichern), zeigt die Zeile **leer** (kein `"?"`), das Label bleibt sichtbar.
- **Editor.** Der Modus-Schalter erscheint; `formField` macht `label` relevant
  (Abhängigkeit dokumentiert). Auswahl round-trippt (open→save, ADR 0031).
- **Katalog/Spec.** `docs/nodes/display/ui-text.md` beschreibt die Option (Werte,
  Default, Abhängigkeit zu `label`, gerenderte Wirkung); `ui-text.tests.md` gepflegt.

## verify

`browser` — im laufenden App: `ui-text` im Form-Feld-Modus neben einem `ui-input`;
Ausrichtung per Bounding-Box gemessen; leerer/gesetzter Wert geprüft.

## spec

`docs/nodes/display/ui-text.md`

## tests

`tests/e2e/nodes/view/ui-text.tests.md`

## notes for the implementer

- Kein neuer Knoten, kein Eingriff in `ui-input`. Der Wert-Zellen-Stil soll die
  read-only-Optik der Shoelace-Controls treffen (z.B. `sl-input readonly`/Plain-
  Cell) — über den Shoelace-Adapter/Serializer.
- Node-Tests fresh nach `.ai/agents/node-testing.md` (ui-text ist ein ui-*-Knoten).

## Result

**Delivered.** `ui-text` bekommt einen read-only Form-Feld-Modus (ADR 0035) — kein neuer Knoten, kein Eingriff in `ui-input`.
- **Schema** `packages/schema/src/contracts.ts` (`TEXT_DISPLAY_MODES = ["text","formField"]` + `TextDisplayMode`) + `index.ts` Exports; `node-definitions.ts`: `uiTextNodeDefinitionSchema` bekommt `display: enum(...).optional()` + `label: string().optional()` (`.optional()` statt `.default()`, damit bestehende Flows/Fixtures nicht in den Inferred-Union-Typ gezwungen werden).
- **Runtime** `packages/runtime/src/node-set.ts` (`toTextComponent`) + `nodes/webapp.js` (ui-text `mapConfig`/`toComponentDefinitions`) tragen `display`/`label` durch (props nur wenn aktiv).
- **Serializer** `resources/lib/webapp-serializer.js`: `kind==="text"` + `display==="formField"` rendert `<sl-input class="webapp-text-field" label readonly value>` aus dem normalisierten `component.text` — dasselbe `sl-input`-Element wie `ui-input`, daher identische Label-/Wert-Achsen.
- **Editor** `nodes/view/ui-text.html`: `display` (Plain-`<select>`, Default `text`) + `label`; `oneditprepare` zeigt die Label-Zeile nur im formField-Modus und defaultet den Selector auf `text`, wenn ein Alt-Knoten ohne `display` geöffnet wird (kein blanker Selektor). **Doku** `docs/nodes/display/ui-text.md` + `ui-text.tests.md`.

**Read-only / ADR-0032.** Kein `name`, keine `data-webapp-source`/`event`, `readonly` gesetzt → keine Editierbarkeit, keine Emission. Wert bindet über den bestehenden `value`-typedInput inkl. `store`-subPath; leerer gebundener Wert (z.B. `_id` vor Save) → leere Wert-Zelle, **kein** `"?"`, Label bleibt sichtbar.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/view/ui-text-form-field.spec.ts` + `tests/e2e/nodes/editor/ui-text-display-mode.spec.ts` — **5 passed**: formField `ui-text` liegt auf denselben Label-/Wert-Achsen wie ein benachbartes `ui-input` (Bounding-Box, Shoelace-Parts `form-control-label`/`form-control-input`); read-only (kein Emit); leerer Wert → leere Zelle ohne `"?"`; Display-Selector Default `text` + Label-Zeilen-Abhängigkeit + open→save→reopen-Persistenz.

**Orchestrator-Fix.** Ein Editor-Test war rot (Alt-Knoten ohne `display` zeigte blanken Selektor statt `text`); mit einer Zeile in `oneditprepare` behoben (Selektor defaultet auf `text`) — E2E danach grün.

**Stats.** Unit grün: schema 492 (+6), editor 178, renderer 152, runtime 1220 (+9). `pnpm build`/`lint`/`check:specs` (42)/`check:roundtrip`/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P221` (worktree), ~28 min (16:42:04Z→17:09:58Z); nach Netz-Ausfall (ConnectionRefused) aus dem Transkript fortgesetzt, kein Verlust. Token-Zeile in `.ai/agent-runs.jsonl`.
