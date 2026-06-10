---
id: P120
title: "Zwei-Wege-Farbcodierung: zentrale Tokens (Blau=Wire, Lila=Referenz) + Badge-Helfer + Editor-User-Setting für die Farben"
epic: aspects/editor
status: done
dependencies: []
---
# P120 — Zwei-Wege-Codierung: Tokens, Badge, User-Setting

> Entscheidung & Begründung: [ADR 0011](../../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md) §4.
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
- Nachschärfung (Owner, 2026-06-10): "Ich finde die Pastell-Varianten der
  Farben nicht sehr eindeutig. Ich dachte eher, dass wir die Background-Farbe
  deutlich dahinterlegen. Die Modus-Switches könnten dann passend auch
  kräftiger sein." → **kräftige Vollflächen** (Badge-/Segment-Hintergrund ist
  die volle Farbe mit **weißer** Schrift/Icon), KEIN heller Tint; das aktive
  Modus-Switch-Segment ist eine gefüllte Vollfläche.

> Zielbild der Codierung (kräftig, nicht pastell) in den Skizzen zu ADR 0011:
> [Modi](../../../../adr/assets/0011-target-modes.svg) ·
> [Voreinstellung](../../../../adr/assets/0011-mode-preselection.svg) ·
> [Laufzeit-Vorrang](../../../../adr/assets/0011-runtime-precedence.svg).

## Zielmodell

Alles in `resources/lib/editor-common.js` + dem geteilten Stylesheet (P117):

1. **Tokens:** zwei CSS-Custom-Properties am Editor-Root (Vorschlag
   `--webapp-path-wire-color`, Default kräftiges Blau, z. B. `#185FA5`;
   `--webapp-path-ref-color`, Default kräftiges Lila, z. B. `#534AB7`). Die
   Töne sind **Vollflächen-tauglich** (weiße Schrift darauf lesbar), nicht als
   Tint gedacht. Alle Konsumenten nutzen NUR die Variablen — nie Hex-Werte
   inline.
2. **Zwei Anwendungsformen derselben Tokens (ADR 0011 §4):**
   - **Panel-Hintergrund** (bevorzugt, wo ein ganzes Panel den Weg trägt — z. B.
     das ui-action-Navigations-Panel in P119): der Panel-Hintergrund nimmt die
     Modus-Farbe als kräftige Vollfläche an; Formfelder sitzen als helle Insets
     darauf; das Icon steckt im Modus-Switch; **kein** Pill-Badge, nur eine
     schlichte Überschrift. (Siehe Skizze 1 zu ADR 0011.)
   - **Kompaktes Badge** (`pathBadge(kind, label)`, `kind` ∈ `wire | ref`) für
     Kontexte ohne färbbares Panel (z. B. Struktur-Sidebar-Zeilen): kräftige
     Farbvollfläche (Token als Hintergrund, **weiße** Schrift + Icon), Icon
     (Stecker für Wire, Kette für Referenz, FontAwesome wie im Editor üblich)
     und Text-Label.
   Farbe ist in beiden Formen nie der einzige Träger: Icon + Label sind immer
   dabei.
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
  erzeugtes Badge zeigt Default-Blau bzw. -Lila als **kräftige Vollfläche mit
  weißer Schrift** (kein heller Tint), je mit Icon + Label (Screenshot beider
  Badges); Kontrast Schrift/Hintergrund WCAG-AA.
- Farbänderung im Setting wirkt ohne Editor-Reload auf sichtbare Badges
  **und auf den Panel-Hintergrund** (P119-Navigations-Panel); nach
  Browser-Reload bleibt sie erhalten (Persistenz). „Zurücksetzen" stellt die
  Defaults wieder her.
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


## Result

- **delivered:** ADR-0011-Zwei-Wege-Farbcodierung in `resources/lib/editor-common.js`: CSS-Tokens `--webapp-path-wire-color`/`--webapp-path-ref-color`, `pathBadge(kind,label)` (HTMLElement, FA-Icon, Farbe nie alleiniger Traeger), `applyDualPathTokens`, Panel-Klassen, `installDualPathUserSettings` (RED.userSettings-Pane "Webapp"). Doku in `docs/nodes/concepts/editor.md`.
- **stats:** Impl-Merge da26015-Reihe + Aktivierungs-Fix b73949a; 5 dual-path-E2E gruen. Volle Suite auf gebautem develop **423 passed, exit=0, 0 failed**.
- **notes:** **Close-out-Korrektur (2026-06-10):** Erstes Schliessen war false-green (tail); die 5 E2E waren real rot, weil das Feature im echten Editor nicht aktivierte. Fix b73949a behob drei Editor-Defekte: `pathBadge` gab jQuery statt HTMLElement zurueck; der Registrierungs-Guard war pro-Aufruf (lief 37× ueber die Node-HTML-Skripte → Duplikat-Inputs); die Pane hatte nicht die `id`, die NR 4.x zum Einblenden braucht. Tokens/Badge bewusst wiederverwendbar fuer P119.
- **cost:** Impl session aa3afd4f (~5m) + Aktivierungs-Fix session a6047eb (~13m). Modell sonnet/opus.
