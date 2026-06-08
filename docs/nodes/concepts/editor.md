# Editor-Features

Diese Datei dokumentiert die **Editor-spezifischen** Hilfsfunktionen, mit denen
die Property-Panels der Webapp-Knoten im Node-RED-Editor aufgebaut werden —
Knoten-Auswahl, Bindings, Varianten, Layout-Felder.

> **Editor ≠ Runtime.** Das Property-Panel läuft in der **Node-RED-Admin-UI**
> (jQuery, kein Shoelace). Es ist eine andere Welt als die gerenderte App
> (Shoelace-Web-Components, siehe [theming.md](theming.md)). Editor-Dialoge sind
> daher admin-UI-kompatibel, nicht `<sl-dialog>`.

Alle hier beschriebenen Helfer leben in **einer** kanonischen Datei,
`resources/lib/editor-common.js`, exportiert als `window.WebappEditorCommon`. Jede
Node-HTML lädt sie über `resources/node-red-contrib-webapp/lib/editor-common.js`.
Es gibt bewusst keine Kopien unter `lib/` oder `nodes/lib/`.

---

## Knoten-Auswahl: der Node-Picker-Dialog (P68)

Wo immer ein anderer Webapp-Knoten ausgewählt werden muss (Parent, Route,
Action, Store, Mount-Ziel), steht derselbe **filter- und scrollbare
Auswahl-Dialog** zur Verfügung — statt eines nackten `<select>`.

**Verhalten:**
- Scrollbare Kandidatenliste; jede Zeile zeigt **Name + ID + Knotentyp**.
- **Contains-Suche** (case-insensitive) über Name, ID **und** Typ (`nodePickerMatch`).
- Aktuelle Auswahl hervorgehoben; Auswahl per Klick, Schließen per `Esc` oder Overlay-Klick.
- Gespeichert wird stets die **Knoten-ID** (Round-Trip unverändert).

**API:**
- `openNodePickerDialog({ title, value, entries, onSelect })` — öffnet den Dialog (CSS-Klassen `webapp-node-picker-*`).
- `enhanceSelectWithPicker(selector, { filterPreset, title })` — hängt neben ein bestehendes, an die ID gebundenes `<select>` einen „Auswählen…"-Button, der den Dialog mit dem passenden Preset öffnet und die Auswahl zurück ins `<select>` schreibt. So bleibt das `<select>` die Quelle der Wahrheit; per-Node-HTML muss nicht angefasst werden.

**Default-Filter (Presets).** Die Kandidatenliste wird pro Feld durch ein Preset
vorgefiltert (`nodePickerPresets`, gespeist aus `collectReferenceNodes`):

| Preset | Kandidaten |
|---|---|
| `apps` | alle `ui-app` |
| `routes` | alle `ui-route` |
| `actions` | alle `ui-action` / `ui-navigation` |
| `stores` | alle `ui-store` |

`collectReferenceNodes()` sammelt App-, Route-, Dialog-, Container-, Action- und
Store-Knoten aus dem aktuellen Editor-Graphen (inkl. id/typ/titel/parent/path),
indem es `RED.nodes.eachNode` durchläuft — die Auswahl basiert also auf dem
Modell, nicht auf Canvas-Wires.

---

## Referenz-Selektoren

Die folgenden Installer verdrahten die obigen Picker an die Standard-Felder eines
Panels (in `oneditprepare` aufrufen, an den Knoten gebunden):

- `installParentAppSelector()` — füllt `#node-input-parent` mit allen Apps (Preset `apps`).
- `installReferenceSelectors(config)` — je nach `config`-Flags:
  - `route: true` → `#node-input-routeId` (Preset `routes`)
  - `action: "<selector>"` → ein Action-Feld (Preset `actions`)
  - `store: true | "<selector>"` → ein Store-Feld (Preset `stores`)
  - `mount: true` → `#node-input-mount` als **Baum** (`setSelectOptionsTree`, Routen/Dialoge → Container → Slots); der Mount-Picker bleibt hierarchisch und nutzt nicht den flachen Listen-Dialog.
  - `layout: true` → `#node-input-layoutId`
- `installLayoutSelector(config)` — Preset-Auswahl (`getStandardLayoutPresetOptions`) für App/Route/Dialog/Container.

Alle gespeicherten Werte sind **IDs** (bzw. Mount-Strings `<type>:<id>/<slot>`).

---

## Bindbare Werte: die typedInput-Binding-Typen (P67)

Bindbare Felder (z. B. `ui-text` `value`, `ui-alert` `message`/`title`) nutzen
ein Node-RED-**typedInput**, dessen Typ-Auswahl die Binding-Art bestimmt. Der
gemeinsame Typsatz kommt aus `bindingTypedInputTypes({ literalLabel })`:

| typedInput-Typ | Label | Binding-`kind` | Wert |
|---|---|---|---|
| literal | konfigurierbar (z. B. „Text", „Message") | `literal` | der Wert selbst |
| state | „State" | `state` | State-Pfad |
| query | „Query" | `query` | Query-Pfad (mit Pfad-Validierung) |
| routeParam | „Route Param" | `routeParam` | Name des Routen-/Seiten-Parameters der aktuellen Route |
| **store** | „Store" | `store` | **referenzierter `ui-store` (per Picker gewählt)** |
| msg / flow / global / jsonata / env | (Node-RED-Standard) | `msg`/`flow`/`global`/`jsonata`/`env` | je nach Quelle |

