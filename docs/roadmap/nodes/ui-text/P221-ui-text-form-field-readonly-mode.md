---
id: P221
node: ui-text
title: "ui-text: read-only Form-Feld-Modus — Label + Wert wie ein Control gestylt, für Formulare (Beispiel: ID-Feld im Entity Editor)"
epic: nodes/ui-text
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/display/ui-text.md
tests: tests/e2e/nodes/view/ui-text.tests.md
---
# P221 — ui-text: read-only Form-Feld-Modus

> Rationale: [ADR 0035](../../../adr/0035-ui-text-form-field-readonly-mode.md).

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
