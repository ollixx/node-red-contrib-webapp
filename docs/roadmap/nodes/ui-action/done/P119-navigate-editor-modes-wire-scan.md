---
id: P119
node: ui-action
epic: nodes/ui-action
title: "ui-action/ui-navigation-Editor: Zielquellen-Umschalter mit Zwei-Wege-Badges, transitiver Wire-Scan (Assistenz), Parameter-Mapping-Tabelle mit typedInput-Werten"
findings:
  - "Das Label trägt die Semantik nicht: ‚Parameter' sagt nirgends, dass die :platzhalter der ZIEL-Route gefüllt werden. (Anm.: Verständnis-Finding aus dem Review)"
  - "Wireless: Nach der Auswahl eines Zielknotens kennt man ja die möglichen Parameter und muss die nicht selbst eingeben, sondern nur Werte mappen. Auch da müssten die Werte mit den üblichen Types erzeugt werden."
  - "Direkte Eingabe einer URL: Da müsste man die üblichen Types erlauben, um die Werte dynamisch in die URL zu packen, bzw. die URL zusammenzubauen mit JSONata etc."
  - "Was ist, wenn die wires nicht direkt zu ui-route gehen, sondern noch Knoten dazwischenliegen? Ich habe das in node-red-contrib-components schon realisiert und einen Wire-Scan gebaut. Das geht schon, ist aber auch tricky bei Verzweigungen auf dem Weg."
  - "Wie würde man die UX initial abbilden? Zum Beispiel, wenn der Knoten mit einer ui-route verlinkt ist, aber der User doch den anderen Weg gehen will?"
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
dependencies: [P118, P120]
status: done
---
# P119 — Navigate-Editor: Modus-UI, Wire-Scan, Mapping-Tabelle

> Entscheidung & Begründung: [ADR 0011](../../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md).
> Unterbau (Schema/Runtime/Migration): **P118** (vorausgesetzt). Zwei-Wege-
> Farbtokens + Badge-Helfer: **P120** (vorausgesetzt). Referenz-Picker:
> P68/P114-Infrastruktur, app-gescoped nach P117.

## Zielmodell

Alles Zentrale in `resources/lib/editor-common.js` (wiederverwendbar — die
Modus-UI wird perspektivisch auch andere Zwei-Wege-Felder tragen), die
Verdrahtung in `nodes/behavior/ui-action.html` und `ui-navigation.html`.

### 1. Zielquellen-Umschalter

Bei Verb `navigate` zeigt das Panel die Gruppe „Ziel" mit drei Modi als
**Segment-Switch**: **via Wire** · **Route** · **URL**. Jedes Segment trägt
**Icon + Label** (Stecker / Kette / Globus); das aktive Segment ist
hervorgehoben (siehe Skizze 1 zu ADR 0011). Es ist immer genau EIN Modus
aktiv; die Felder der anderen Modi sind ausgeblendet (nicht nur disabled) und
werden beim Speichern nicht serialisiert (P118-Exklusivität).

**Kosmetik (ADR 0011 §4, Owner 2026-06-10):** Da das Icon bereits im Switch
steckt, gibt es **kein zusätzliches Pill-Badge** und keine Wiederholung des
Modusnamens — nur eine **schlichte Überschrift**. Stattdessen nimmt der
**Hintergrund dieses Panels** (und nur dieses Navigations-Panels) die
**Modus-Farbe** an (blau/lila/neutral, kräftige Vollfläche; Formfelder sitzen
als helle Insets darauf), sodass der aktive Weg unübersehbar ist. Die
Modus-Farbe kommt aus den P120-Tokens. Das kompakte `pathBadge` (P120) bleibt
für Kontexte ohne färbbares Panel (z. B. Struktur-Sidebar) reserviert.