> „Page-Param" entspricht dem Typ **„Route Param"** (`routeParam`): er liest einen
> Parameter aus dem Pfad der aktuell angezeigten Route.

Der **Store-Typ** (`storeTypedInputType`) ist eine Sonderform: sein Expand-Button
öffnet **denselben** Node-Picker-Dialog (Preset `stores`) — kein zweiter Picker.
Gespeichert wird die Store-ID; zur Laufzeit löst der Renderer sie über den
`statePath` des Stores auf (Details und Begründung in [stores.md](stores.md)).

**Serialisierung.** `bindingValueForEditor(binding)` füllt das typedInput aus
einem `{ kind, path/value }`-Binding-Objekt; beim Speichern baut das Panel das
Objekt wieder zusammen. Wichtig: Das typedInput-Element und das Feld, das das
**Binding-Objekt** persistiert, sind getrennt (Muster von `ui-text` — sonst
überschreibt die Node-RED-Defaults-Auto-Übernahme das Objekt mit dem rohen
typedInput-Wert).

---

## Komponenten-Varianten: die Variant-SelectBox (P50)

`installVariantSelectBox(kind)` rendert eine Auswahlliste für das `variant`-Feld,
gespeist **direkt aus dem Schema-Vokabular** (`COMPONENT_VARIANT_VOCABULARY` in
`packages/schema`). Damit bleiben Editor-Auswahl und Contract synchron — die Liste
ist nie im Editor hartcodiert. Welche Knoten welches Vokabular tragen (und die
Abgrenzung `variant` vs. `displayType`): [theming.md](theming.md).

---

## Layout-Felder

- `installLayoutSelector(config)` — Standard-Preset-Auswahl (`horizontal`, `vertical`, `app`, `grid`, `absolute`, `dialog`).
- `installLayoutChildPropRows()` — blendet je nach Parent-Layout die passenden **Child-Platzierungs-Felder** ein (Grid: `row`/`col`/`colSize`/`rowSize`; Absolute: `layoutX`/`layoutY`; Horizontal/Vertical: `order`). Wertebereiche und Validierung: [layout.md](layout.md).

---

## Konfigurierbare Events und dynamische Output-Ports (P12)

`registerNodeTypeWithEvents(type, definition, availableEvents)` umhüllt die
Knoten-Registrierung so, dass `installEventCheckboxes` im Panel eine Checkbox pro
verfügbarem Event rendert. Beim Speichern wird die Liste der aktiven Events nach
`#node-input-events` geschrieben und die **Anzahl der Output-Ports** (`outputs`)
entsprechend gesetzt — die Port-Anzahl folgt also der Event-Konfiguration.

---

## Canvas-Knoten-Picker (P60, ADR 0007 §3)

`installNodePicker(options)` ist ein **anderes Paradigma** als der Listen-Dialog:
Es nutzt Node-REDs `RED.view.selectNodes()` — dieselbe Canvas-Auswahl-API wie die
Core-Knoten `catch`/`status`/`complete`. Der Anwender pickt Zielknoten **direkt
auf der Canvas**; eine **Liste** von Knoten-IDs wird als JSON-Array in einem
Hidden-Input gehalten und als entfernbare Chips dargestellt.

Genutzt von `ui-action` für den optionalen „drahtlosen" Mehrfach-Ziel-Pfad
(`targets`); das Verdrahten des Output-Ports bleibt der primäre Weg. Per Default
sind nur interaktionsfähige `ui-*`-Knoten wählbar (nicht `ui-action`/
`ui-navigation` selbst).

| | Listen-Dialog (P68) | Canvas-Picker (P60) |
|---|---|---|
| Auswahl | aus einer gefilterten Liste | durch Anklicken auf der Canvas |
| Anzahl | ein Wert | Mehrfachauswahl (Liste) |
| Gespeichert in | gebundenes `<select>` (eine ID) | Hidden-Input (JSON-Array von IDs) |
| Typischer Einsatz | parent, route, action, store, mount | `ui-action` `targets` |

---

## Weitere gemeinsame Helfer

- `registerNodeType(type, definition)` — Registrierung inkl. uiId-Migrations-Shim.
- `labelWithName(fallback)` / `getNextNameDefault(type, prefix)` — Anzeigename und fortlaufende Default-Namen.
- `injectFieldGroup(spec)` / `buildFieldRowMarkup(field)` — programmatisches Einfügen von Feld-Zeilen (genutzt u. a. von der Variant-SelectBox und den Layout-Child-Props).

---

## Siehe auch

- [stores.md](stores.md) — Semantik des `store`-Bindings (Auflösung, Robustheit)
- [layout.md](layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](theming.md) — Variant-Vokabular (Quelle der Variant-SelectBox)
- [actions.md](actions.md) — `ui-action`-Ziele (Out-Port vs. Canvas-Picker `targets`)
