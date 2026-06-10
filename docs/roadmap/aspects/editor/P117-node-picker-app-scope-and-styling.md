---
id: P117
title: "Node-Picker-Dialog: Kandidaten auf die App des editierten Knotens scopen + Erscheinungsbild an die Node-RED-Admin-Dialoge angleichen"
epic: aspects/editor
status: in_progress
dependencies: [P114]
---
# P117 — Node-Picker: App-Scope + Admin-UI-Look

> Betroffen ist der vereinheitlichte P68-Picker-Dialog (`openNodePickerDialog`
> in `resources/lib/editor-common.js`), der mit [ADR 0009](../../../adr/0009-picker-dialog-as-sole-reference-selection.md)
> / **P114** zur EINZIGEN Referenzauswahl wird — Mängel in diesem Dialog
> skalieren damit auf jedes Referenzfeld jedes Knotens. Deshalb hängt dieses
> Paket auf P114 (gleiche Code-Stellen, P114 läuft zuerst).

## findings (Nutzer-Wortlaut, 2026-06-10)

- "Der Dialog in ui-route ‚Store für Titel auswählen' zeigt Stores mehrerer
  Apps an. Das sollte gefiltert sein auf die Stores nur in der App des
  Knotens."
- "Außerdem sieht diese Dialogbox echt nicht schön aus. Unschöne Serifenschrift
  und alles extrem basic. Das sollten wir mal ein wenig aufhübschen, so dass es
  aussieht wie alle Dialoge von NR admin gui sonst auch."

## Befund (heute) — für den umsetzenden Agenten

Beide Symptome sind in `resources/lib/editor-common.js` lokalisiert:

1. **Kein App-Kontext in der Kandidatensammlung.**
   `nodePickerOptionsForPreset(preset)` (ca. Zeile 560) ruft
   `collectReferenceNodes()` ohne jeden Kontext; `collectReferenceNodes`
   (ca. Zeile 397) sammelt für `stores` nur `{ id, name, statePath }` und für
   `actions` nur `{ id, label, type, to }` — **das `parent`-Feld (die App) wird
   gar nicht erst erhoben**, obwohl die Knotentypen es alle tragen
   (`ui-store`, `ui-action`, `ui-navigation`, `ui-query`, `ui-route`,
   `ui-dialog`, `ui-toast` haben sämtlich `parent` in ihren defaults).
   Filterung ist damit strukturell unmöglich; jeder Picker zeigt die Knoten
   ALLER Apps.
2. **Dialog-Optik:** `openNodePickerDialog` (ca. Zeile 570) baut den Dialog
   per jQuery mit Inline-`css({...})` und hängt ihn an `$("body")`. Es wird
   **nirgends eine `font-family` gesetzt** — außerhalb des
   Node-RED-Editor-Font-Scopes erbt der Dialog die Browser-Default-Schrift
   (Serife). Suchfeld ist ein nacktes `<input>`, Zeilen sind handgestylte
   `<div>`s, Farben nutzen zwar `--red-ui-*`-Variablen mit Fallbacks, aber
   Typografie, Abstände, Suchfeld und Buttons entsprechen nicht den
   Admin-UI-Dialogen.
3. **Hebelwirkung:** Der Icon-Picker (P69) und der Media-Picker (P70)
   **teilen dieselben CSS-Klassen** (`webapp-icon-picker-dialog
   webapp-node-picker-dialog`, ca. Zeilen 1615/1803) — die Aufhübschung wirkt
   automatisch auf alle drei Dialoge. Beim Umbau nichts tun, was die beiden
   anderen Dialoge bricht.

## Zielmodell

### Teil A — App-Scope der Kandidaten

1. **`parent` miterheben:** `collectReferenceNodes()` nimmt für `stores` und
   `actions` (und überall sonst, wo der Knotentyp ein `parent` trägt) das
   `parent`-Feld in den Eintrag auf. (`routes`/`dialogs` haben es bereits.)