**Initiale Vorbelegung (nur wenn `targetMode` noch nie gespeichert):**
Wire-Scan findet ≥1 Route → `wire` vorausgewählt; sonst `route`. Ab dem
ersten Speichern gilt ausschließlich die gespeicherte Absicht — spätere
Wire-Änderungen schalten den Modus NICHT um (kein UI-Flackern durch
Canvas-Umbau). Wechselt der User den Modus trotz vorhandener Wires, zeigt
das Panel eine neutrale Info („Wire zu /x vorhanden — dient als Transport,
Ziel bleibt /y"), keinen Fehler.

### 2. Transitiver Wire-Scan (Assistenz, niemals Validierung)

Neuer Helfer (Vorschlag `scanWiredNavigationTargets(nodeId)`):

- BFS über ausgehende Wires (`RED.nodes.eachLink`/`filterLinks`) ab dem
  editierten Knoten, über Zwischenknoten hinweg; Zyklus-Schutz (Visited-Set),
  Tiefenlimit (~50 Knoten); sammelt erreichte `ui-route`/`ui-app`.
  Link-Nodes/Subflows: nicht verfolgen — dokumentierte Limitation
  (Hinweistext „Ziele hinter Link-Nodes werden nicht erkannt").
- Ergebnis ist eine **Menge**: genau 1 Treffer → Badge „via Wire →
  `<path>`" + Mapping-Tabelle aus dessen Platzhaltern. Mehrere → Badge
  „via Wire → n mögliche Ziele" + Platzhalter **pro Ziel** gruppiert
  (Verzweigung = bedingte Navigation, legitim) + Hinweis, dass die
  Versorgung aller Zweige Laufzeitverantwortung ist
  (`msg.ui.action.params`). Keine → freie Parameter-Liste wie bisher +
  Hinweis. **In keinem Fall ein Validierungsfehler aus dem Scan** (er ist
  heuristisch; Owner-Entscheid: unsinnige Verdrahtung ist
  Nutzer-Verantwortung).

### 3. Modus „Route (Referenz)"

- Routen-Auswahl über das P114-Picker-Feld (Preset `routes`, app-gescoped).
- Darunter die **Parameter-Mapping-Tabelle**: linke Spalte fix die
  `:platzhalter` der gewählten Route (aus deren `path` geparst, NICHT
  editierbar), rechte Spalte je ein typedInput
  (`str | msg | jsonata | flow | global | env`) für den Wert.
  Routen-Wechsel baut die Tabelle neu auf (vorhandene Werte gleichnamiger
  Platzhalter bleiben erhalten).
- **Validierung (hart, weil hier nichts heuristisch ist):** Platzhalter ohne
  Wert → Knoten ungültig vor Deploy; gelöschte/unbekannte `routeId` →
  ungültig.
- Beschriftung trägt die Richtung: „Parameter der Ziel-Route" (das
  ursprüngliche Verständnis-Finding).

### 4. Modus „URL"

`to`-typedInput wie heute (`str | msg | flow | global | jsonata`) — die URL
wird komplett gebaut, es gibt KEINE Parameter-Sektion in diesem Modus.
Hinweiszeile: bei `str` mit `:platzhaltern` ohne Werte ist das vermutlich ein
Fehler → sanfte Warnung (keine Blockade; dynamische Typen sind nicht statisch
prüfbar).

### 5. ui-navigation angleichen

`ui-navigation` bekommt denselben Umschalter/dieselben Helfer (sein
bestehendes `routeId`-Feld wird der `route`-Modus). Keine zweite
Implementierung — gleiche zentrale Funktionen.

## acceptance (observierbar, browser)

- **Initial:** Neue, mit einer `ui-route` (über einen function-Knoten
  dazwischen!) verdrahtete Action öffnet mit Modus „via Wire", blauem Badge
  und „via Wire → `/customers/:id`"; die Mapping-Tabelle zeigt `id` fix als
  Zeile.
- **Verzweigung:** Action → switch → zwei Routen: Badge „via Wire → 2
  mögliche Ziele", Platzhalter pro Ziel gruppiert, Laufzeit-Hinweis sichtbar,
  KEIN Validierungsfehler.
- **Modus-Wechsel:** Umschalten auf „Route (Referenz)" bei bestehendem Wire:
  lila Badge, Routen-Picker; Info „Wire vorhanden — dient als Transport"
  erscheint; nach Speichern + Wiederöffnen bleibt Modus `route` (kein
  Zurückspringen trotz Wire).
- **Mapping-Tabelle:** Route `/customers/:id` gewählt → Zeile `id` fix,
  typedInput-Wert `msg payload.id` konfigurierbar; leerer Wert → Knoten rot,
  Deploy blockiert; Routen-Wechsel auf `/orders/:id/:tab` → Zeilen `id`
  (Wert erhalten) und `tab` (leer, rot bis gefüllt).
- **URL-Modus:** Keine Parameter-Sektion sichtbar; jsonata-`to` konfigurierbar;
  `str`-Pfad mit `:id` ohne Wert zeigt die sanfte Warnung.
- **Ende-zu-Ende:** Der P118-Route-Modus-Fall komplett über den Editor gebaut
  (nicht per Fixture): Tabelle klick-konfiguriert, Deploy, Browser navigiert
  auf `/customers/42` aus `msg.payload.id`.
- **ui-navigation:** zeigt denselben Umschalter; sein Route-Modus nutzt das
  gescopte Picker-Feld.
- **Editor-Screenshots** für: Wire-Badge (blau), Referenz-Badge (lila),
  Mapping-Tabelle, Verzweigungs-Ansicht.

## spec / tests — Pflichten

- Spec-Updates wie in P118 benannt (Felder/Verhalten sind nach diesem Paket
  vollständig); zusätzlich `docs/nodes/concepts/editor.md` um den
  Zielquellen-Umschalter + Wire-Scan-Assistenz ergänzen.
- Testkatalog `tests/e2e/nodes/behavior/ui-action.tests.md` (neu anlegen,
  Format per `.ai/agents/node-testing.md`) + ui-navigation-Katalog; bestehende
  Navigation-Specs (`p66-navigation.spec.ts`, `ui-navigation.spec.ts`,
  `navigation-nodes.spec.ts`) auf das Modus-Modell umschreiben statt ergänzen.

## Result

- **delivered:** ADR-0011 Navigate-Action-Editor-UX. Zentrale, wiederverwendbare `installNavigateTargetMode()` in `resources/lib/editor-common.js` (Drei-Segment-Switch wire|route|url, faerbt das ganze Panel ueber P120-Tokens), transitiver `scanWiredNavigationTargets()` (BFS-Wire-Scan, reine Assistenz, Link-Nodes/Subflows uebersprungen), `parseRoutePlaceholders()`, `validateNavigateConfig()` (route-Modus hart: aufloesbare routeId + jeder `:placeholder` gefuellt; wire/url blocken nie). In `ui-action.html` UND `ui-navigation.html` verdrahtet (eine Helper, keine Zweitimpl); route-Modus nutzt den P114-Picker (routes-Preset, app-scoped) + typedInput-Mapping-Tabelle. `ui-navigation`-Schema `to` optional gemacht.
- **stats:** 13 Dateien (3 editor/src, 1 schema, 1 runtime, 5 tests/Kataloge, 3 Spec-Docs); neue `navigate-target-modes.spec.ts` (+10 E2E). Unit: schema 251, renderer 55, editor 20, runtime 871. **Maßgebliche volle E2E auf gebautem develop: 432 passed, exit=0, 0 failed.**
- **notes:** `ui-navigation`-Runtime bleibt url-only (P118-Kontrakt) — der route-Modus-Switcher ist editor-only laut acceptance, kein Runtime-Scope-Creep. Schema-Relaxation (`to` optional) ist vorwaerts-kompatibel. P47 `behavior-state.spec.ts` auf das Modus-Modell aktualisiert (Legacy-`to` → URL-Modus).
- **cost:** session sess-p119, ~62m, Modell opus.
