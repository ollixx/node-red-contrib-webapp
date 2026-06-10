---
id: P120
title: "Zwei-Wege-Farbcodierung: zentrale Tokens (Blau=Wire, Lila=Referenz) + Badge-Helfer + Editor-User-Setting für die Farben"
epic: aspects/editor
status: pending
dependencies: []
---
# P120 — Zwei-Wege-Codierung: Tokens, Badge, User-Setting

> Entscheidung & Begründung: [ADR 0011](../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md) §4.
> Erster Konsument: der Zielquellen-Umschalter in **P119**. Dieses Paket
> liefert die wiederverwendbare Grundlage und ist bewusst klein gehalten.

## findings (Nutzer-Wortlaut, 2026-06-10)

- "Ich hatte gerade den verwegenen Gedanken, die beiden konzeptionellen Wege
  in den Editoren durch Farben darzustellen (blau: node-red wiring, rot: alle
  inline mit internen Referenzen)."
- "Also ich finde die Idee mit Farben gut. Nehmen wir erstmal Blau und Lila.
  Das sollte aber irgendwo konfiguriert werden (vielleicht sogar vom User) →
  Brauchen wir Settings im ui-app oder global?"
- Entschieden (ADR 0011): **Blau = Wire, Lila = Referenz** (Rot verworfen —
  Fehler-Semantik der Admin-UI); immer Farbe **+ Icon + Label**
  (Barrierefreiheit); Konfiguration **editor-global pro User**, NICHT in
  `ui-app` (reine Editor-Darstellung, keine App-Eigenschaft).

## Zielmodell

Alles in `resources/lib/editor-common.js` + dem geteilten Stylesheet (P117):

1. **Tokens:** zwei CSS-Custom-Properties am Editor-Root (Vorschlag
   `--webapp-path-wire-color`, Default Blau, z. B. `#3485e2` an
   Node-REDs Blautöne angelehnt; `--webapp-path-ref-color`, Default Lila,
   z. B. `#8f5bbd`). Alle Konsumenten nutzen NUR die Variablen — nie
   Hex-Werte inline.
2. **Badge-Helfer** (Vorschlag `pathBadge(kind, label)` mit `kind` ∈
   `wire | ref`): erzeugt das Badge-Element — Farbfläche (Token, dezent als
   Hintergrund-Tint), Icon (Stecker für Wire, Kette für Referenz, FontAwesome
   wie im Editor üblich) und Text-Label. Farbe ist nie der einzige Träger:
   Icon + Label sind immer dabei.
3. **User-Setting:** eine Webapp-Sektion in den Editor-User-Settings
   (`RED.userSettings.add({...})`) mit zwei Farbwählern (Wire-Farbe,
   Referenz-Farbe) + „Zurücksetzen auf Standard". Persistenz über den
   Node-RED-üblichen User-Settings-Mechanismus; beim Editor-Start werden die
   Tokens aus dem gespeicherten Wert gesetzt, Änderung wirkt sofort (Variablen
   am Root umsetzen, kein Reload nötig).
4. **Doku:** `docs/nodes/concepts/editor.md` bekommt einen kurzen Abschnitt
   „Zwei-Wege-Codierung" (Semantik Blau/Lila, Konfigurationsort,
   Badge-Helfer) mit Verweis auf ADR 0011.

**Out of scope:** weitere Konsumenten der Tokens (Struktur-Sidebar,
andere Panels) — folgen mit ihren eigenen Paketen; ein allgemeines
„Settings-Konzept" (welche Präferenzen es sonst geben soll) — erst wenn eine
zweite Präferenz real wird, nicht auf Vorrat.

## acceptance (observierbar, browser)

- In den Editor-User-Settings existiert die Webapp-Sektion mit zwei
  Farbwählern (Screenshot).
- Ein per `pathBadge("wire", "via Wire")` / `pathBadge("ref", "Referenz")`
  erzeugtes Badge zeigt Default-Blau bzw. -Lila, je mit Icon + Label
  (Screenshot beider Badges).
- Farbänderung im Setting wirkt ohne Editor-Reload auf sichtbare Badges;
  nach Browser-Reload bleibt sie erhalten (Persistenz). „Zurücksetzen"
  stellt die Defaults wieder her.
- Es existiert kein Konsument mit hartkodierter Wege-Farbe (Code-Suche:
  die Hex-Defaults kommen genau einmal vor — an der Token-Definition).

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` (neuer Abschnitt, in diesem Paket zu
  schreiben).
- tests: E2E `tests/e2e/nodes/editor/dual-path-coding.spec.ts` (neu):
  Settings-Sektion vorhanden, Badge-Farben per computed style, Persistenz
  über Reload. Kein per-Node-Katalog betroffen (zentraler Helfer); P119
  referenziert die Badges in seinen Knoten-Tests.