2. **App-Kontext des editierten Knotens bestimmen** — neuer Helfer (Vorschlag
   `resolveEditedNodeApp(node, references)`):
   - Hat der editierte Knoten ein `parent`, das eine bekannte `ui-app` ist
     (Fall ui-route, ui-store, ui-action, …): das ist die App.
   - Sonst, hat er einen `mount`: die Mount-Kette nach oben laufen
     (Container → … → `route:`/`dialog:`/App-Slot) bis zur App. Die
     Kettenlogik existiert sinngemäß in `getMountLayoutId` /
     `buildMountOptionsTree` — wiederverwenden/extrahieren, nicht
     duplizieren.
   - Im Editor-Panel gilt der **aktuell im Panel gewählte** Wert (das
     versteckte `#node-input-parent`/`#node-input-mount`-Feld), nicht der
     zuletzt deployte — wer im selben Dialog die App wechselt, bekommt sofort
     die richtigen Kandidaten.
3. **Preset-Aufruf bekommt Kontext:** `nodePickerOptionsForPreset(preset,
   { appId })`; die Preset-Funktionen filtern ihre Kandidaten auf
   `entry.parent === appId` (Presets `stores`, `actions`, `routes`;
   das `mounts`-Preset aus P114 ebenso — nur Slots der eigenen App). Das
   `apps`-Preset bleibt naturgemäß ungefiltert.
4. **Fallback ohne bestimmbare App** (z. B. neuer Knoten, noch kein
   parent/mount gesetzt): ungefiltert wie heute, aber jede Zeile zeigt
   zusätzlich die App (Titel der `ui-app`) in der Sekundärzeile, damit die
   Herkunft erkennbar ist.
5. **Aufrufstellen durchreichen:** `installPickerField` /
   `installParentAppSelector` / `installReferenceSelectors` (Stand nach P114)
   und `storeTypedInputType` (der „Store für Titel auswählen"-Fall aus dem
   Finding — ui-route-Panel, dort ist die App schlicht
   `$("#node-input-parent").val()`) übergeben den Kontext.

### Teil B — Erscheinungsbild wie die übrigen Admin-UI-Dialoge

Maßstab ist: „sieht aus wie alle Dialoge der NR-Admin-GUI sonst auch" —
konkret wie Node-REDs eigene Dialoge/Trays (z. B. der typedInput-Expression-
Editor, die Palette-Verwaltung): Sans-Serif-Editor-Schrift, klare Kopfzeile,
Standard-Suchfeld, Listenzeilen mit Hover/Selected im Editor-Stil,
`red-ui-button`-Buttons.

1. **Gemeinsames Stylesheet statt Inline-`css({...})`:** Die
   `webapp-node-picker-*`-Klassen bekommen ein einmal injiziertes
   `<style>`-Blatt (idempotent, analog zum Vorgehen anderer zentraler Helfer);
   die Inline-Styles in `openNodePickerDialog` werden bis auf
   Positionierungs-Notwendigkeiten entfernt. Damit erben Icon- und
   Media-Picker die Optik automatisch.
2. **Typografie:** Der Dialog setzt explizit die Editor-Schrift
   (`var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif)` bzw. die
   von Node-RED am `#red-ui-editor` verwendete Font-Stack-Variable — beim
   Umsetzen die tatsächliche Variable im laufenden Editor verifizieren).
   **Nirgends** darf mehr eine Serifenschrift erscheinen — auch nicht im
   Leere-Treffer-Text oder den Sekundärzeilen.
3. **Kopfzeile** im Stil der NR-Dialog-Header (Hintergrund/Trennlinie über
   `--red-ui-*`-Variablen, Titel nicht fett-auf-default, sondern wie
   NR-Dialogtitel) inkl. Schließen-Affordanz (das bestehende Esc/Overlay-
   Schließen bleibt).
4. **Suchfeld** im Stil der Node-RED-Suchboxen (Lupe-Icon, volle Breite,
   Fokus-Stil des Editors) — wenn praktikabel die `red-ui-searchBox`-Mechanik
   nutzen, sonst optisch angleichen.
5. **Listenzeilen:** Hover-/Selected-Zustände über die `--red-ui-list-*`-
   Variablen via CSS-Klassen (`:hover`, `.selected`) statt
   mouseenter/mouseleave-Inline-Manipulation; Primärzeile (Name) +
   Sekundärzeile (ID · Typ · ggf. App) in Editor-Typo-Größen.
6. **Footer-Buttons** als `red-ui-button` (Abbrechen) — vorhandene Semantik
   (Klick auf Zeile wählt direkt) unverändert.
7. **Dark-Theme-Tauglichkeit:** ausschließlich `--red-ui-*`-Variablen mit
   Fallbacks (keine neuen Hardcodes wie `#999`/`#888` — die bestehenden
   ersetzen), sodass ein Node-RED-Theme den Dialog mitfärbt.

