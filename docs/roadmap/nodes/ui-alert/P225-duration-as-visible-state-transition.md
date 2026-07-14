---
id: P225
node: ui-alert
title: "ui-alert: Duration als deklarativer visible=false-Übergang (schreibt den EINEN Sichtbarkeits-Wert) statt Client-Einweg-Close"
epic: nodes/ui-alert
status: in_progress
dependencies: [P224]
verify: browser
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P225 — Duration als visible-Zustandsübergang

> Rationale: [ADR 0037](../../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md).
> Löst den in [ADR 0032](../../../adr/0032-store-subpath-missing-key-is-transient-not-an-error.md)/
> ui-alert-Doku vermerkten Duration↔visible-Redesign auf.

## findings

Owner (2026-07-14): „Duration ändert das genauso intern." — Duration ist ein
**Schreiber** auf den einen Sichtbarkeits-Wert (ADR 0037), kein Sonderweg.

Heute (getrackt): Duration ist ein **client-seitiger Einweg-Close** — der Serializer
rendert die Alert immer `open`, Shoelace schließt sie einmalig, und ein
`autoDismissed`-Flag verhindert das Wiedereinblenden. Entkoppelt von `visible`, nicht
re-triggerbar.

## acceptance

- **Duration setzt `visible=false` über die Schreib-API (P224).** Nach Ablauf der
  Duration wird der EINE Sichtbarkeits-Wert der Alert auf `false` gesetzt (gebunden →
  in den Store durch; ungebunden → interner per-Client-Slot) — ein echter
  Zustandsübergang, kein DOM-Hack.
- **`autoDismissed`-Hack entfällt.** Der client-seitige Sonder-Merker + das „immer
  open"-Emittieren werden entfernt; die Alert ist ausgeblendet, weil ihr
  Sichtbarkeits-Wert `false` ist — konsistent über Snapshots.
- **Re-triggerbar.** Den Wert wieder auf `true` schreiben (msg/Verb/Store) zeigt die
  Alert erneut — ohne Reload.
- **Countdown bleibt.** Der Fortschrittsbalken (P100) läuft weiter über die Duration;
  nur das Ausblenden ist jetzt ein Wert-Übergang.
- **Browser-Beweis.** Alert mit `duration=3000` verschwindet nach ~3s (Wert=false);
  ein anschließendes `visible=true` (msg/Store) zeigt sie wieder.

## verify

`browser` — Duration-Ablauf blendet aus (Wert-Übergang), erneutes Setzen zeigt
wieder; kein `autoDismissed`-Pfad mehr.

## spec

`docs/nodes/feedback/ui-alert.md` — Duration als visible-Schreiber dokumentieren
(die „bekannte offene Frage" auflösen).

## tests

`tests/e2e/nodes/view/ui-alert.tests.md` — Auto-Hide via Wert-Übergang + Re-Show.

## notes for the implementer

- Nutzt `setDynamicStateField` aus P224. Entfernt den client-seitigen
  `autoDismissed`-Pfad in `resources/lib/webapp-client.js` und das „immer open"-
  Verhalten im Serializer/Renderer für Duration.
