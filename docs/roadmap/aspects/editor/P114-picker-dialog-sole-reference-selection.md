---
id: P114
title: "Picker-Dialog als EINZIGE Auswahl für alle Referenzfelder (parent, route, action, store, mount) + mounts-Preset"
epic: aspects/editor
status: in_progress
dependencies: []
---
# P114 — Picker-Dialog als einzige Referenzauswahl

> Rationale & Entscheidung: [ADR 0009](../../../adr/0009-picker-dialog-as-sole-reference-selection.md).
> Zielzustand bereits dokumentiert in `docs/nodes/concepts/editor.md` (Abschnitte
> „Knoten-Auswahl" + „Referenz-Selektoren") — die Implementierung zieht den Code
> auf diesen Stand.

## findings (Nutzer-Wortlaut, 2026-06-10)

- "Die meisten Knoten nutzen parent slot. Das wird schnell eine lange Liste in
  der SelectBox, die da genutzt wird. Wir haben dafür schon einen Dialog, glaube
  ich. Wir sollten gleich diesen Dialog benutzen. Immer. Und daher überall
  einbauen."
- Klärung (Owner-Antworten): **Dialog als einzige Auswahl** — die lange SelectBox
  verschwindet; das Feld zeigt nur die aktuelle Auswahl (read-only, bei Mounts
  als Breadcrumb) plus Button „Auswählen…". Und: **dasselbe Muster für alle
  Referenz-Selects** (App, Route, Action, Store), nicht nur Parent-Slot.

## Befund (heute)

- `resources/lib/editor-common.js`: App/Route/Action/Store-Felder sind voll
  befüllte `<select>`s mit Dialog-Button daneben (`enhanceSelectWithPicker`,
  P68). Das Dropdown bleibt die primäre UI.
- `#node-input-mount` ist die Ausnahme ohne jede Dialog-Anbindung:
  `setSelectOptionsTree` + `buildMountOptionsTree` bauen ein langes `<select>`
  mit `<optgroup>`s. Ein `mounts`-Preset für `openNodePickerDialog` existiert
  nicht. `buildMountOptions` (flache Variante) ist toter Code.
- Alle Panels laufen über die zentralen Installer (`installParentAppSelector`,
  `installReferenceSelectors`) — die Umstellung landet einmal zentral, kein
  per-Node-HTML-Umbau für die Standardfelder.

## Zielmodell

**Ein Muster für jedes Referenzfeld** (parent, routeId, action, store, mount):

1. Das gebundene `#node-input-*`-Element bleibt als **verstecktes Wertefeld**
   im DOM (Node-RED-Defaults-Bindung, `change`-Events, Validierung, Save-Pfad
   unverändert).
2. Sichtbar sind nur: **read-only-Anzeige** der aktuellen Auswahl
   (menschenlesbares Label; bei Mounts der volle Breadcrumb, z. B.
   `Shop > /customers > content`; Platzhalter wenn leer) + Button
   **„Auswählen…"**, der `openNodePickerDialog` mit dem Feld-Preset öffnet.
3. Neuer zentraler Helfer (Vorschlag `installPickerField(selector, { filterPreset,
   title, placeholder, clearable })`) ersetzt `enhanceSelectWithPicker`;
   `installParentAppSelector` / `installReferenceSelectors` rufen nur noch ihn.
4. **Neues Preset `mounts`:** `buildMountOptionsTree(references)` wird flach
   gemacht; jeder Eintrag trägt das Breadcrumb-Label + den Mount-Wert. Suche
   matcht Breadcrumb **und** Mount-Wert. Gruppen-Header braucht der Dialog
   nicht — der Breadcrumb trägt die Hierarchie.
5. **Optionale Felder** (routeId „Optional: …", store „Optional: …") sind über
   ein „×" leerbar (schreibt `""` + `change`).
6. **Nicht auflösbarer Bestandswert** (z. B. gelöschter Knoten): Wert bleibt
   erhalten, Anzeige `<wert> (bestehend)` — wie heute im Select-Fallback.
7. **Mount-`change` bleibt das Signal** für `installLayoutChildPropRows`
   (Grid/Absolute/Order-Felder folgen dem Layout des neuen Parents) und für die
   Sichtbarkeit der Platzierungszeilen — Auswahl im Dialog schreibt den Wert
   ins versteckte Feld und feuert `change`.