## Explizit OUT of scope

- Verhalten/API des Dialogs (Suche, Auswahl, Presets-Mechanik) — nur Scope +
  Optik. Die P114-Umbauten (Anzeige+Button-Muster, `mounts`-Preset) werden
  vorausgesetzt und nicht erneut angefasst.
- Icon-/Media-Picker-Funktionalität (P69/P70) — sie erben nur die Optik über
  die geteilten Klassen; ihre Spezial-UI (Icon-Grid, Upload) bleibt unberührt.
- Der Canvas-Picker (P60) — anderes Paradigma, kein Dialog.

## acceptance (observierbar, browser)

- **Scope (das Finding):** Flow mit zwei Apps, je ein `ui-store` („storeA" in
  App A, „storeB" in App B). Im Panel einer `ui-route` mit `parent` = App A
  öffnet „Store für Titel auswählen" den Picker: **nur** „storeA" wird
  angeboten; „storeB" erscheint auch bei leerer Suche nicht.
- **Scope folgt dem Panel-Stand:** Wechselt man im selben (noch offenen)
  ui-route-Panel die App auf App B und öffnet den Picker erneut, wird nur noch
  „storeB" angeboten — ohne Deploy dazwischen.
- **Scope auf allen Presets:** Dasselbe gilt sinngemäß für Action-, Routen-
  und (nach P114) Mount-Kandidaten eines Knotens mit bestimmbarer App.
- **Fallback:** Ein Knoten ohne gesetztes parent/mount zeigt weiterhin alle
  Kandidaten, jede Zeile nennt dabei die App in der Sekundärzeile.
- **Optik (Screenshot-Belege):** Der geöffnete Picker zeigt durchgehend die
  Editor-Sans-Serif-Schrift (computed `font-family` der Dialogwurzel,
  Zeilen, Suchfeld und Leere-Treffer-Text enthält keine Serife/`serif`);
  Kopfzeile, Suchfeld, Zeilen-Hover/-Selected und Footer-Button entsprechen
  dem Stil der übrigen Node-RED-Dialoge (Vergleichs-Screenshot daneben, z. B.
  der typedInput-Expression-Editor).
- **Geteilte Optik:** Icon-Picker (ui-alert „Icon auswählen") und Media-Picker
  (ui-image) zeigen nach dem Umbau dieselbe Typografie/Kopfzeile und sind
  funktional unverändert (je ein Smoke-Durchklick).
- **Keine Hardcode-Reste:** Im Dialog-Code/Stylesheet existieren keine neuen
  Hex-Farben; die bestehenden `#999`/`#888`-Grautöne der Zeilen sind durch
  `--red-ui-*`-Variablen (mit Fallback) ersetzt.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md`, Abschnitt „Knoten-Auswahl" — wird in
  diesem Commit um die zwei Regeln ergänzt (App-Scope der Kandidaten;
  Admin-UI-konforme Optik). Implementierung muss dem entsprechen; bewusste
  Detail-Abweichungen dort nachziehen.
- tests: `tests/e2e/nodes/editor/node-picker.spec.ts` (nach P114-Umbau) um die
  Scope-Fälle erweitern: Zwei-Apps-Fixture, Store-Picker zeigt nur die eigene
  App; Fallback-Fall ohne App-Kontext. Optik-Acceptance per
  Playwright-Assertion auf computed `font-family` (enthält nicht `serif` als
  effektiven Fallback bzw. entspricht der des `#red-ui-editor`) +
  Screenshot. Unit-Anteil: `resolveEditedNodeApp` (parent-Fall,
  Mount-Ketten-Fall, unbestimmbar-Fall) als reine Funktion gegen ein
  References-Fixture.

## Risiken / Hinweise

- **Reihenfolge:** P114 baut denselben Dialog-Code um (Anzeige+Button-Muster,
  `mounts`-Preset). Dieses Paket erst nach P114-Merge beginnen (dependency),
  sonst Merge-Konflikte in `editor-common.js`.
- Die geteilten Klassen mit Icon-/Media-Picker sind Hebel UND Risiko: Vor dem
  Abschluss beide Dialoge einmal öffnen (Smoke), damit kein Regressions-Bruch
  durch das neue Stylesheet entsteht.
- `ui-query` trägt ebenfalls `parent` — falls es ein Query-Preset gibt oder
  bekommt, gleich mitscopen; heute existiert keines (nicht erfinden).

