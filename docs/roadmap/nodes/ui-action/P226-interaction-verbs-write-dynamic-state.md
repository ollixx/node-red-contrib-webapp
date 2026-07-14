---
id: P226
node: ui-action
title: "ui-action: show/hide (+ enable/disable) schreiben den EINEN dynamic-state-Wert statt Client-Overlay; ui-alert einbinden"
epic: nodes/ui-action
status: in_progress
dependencies: [P224]
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P226 — Interaktions-Verben schreiben den dynamic-state-Wert

> Rationale: [ADR 0037](../../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md).
> Vereinheitlicht den imperativen show/hide-Pfad mit dem deklarativen Wert.

## findings

Owner (2026-07-14): show/hide ist nur ein weiterer „von außen"-Schreiber auf den
EINEN Sichtbarkeits-Wert (ADR 0037), kein separates System.

Heute (getrackt): `ui-action` show/hide pusht ein **client-seitiges Overlay**
(`interaction.hidden` → CSS `.webapp-hidden`) via `interactionInputHandler`,
getrennt vom deklarativen `visible`. `ui-alert` ist gar nicht eingebunden
(fehlt in `INTERACTION_VERBS_BY_TYPE`).

## acceptance

- **show/hide schreiben den Wert.** `show`/`hide` setzen den EINEN
  Sichtbarkeits-Wert des Zielknotens über die Schreib-API (P224) — gebunden → in den
  Store durch; ungebunden → interner per-Client-Slot. **enable/disable** setzen analog
  `disabled`.
- **Client-Overlay entfällt (für Sichtbarkeit).** Der `interaction.hidden`-Overlay-Pfad
  wird für Sichtbarkeit zurückgebaut/ersetzt: die Sichtbarkeit folgt dem Wert (ein
  Snapshot-Re-Render), nicht einer separaten CSS-Schicht.
- **ui-alert einbinden.** `ui-alert` erhält die Sicht-Verben (in
  `INTERACTION_VERBS_BY_TYPE`), sodass show/hide auf Alerts wirkt.
- **Konsistenz mit Binding.** Ist `visible` an einen Store gebunden, ändert `hide`
  den **Store** (durchgeschrieben) — dieselbe Wahrheit wie ein direkter Store-Write.
- **Browser-Beweis.** Ein `ui-action` hide auf eine (gebundene und eine ungebundene)
  Alert blendet sie aus; show wieder ein; bei Binding ändert sich der Store-Wert.

## verify

`browser` — show/hide/enable/disable an gebundenen + ungebundenen Zielen im laufenden
Flow; Store-Durchschreiben geprüft.

## spec

`docs/nodes/behavior/ui-action.md` — Verben als dynamic-state-Schreiber dokumentieren
(nicht mehr als reines Client-Overlay).

## tests

`tests/e2e/nodes/behavior/ui-action.tests.md` — Verben schalten den Wert (gebunden +
ungebunden), ui-alert eingebunden.

## notes for the implementer

- Nutzt `setDynamicStateField` aus P224. Betrifft `interactionInputHandler` /
  `buildInteractionCommand` (nodes/webapp.js) und den `interaction.hidden`-Pfad in
  `resources/lib/webapp-client.js`. `INTERACTION_VERBS_BY_TYPE` um `ui-alert` (und
  ggf. weitere fehlende Knoten) ergänzen.