8. **Aufräumen:** `setSelectOptionsTree` verliert seine UI-Rolle (entfernen oder
   auf die Preset-Erzeugung reduzieren); ungenutztes `buildMountOptions` (flach)
   entfernen. `buildMountOptionsTree` bleibt als Datenquelle des Presets.

**Out of Scope:** `installLayoutSelector` (Layout-Preset, kleine feste Liste —
kein Referenzfeld), der Canvas-Picker (P60, anderes Paradigma), der Icon-Picker
(P69) und der Media-Picker (P70). Der Store-typedInput (P67) nutzt den Dialog
bereits über seinen Expand-Button — unverändert.

## acceptance (observierbar, browser)

- **Mount:** Im Panel eines View-Knotens (z. B. ui-text) gibt es **kein**
  aufklappbares Parent-Slot-Dropdown mehr; sichtbar sind read-only-Anzeige
  (Breadcrumb der aktuellen Auswahl bzw. Platzhalter „Parent-Slot auswählen")
  und der Button „Auswählen…".
- **Dialog:** Klick auf „Auswählen…" öffnet den P68-Dialog mit allen
  Parent-Slots als Breadcrumb-Zeilen; Suche (z. B. „customers") filtert die
  Liste; Klick auf einen Eintrag übernimmt den Mount-Wert, der Dialog schließt,
  die Anzeige zeigt den neuen Breadcrumb.
- **Layout-Folge:** Nach Auswahl eines Grid-Parents im Dialog erscheinen die
  Grid-Platzierungsfelder (`row`/`col`/…); nach Wechsel auf einen
  Horizontal-Parent erscheint stattdessen `order` (Verhalten von
  `installLayoutChildPropRows` unverändert).
- **Alle Referenzfelder:** parent (z. B. ui-route), routeId, Action-Felder,
  Store-Felder zeigen dasselbe Anzeige+Button-Muster; nirgendwo im Panel
  existiert noch ein sichtbares, voll befülltes Referenz-`<select>`.
- **Optional/leeren:** routeId/Store lassen sich per „×" leeren; gespeichert
  wird `""`; die Anzeige fällt auf den Platzhalter zurück.
- **Bestandswert:** Ein gespeicherter, im Graphen nicht auflösbarer Wert wird
  als `<wert> (bestehend)` angezeigt und überlebt Öffnen+Speichern unverändert.
- **Round-Trip:** Gespeicherte Werte/Formate unverändert (IDs bzw.
  `<type>:<id>/<slot>`); Deploy der customers-crud-Beispiel-App und die
  bestehende E2E-Suite bleiben grün.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` (bereits auf den Zielzustand gehoben —
  Implementierung muss exakt dem dort beschriebenen Muster entsprechen; bei
  Abweichungen im Detail die Docs nachziehen, nicht stillschweigend abweichen).
- tests: Querschnitts-E2E unter `tests/e2e/nodes/editor/node-picker.spec.ts`
  (Dialog-Muster auf allen Feldtypen inkl. `mounts`-Preset, Suche, Auswahl,
  Leeren, Bestandswert) — **umschreiben**, nicht ergänzen. Ebenfalls anpassen,
  da sie das alte Dropdown öffnen: `tests/e2e/editor-mount-options.spec.ts`,
  `tests/e2e/parent-selector.spec.ts`, ggf.
  `tests/e2e/nodes/editor/placement-rows.spec.ts` (Mount-Wechsel jetzt über den
  Dialog). Unit-Anteil: Preset-Erzeugung `mounts` (Flatten + Labels) testbar
  ohne Browser.

## Risiken / Hinweise

- Die E2E-Helfer/Specs, die heute `selectOption` auf den nativen Selects nutzen,
  brauchen einen gemeinsamen Test-Helper „wähle Referenz über den Dialog"
  (einmal schreiben, überall verwenden).
- Node-HTML-Templates, die das `<select>`-Markup für diese Felder enthalten,
  dürfen weiter ein `<select>`/`<input>` als Wertefeld liefern — der Helfer
  versteckt es und rendert Anzeige+Button daneben; kein Massen-Edit der
  Templates nötig, sofern die Installer zentral greifen.

