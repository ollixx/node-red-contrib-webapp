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

## Knoten-Auswahl: der Node-Picker-Dialog (P68, ADR 0009)

Wo immer ein anderer Webapp-Knoten ausgewählt werden muss (Parent, Route,
Action, Store, Parent-Slot/Mount), ist derselbe **filter- und scrollbare
Auswahl-Dialog** der **einzige** Auswahlmechanismus (ADR 0009). Es gibt keine
voll befüllten Dropdowns mehr — Referenzlisten wachsen mit dem Flow und sind
als natives `<select>` weder durchsuch- noch lesbar.

**Darstellung im Panel (ein Muster für alle Referenzfelder):**
- eine **read-only-Anzeige** der aktuellen Auswahl (menschenlesbares Label; bei
  Mounts der vollständige Breadcrumb, z. B. `Shop > /customers > content`);
  Platzhaltertext, wenn leer; optionale Felder sind über ein „×" leerbar,
- daneben der Button **„Auswählen…"**, der den Dialog mit dem passenden Preset
  öffnet.

Das gebundene `#node-input-*`-Element bleibt als **verstecktes Wertefeld** im
DOM — Node-RED-Defaults-Bindung, `change`-Events, Validierung und der
Save-Round-Trip sind unverändert. Ein gespeicherter Wert, der im aktuellen
Graphen nicht mehr auflösbar ist, bleibt erhalten und wird als
`<wert> (bestehend)` angezeigt.

**Verhalten des Dialogs:**
- **App-Scope (P117):** Die Kandidaten sind auf die **App des editierten
  Knotens** gefiltert (bestimmt über dessen `parent` bzw. die Mount-Kette,
  jeweils nach dem aktuellen Stand des offenen Panels). Ist keine App
  bestimmbar (neuer Knoten ohne parent/mount), werden alle Kandidaten gezeigt
  und jede Zeile nennt zusätzlich ihre App. Das `apps`-Preset ist naturgemäß
  ungefiltert.
- **Optik (P117):** Der Dialog folgt dem Stil der übrigen Node-RED-Admin-
  Dialoge — Editor-Sans-Serif-Schrift (niemals Serife), NR-konforme Kopfzeile,
  Standard-Suchfeld, Listen-Hover/-Selected und `red-ui-button`-Buttons; alle
  Farben über `--red-ui-*`-Variablen (theme-/darkmode-fähig). Die Styles
  liegen in einem geteilten Stylesheet der `webapp-node-picker-*`-Klassen,
  das auch Icon-Picker (P69) und Media-Picker (P70) erben.
- Scrollbare Kandidatenliste; jede Zeile zeigt **Name + ID + Knotentyp** (beim
  `mounts`-Preset siehe Zwei-Spalten-Tree unten).
- **Contains-Suche** (case-insensitive) über Name, ID **und** Typ (`nodePickerMatch`);
  beim `mounts`-Preset über Breadcrumb/Pfad und Mount-Wert.
- Aktuelle Auswahl hervorgehoben; Auswahl per Klick, Schließen per `Esc` oder Overlay-Klick.
- Gespeichert wird stets die **Knoten-ID** (bzw. der Mount-String) — Round-Trip unverändert.

**Zwei-Spalten-Tree für `mounts` (P135, [ADR 0014](../../adr/0014-mount-picker-two-column-tree.md)):**
Der Mount-Picker (Preset `mounts`) ist ein **Master-Detail-Browser** statt einer
flachen Breadcrumb-Liste. Nur dieses Preset ändert sich; die flachen
Referenz-Presets (apps/routes/actions/stores/layouts) bleiben flache Listen.
- **Links — Struktur-Tree:** App → (Routen / Dialoge) → Container → **rekursiv**
  Kind-Container. Nur **Struktur-Knoten** sind Branches; ein Kind-Container hängt
  direkt unter seinem **Parent-Knoten** (nicht unter einer Slot-Ebene). Links ist
  reine Navigation. Quelle ist `buildMountPickerTree` (rein, testbar).
- **Rechts — Slots des links gewählten Knotens:** flache Liste; **Slots sind die
  einzigen selektierbaren Leaves** (der Pick). Knoten ohne eigene Slots zeigen
  rechts „Keine Slots".
- **Nicht app-gescoped (P117):** alle Apps als oberste Ebene — Cross-App-Mounts
  bleiben möglich.
- **Zyklus-Schutz:** beim Editieren des eigenen Mounts eines `ui-container` wird
  dessen eigener Teilbaum aus dem Tree ausgeschlossen.
- **Vorauswahl:** der aktuelle Mount-Pfad ist aufgeklappt und markiert, sein Slot
  rechts gewählt; der Footer zeigt den vollen Breadcrumb der Auswahl.
- **Suche:** läuft über den Tree. Bei Suchbegriff wird **links** eine **flache
  Liste der gefundenen Pfade** (Branches, **ohne** Slots); **rechts** bleiben die
  **Slots** des links gewählten Treffers. Leere Suche → Zwei-Spalten-Browser.
- Der gespeicherte Mount-String (`<type>:<id>/<slot>` bzw. `<appId>.<slot>`) ist
  **unverändert** — kein Daten-/Schema-/Renderer-Wechsel.

**Resizable + gemerkte Größe + Ellipsis (geteilt für ALLE Picker, P135):**
- Der Dialog-Container ist über CSS `resize: both` resizable (nativer
  Eck-Anfasser, kein JS), mit `min-width`/`min-height`, `max-width: 95vw`,
  `max-height: 90vh`.
- Die gewählte Breite/Höhe wird in `localStorage` gemerkt und beim nächsten
  Öffnen wiederhergestellt — geteilt über die `webapp-node-picker-*`-Klassen, also
  auch für Icon- (P69) und Media-Picker (P70).
- Lange Labels nutzen `text-overflow: ellipsis` statt Horizontal-Scroll.

**API:**
- `openNodePickerDialog({ title, value, entries, onSelect })` — öffnet den Dialog (CSS-Klassen `webapp-node-picker-*`).
- `installPickerField(selector, { filterPreset, title, placeholder, clearable })` —
  verwandelt ein gebundenes `#node-input-*`-Feld in das Anzeige+Button-Muster
  oben. Ersetzt das frühere `enhanceSelectWithPicker` (Dropdown + Button),
  das mit ADR 0009 entfällt.

**Default-Filter (Presets).** Die Kandidatenliste wird pro Feld durch ein Preset
vorgefiltert (`nodePickerPresets`, gespeist aus `collectReferenceNodes`):

| Preset | Kandidaten |
|---|---|
| `apps` | alle `ui-app` |
| `routes` | alle `ui-route` |
| `actions` | alle `ui-action` / `ui-navigation` |
| `stores` | alle `ui-store` |
| `mounts` | alle Parent-Slots (Apps → Routen/Dialoge → Container → Slots) als **Zwei-Spalten-Tree** (P135, `buildMountPickerTree`); `buildMountOptionsTree`/`flattenMountOptionTree` liefern weiterhin die flache Breadcrumb-Liste (Such-Pfade + Label-Auflösung) |

`collectReferenceNodes()` sammelt App-, Route-, Dialog-, Container-, Action- und
Store-Knoten aus dem aktuellen Editor-Graphen (inkl. id/typ/titel/parent/path),
indem es `RED.nodes.eachNode` durchläuft — die Auswahl basiert also auf dem
Modell, nicht auf Canvas-Wires.

---

## Referenz-Selektoren

Die folgenden Installer verdrahten die obigen Picker-Felder an die
Standard-Felder eines Panels (in `oneditprepare` aufrufen, an den Knoten
gebunden). Sie rendern jeweils das Anzeige+Button-Muster aus ADR 0009 — kein
befülltes Dropdown:

- `installParentAppSelector()` — `#node-input-parent` (Preset `apps`).
- `installReferenceSelectors(config)` — je nach `config`-Flags:
  - `route: true` → `#node-input-routeId` (Preset `routes`, optional/leerbar)
  - `action: "<selector>"` → ein Action-Feld (Preset `actions`)
  - `store: true | "<selector>"` → ein Store-Feld (Preset `stores`, optional/leerbar)
  - `mount: true` → `#node-input-mount` (Preset `mounts`; Anzeige = Breadcrumb;
    eine Auswahl feuert `change`, sodass die Layout-Child-Felder
    (`installLayoutChildPropRows`) dem neuen Parent-Layout folgen)
  - `layout: true` → `#node-input-layoutId`
- `installLayoutSelector(config)` — Preset-Auswahl (`getStandardLayoutPresetOptions`) für App/Route/Dialog/Container; **kein** Referenzfeld, bleibt eine kleine, feste SelectBox.

Alle gespeicherten Werte sind **IDs** (bzw. Mount-Strings `<type>:<id>/<slot>`).

---

## Bindbare Werte: die typedInput-Binding-Typen (P67)

> **Prinzip — Binding-Ubiquität (ADR 0012):** **Jedes wertführende Feld jedes
> `ui-*`-Knotens bietet standardmäßig Bindings** (als typedInput). Reduziert
> wird nur, wo eine Binding-Art **unmöglich** (nicht zurückschreibbar / nicht
> auswertbar) oder **sinnlos** (ein Literaltyp, den das Feld nie tragen kann)
> ist — und das muss bewusst deklariert sein, nicht der Default. Die reaktiven
> Quellen **Store, Query, Route-Param, Reactive** sind praktisch **immer**
> verfügbar. Insbesondere `disabled` braucht zwingend ein **Store**-Binding.
>
> **Feld-Kategorien** (voller Satz = die 14 Typen unten):
>
> | Kategorie | Beispiele | Angebotene Typen | Entfernt — warum |
> |---|---|---|---|
> | Wert/Anzeige | `label`, `message`, `value` (auch der Input-Control-`value`), `src` | voller Satz | — (P113) |
> | Boolean-Zustand | `disabled` (später `hidden`/`readonly`) | Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**, Flow, Global, Env | string/number/json/timestamp — ein Boolean trägt sie nicht |
> | URL/Pfad | `href`, ui-action `to` | str, msg, JSONata, Store, Reactive, Flow, Global, Env | number/boolean/json/timestamp — keine URL |
>
> Der Input-Control-`value` ist **kein** reduzierter Sonderfall: er ist die
> *Anzeige-/Initial*-Bindung (voller Satz, wie ui-checkbox/-datepicker bereits
> liefern); das **Zurückschreib-Ziel** ist ein **separates** Feld
> (`valuePath`/`storeId`, state/store). Ein Feld ohne deklarierte Kategorie
> fällt auf den **Wert/Anzeige-Vollsatz** zurück (sicherer, maximaler Default).
> Details: [ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).

Bindbare Display-Wert-Felder (z. B. `ui-text` `value`, `ui-alert`
`message`/`title`, `ui-image`/`ui-avatar` `src`) nutzen ein
Node-RED-**typedInput**, dessen Typ-Auswahl die Binding-Art bestimmt. Der
gemeinsame Typsatz **und** die Serialisierung kommen seit **P113 (ADR 0012 /
ADR 0010)** aus genau **einer** Quelle — den Helfern `valueBindingTypes()`,
`readValueBinding()` und `applyValueBinding()` (`resources/lib/editor-common.js`).
Ein neuer Typ oder eine Reihenfolge-Änderung ist damit genau **eine** Änderung an
einer Stelle.

Der kanonische **Wert/Anzeige-Vollsatz** (14 Typen, feste Reihenfolge,
Default-Typ `string`):

| # | typedInput-Typ | Binding-`kind` | Wert |
|---|---|---|---|
| 1 | store | `store` | referenzierter `ui-store` (per Picker gewählt) |
| 2 | query | `query` | Query-Pfad (mit Pfad-Validierung) |
| 3 | routeParam | `routeParam` | Name des Routen-Parameters der aktuellen Route |
| 4 | reactive | `reactive` | JavaScript-Expression gegen die Client-Quellen (`routeParam`, `store(…)`, `query(…)`) — [reactive-expressions.md](reactive-expressions.md), ADR 0010; Editor-Dialog liefert P116 |
| 5 | msg | `msg` | Message-Property (Pfad, Standard-Node-RED) |
| 6 | jsonata | `jsonata` | JSONata-Ausdruck **gegen die eingehende Message** (message-getrieben) |
| 7 | str | `literal` (string) | der Wert selbst |
| 8 | num | `literal` (number) | typisierte Zahl |
| 9 | bool | `literal` (boolean) | typisierter Boolean |
| 10 | json | `literal` (JSON-Wert) | geparstes JSON |
| 11 | date | `literal` (Epoch-ms) | Zeitstempel (Epoch-ms) |
| 12–14 | flow / global / env | `flow`/`global`/`env` | serverseitig einmalig pro Render |

`state` ist **nicht** mehr im Editor-Angebot (bleibt schema-/renderer-seitig für
Altbestände bestehen). Reduzierte Kategorien:
`valueBindingTypes({ category: "boolean" })` (für `disabled`: ohne
string/number/json/timestamp) und `{ category: "url" }` (für `href`/`to`: nur
str + msg/JSONata + Store/Reactive + Flow/Global/Env). Ein Feld ohne deklarierte
Kategorie → Wert/Anzeige-Vollsatz.

### Scope-lokale Binding-Arten sind kontext-gated (P182, ADR 0017 / ADR 0020)

Zusätzlich zum globalen 14er-Satz gibt es **scope-lokale** Binding-Arten, die nur
im jeweiligen Template-Container auflösen — sie erscheinen daher im typedInput-Satz
**nur**, wenn der editierte Knoten (transitiv) in diesem Container hängt:

| typedInput-Typ | Binding-`kind` | Scope | sichtbar wenn … |
|---|---|---|---|
| item (Repeat) | `item` | `ui-repeat`-Template | der Knoten (transitiv) unter einem `ui-repeat` mountet |
| index (Repeat) | `index` | `ui-repeat`-Template | wie `item` |
| prop (Component) | `prop` | `ui-component-definition`-Template (`def:`-Scope) | der Knoten (transitiv) in einer Komponenten-Definition mountet |

Außerhalb des passenden Scopes würden diese Arten zur Render-Zeit zu `undefined`
auflösen — sie wären reines Rauschen und werden deshalb **aus dem Dropdown
ausgeblendet**. Den Scope ermittelt `valueBindingTypes()` aus dem live editierten
Formular (`#node-input-mount` + `collectReferenceNodes()`) über die Helfer
`mountIsInsideRepeat()` bzw. `mountIsInsideComponentDef()`; ein Aufrufer kann den
Scope auch explizit übergeben (`scope: { repeat, componentDef }`).

**Editierbarkeit bestehender Configs:** trägt das Feld bereits ein
`item`/`index`/`prop`-Binding (`currentKind`), bleibt der jeweilige Typ im Satz —
auch wenn der Knoten nicht (mehr) im Scope hängt —, damit ein gespeichertes Binding
beim erneuten Öffnen nicht still verloren geht. Der advisory `installRepeatScopeHint`
bleibt als Backstop für den Fall „Binding gesetzt, dann aus dem Repeat gezogen".

> **Re-open-Caveat:** ändert man den Mount nachträglich **in** einen Repeat/eine
> Definition hinein, erscheint der scope-lokale Typ erst beim **erneuten Öffnen**
> des Panels (der Typsatz wird in `oneditprepare` einmal gebaut).

> **`msg`/`jsonata` sind message-getrieben und flüchtig (Owner-Entscheid
> 2026-06-10).** Der zuletzt aus einer Nachricht erfasste Wert lebt nur in der
> Live-Definition (Backend), **nicht** im Flow-File. Ein **NR-Deploy** (und ein
> Neustart) baut das Modell frisch aus dem Flow → der erfasste Wert geht
> verloren und das Feld rendert wieder **leer**, bis die nächste passende
> Message kommt. Im **Production-Modus** lädt der User nach dem Deploy neu →
> `onEnter` feuert → der Flow kann den Wert neu setzen; im **Development-Modus**
> (In-Place-Apply ohne Reload) bleibt das Feld bis zur nächsten Message leer.
> Wer einen über Deploys **stabilen** Wert braucht, nutzt eine reaktive Quelle
> (Store/Query/Route-Param/Reactive). Details: [live-deploy-update.md](live-deploy-update.md).

> „Page-Param" entspricht dem Typ **„Route Param"** (`routeParam`): er liest einen
> Parameter aus dem Pfad der aktuell angezeigten Route.

### Der Store-Typ: Name im Wert, eingerücktes Pfad-typedInput (P132 → P134, ADR 0013 §4)

Der **Store-Typ** (`storeTypedInputType`) ist eine Sonderform mit eigener
Wert-Spalten-Darstellung (`valueLabel`). Das Feld-Label bleibt in der **linken**
Panel-Label-Spalte; das gesamte Store-UI sitzt in der **Wert-Spalte**:

> **Korrektur P134 (2026-06-11):** P132 hatte das Layout falsch gebaut — ein
> „Store ändern"-Button **und** den Sub-Pfad in **einer** Zeile (mit ID-Anzeige
> `<x> (bestehend)`). P134 hebt es auf das korrigierte **Zwei-Zeilen-Layout**:
> **Name im Wert** (oben) + **zweites, eingerücktes Pfad-typedInput** darunter.
> **Kein** „Store ändern"-Button mehr — das **„…"**-Expand des typedInput selbst
> öffnet den Picker.

> **Live-Fix P174 (2026-06-13):** Das Zwei-Zeilen-Layout wirkte live trotzdem
> **einzeilig/gequetscht**. Ursache: Node-REDs typedInput sperrt den äußeren
> Container (`.red-ui-typedInput-container`, `height:34px`, `overflow:hidden`,
> Zeilen-Flex) **und** die Wertzelle (`.red-ui-typedInput-value-label`,
> `height:32px`, `overflow:hidden`) auf **eine** feste Zeilenhöhe — die zweite
> (Sub-Pfad-)Zeile wurde abgeschnitten. `storeTypedInputType.valueLabel` lockert
> diese beiden festen Höhen nun **nur** im Zwei-Zeilen-Fall (`height:auto`,
> `overflow:visible`, Klasse `webapp-store-field-tworow` am Container) und stellt
> sie beim Verlassen des Store-Typs bzw. in der Blatt-/Vor-Auswahl-Form wieder
> her. Da das Store-Control aus **einer** geteilten Stelle kommt, gilt das Soll-
> Layout identisch auf **allen ~26 Wertfeldern**.

- **Vor Auswahl:** im Wert-Bereich nur ein **weicher Hinweis** („Store über „…"
  auswählen"). Die typedInput-eigene **„…"**-(Expand-)Taste öffnet den
  app-gescopten Node-Picker-Dialog (Preset `stores`, P68/P117). Store-Icon
  (`fa fa-database`) ist das **Typ-Icon** des typedInput. **Kein** Pfad-Feld.
- **Nach Auswahl:** im Wert-Bereich erscheint der **Name** des Stores (aus der ID
  über `collectReferenceNodes` aufgelöst, app-gescoped) — **nicht** die rohe ID,
  **kein** „Store ändern"-Button, **kein** `(bestehend)` für einen lebenden Store.
  Die **„…"**-Taste wechselt den Store. Eine nicht auflösbare ID (gelöschter
  Store) fällt auf `<id> (bestehend)` zurück. Gespeichert wird stets die **ID**.
- **Zweites, eingerücktes Pfad-typedInput (`subPath`).** Unterhalb des Namens, in
  der Wert-Spalte eingerückt (das Feld-Label bleibt in Spalte 1), ein typedInput
  für einen optionalen **Ein-Level-Pfad** in den Slice (leer = ganzer Slice).
  Quellen über
  die Helfer-Kategorie `valueBindingTypes({ category: "storePath" })`: `string`
  (Default), `number`, `routeParam`, `query`, `store`, `reactive`, `jsonata`,
  `msg`, `flow`, `global`, `env`. Der innere `store` ist ein **Blatt** (kein
  geschachtelter Sub-Pfad — Ein-Level-Regel, ADR 0013 §3).
- **Default-Slice-Autocomplete (weich).** Beim Typ `string` werden die
  **Keys/Indizes** des Default-Slice-Werts des gewählten Stores (aus dessen
  `initialValue` geparst) als Vorschläge angeboten. **Kein Zwang, kein
  Verstecken, keine Typ-Einschränkung** — der Editor ist permissiv, die Laufzeit
  (P131) validiert. Reine Ableitung: `defaultSliceKeySuggestions(value)`.

Zur Laufzeit löst der Renderer die Store-ID über den `statePath` des Stores auf
und wendet danach den `subPath` an (Details und Begründung in
[stores.md](stores.md)).

**Serialisierung.** `readValueBinding(binding, fallback)` füllt das typedInput
aus einem gespeicherten Binding-Objekt (Literal → primitive Sub-Type
`str`/`num`/`bool`/`json`/`date`; `reactive` → aus `value`; `store` → ID plus
optionalem `subPath`; alle übrigen aus `path`); `applyValueBinding(type, value,
subPath?)` baut beim Speichern das Binding-Objekt wieder zusammen
(`{ kind:"literal", value:<typisiert> }` / `{ kind:"reactive", value }` /
`{ kind:"store", path, subPath? }` / `{ kind, path }`). Den Store-Wert + Sub-Pfad
trägt das typedInput intern als JSON-Hülle `{path, subPath}`, sodass die
kanonischen Helfer ihre 2-Argument-Form behalten und jeder bestehende
Store-Konsument den Sub-Pfad ohne Änderung mit-roundtrippt. Wichtig: Das
typedInput-Element und das Feld, das das **Binding-Objekt** persistiert, sind
getrennt (Muster von `ui-text` — sonst überschreibt die
Node-RED-Defaults-Auto-Übernahme das Objekt mit dem rohen typedInput-Wert).

---

## Komponenten-Varianten: die Variant-SelectBox (P50)

`installVariantSelectBox(kind)` rendert eine Auswahlliste für das `variant`-Feld,
gespeist **direkt aus dem Schema-Vokabular** (`COMPONENT_VARIANT_VOCABULARY` in
`packages/schema`). Damit bleiben Editor-Auswahl und Contract synchron — die Liste
ist nie im Editor hartcodiert. Welche Knoten welches Vokabular tragen (und die
Abgrenzung `variant` vs. `displayType`): [theming.md](theming.md).

---

## Basis-Felder + Editor-Struktur (P139, ADR 0015)

Jeder Knoten bietet die **vier gemeinsamen Basis-Felder** `visible`, `disabled`,
`color`, `size` als standardisierte Gruppe an (Entscheidung:
[ADR 0015](../../adr/0015-common-base-fields-and-editor-structure.md)). Der
geteilte Helfer dafür ist `installBaseFields(config)` in
`resources/lib/editor-common.js` (Gegenstück fürs Speichern:
`applyBaseFields(config)` in `oneditsave`):

- **Gruppe mit Überschrift „Allgemein"** — die Basis-Felder stehen in einem
  eigenen, per `injectFieldGroup` injizierten Abschnitt.
- **`visible`** — Boolean-Zustand-typedInput (ADR-0012-Boolean-Satz). Leer =
  sichtbar (Default). Persistiert als Binding-Objekt auf `visible`, typedInput
  auf `#node-input-visibleBinding` (Trennung wie beim `disabled`-Muster);
  Legacy-`visiblePath` wird als `state`-Binding migriert.
- **`disabled`** — **dasselbe** Boolean-Zustand-typedInput, das P122–P130
  ausgerollt haben (`#node-input-disabledBinding`, Binding-Objekt auf
  `disabled`, `disabledPath`-Migration) — zentralisiert, nicht dupliziert.

**Boolean-Basis-Feld: neutraler Wert = eigener semantischer Default (P181/P202,
[ADR 0026](../../adr/0026-boolean-state-base-field-neutral-equals-semantic-default.md)).**
Ein leeres Boolean-Basis-Feld zeigt einen sauberen `bool`-True/False-Regler
(P181, kein Store-Fallback). Der *neutrale* Wert eines solchen Feldes — sowohl
die **Leer-Anzeige** als auch der **Save-Sentinel** — ist der **pro-Feld**
semantische Default, nicht pauschal `false`:

| Feld | leer ⇒ | Leer-Anzeige | Sentinel (⇒ `null` speichern) |
|---|---|---|---|
| `visible` | true (sichtbar) | **true** | ursprünglich leer **und** Wert === **true** |
| `disabled` | false (aktiv) | **false** | ursprünglich leer **und** Wert === **false** |

Ein ursprünglich leeres Feld, das noch seinen Neutralwert trägt, speichert `null`
(„kein Binding"). **Jeder andere Literal — inkl. des entgegengesetzten Booleans —
wird verbatim persistiert:** ein bewusstes `visible=false` speichert
`{kind:literal,value:false}` und **versteckt** den Knoten wirklich (der Renderer
lässt ihn aus dem DOM weg, nicht nur CSS-versteckt); ein bewusstes `disabled=true`
speichert `{kind:literal,value:true}`. Gespeicherte Nicht-Literal-Bindings
(state/store/reactive/…) öffnen unverändert im richtigen Typ und werden
durchgereicht. `installBaseFields` seedet die Leer-Anzeige pro Feld;
`applyBaseFields` prüft den Sentinel pro Feld — Knoten, die `visible`/`disabled`
inline verwalten (z. B. `ui-skeleton` für `visible`), sind angeglichen.
- **`color`** — allgemeiner Farb-typedInput (voller Wert-Binding-Satz),
  Binding-Objekt auf `color`, typedInput auf `#node-input-colorBinding`; ein
  Legacy-String wird als Literal migriert, ein leeres Literal als `null`
  gespeichert. **Wechselseitig exklusiv mit `variant`**: trägt der Knoten das
  semantische `variant`, ist `color` N/A (Hinweis „nutzt semantische Variant").
- **`size`** — das bestehende Größen-Token-Select (`#node-input-size`,
  `installSizeSelectBox`-Optionen), wo anwendbar.

**Knoten-lokale Anwendbarkeit:** `config` deklariert, welche Basis-Felder für
den Knoten gelten, z. B.
`{ visible: true, disabled: false, color: true, size: false, variant: false, advanced: ["size"], hints: { … } }`.
Die pure Logik dahinter ist `resolveBaseFieldApplicability(config)`:
Default ist **anwendbar**; `variant: true` erzwingt `color` → N/A. Eine
zentrale Capability-Map (P102) kann die verstreuten Flags später ersetzen.

**N/A-Disable mit Hinweis:** Ein nicht anwendbares Feld wird **angezeigt, aber
disabled** (Zeile `data-base-field-na="true"`), mit kurzer Begründung aus
`config.hints[feld]` (Fallback: eingebaute Default-Hinweise) — sichtbar als
`[data-base-field-hint]`-Text und als `title`-Tooltip der Zeile.

**Einklappbarer „Erweitert"-Abschnitt:** Selten genutzte Basis-Felder können per
`config.advanced: ["size", …]` in einen einklappbaren Unterabschnitt (default
eingeklappt) wandern; ohne `advanced` sind **alle Basis-Felder sichtbar**
(Default). Der Zustand ist reine Editor-Affordanz, nicht persistiert.

**Rollout:** P139 liefert nur die Mechanik + den Referenzknoten **`ui-divider`**
(non-variant → `color` aktiv; nicht interaktiv → `disabled` N/A). Die Umstellung
aller übrigen Knoten folgt als eigene Pakete (ADR 0015 „Consequences").

---

## Layout-Felder

- `installLayoutSelector(config)` — Standard-Preset-Auswahl (`horizontal`, `vertical`, `app`, `grid`, `absolute`, `dialog`).
- `installLayoutChildPropRows()` — blendet je nach Parent-Layout die passenden **Child-Platzierungs-Felder** ein (Grid: `row`/`col`/`colSize`/`rowSize`; Absolute: `layoutX`/`layoutY`; Horizontal/Vertical: `order`). Wertebereiche und Validierung: [layout.md](layout.md).
- **„Layout"-Überschrift (P139, ADR 0015):** Die zentral injizierten
  Platzierungs-Zeilen (`injectPlacementRows`) tragen eine vorangestellte
  **„Layout"**-Überschrift — sie landet damit auf jedem Knoten zugleich und wird
  zusammen mit den Zeilen ein-/ausgeblendet (kein Layout-Feld aktiv → keine
  Überschrift).

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
| Gespeichert in | verstecktes Wertefeld (eine ID / Mount-String) | Hidden-Input (JSON-Array von IDs) |
| Typischer Einsatz | parent, route, action, store, mount | `ui-action` `targets` |

---

## Zwei-Wege-Farbcodierung (P120, ADR 0011 §4)

Überall im Editor, wo beide Konfigurations-Wege (Verdrahtung vs. interne
Referenz) gleichzeitig erscheinen können, wird eine einheitliche visuelle
Codierung eingesetzt:

| Weg | Farbe (Default) | Icon | Semantik |
|---|---|---|---|
| **Wire** — Node-RED-Verdrahtung | Blau `#185FA5` | `fa-plug` | Ziel kommt über den Output-Port |
| **Referenz** — interne Auswahl | Lila `#534AB7` | `fa-link` | Ziel als direkte Knoten-Referenz im Panel |

Die Farben sind **kräftige Vollflächen** (weiße Schrift darauf, WCAG-AA-Kontrast)
— keine hellen Tints. Farbe ist **nie der einzige Träger**: Icon + Label sind
stets dabei (Barrierefreiheit).

Entscheidung und Begründung: [ADR 0011 §4](../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md).

### Zwei Anwendungsformen

**1. Panel-Hintergrund** (bevorzugt, wo ein ganzes Panel den Weg trägt):
Der aktive Modus-Abschnitt nimmt die Modus-Farbe als kräftigen
Vollflächenhintergrund. Formfelder sitzen als helle Insets (`webapp-path-field-inset`)
darauf. Kein Pill-Badge, nur eine schlichte Abschnittsüberschrift.
CSS-Klassen: `webapp-path-panel--wire` / `webapp-path-panel--ref`.
Erster Konsument: das Navigations-Panel von `ui-action` (P119).

**2. Kompaktes Badge** (für Kontexte ohne färbbares Panel, z. B. Struktur-Sidebar):
`pathBadge(kind, label)` erzeugt ein `<span>`-Element mit kräftiger Farbvollfläche,
Icon und Label. `kind` ∈ `"wire" | "ref"`.

```js
$row.append(WebappEditorCommon.pathBadge("wire", "via Wire"));
$row.append(WebappEditorCommon.pathBadge("ref",  "Referenz"));
```

Beide Formen teilen dieselben CSS Custom Properties:

```css
--webapp-path-wire-color   /* Default: #185FA5 */
--webapp-path-ref-color    /* Default: #534AB7 */
```

### Konfiguration: Editor-User-Setting

Die Farben sind **editor-global pro User** konfigurierbar — nicht in `ui-app`,
weil es sich um reine Editor-Darstellung handelt (kein App-Zustand). Die
Einstellungen leben in Node-REDs Editor-User-Settings-Bereich ("Webapp"-Sektion)
mit zwei Farbwählern und einem "Zurücksetzen auf Standard"-Button.

Änderungen wirken **sofort** (die CSS-Variablen am `:root` werden ohne Reload
aktualisiert) und werden über `RED.settings` persistiert.

`installDualPathUserSettings()` ist idempotent und wird automatisch beim Laden
von `editor-common.js` registriert; P119 und spätere Konsumenten müssen sie
nicht selbst aufrufen.

---

## Navigations-Zielquellen-Umschalter & Wire-Scan (P119, ADR 0011)

Erster Konsument der Zwei-Wege-Codierung ist die Navigations-Konfiguration von
`ui-action` (Verb `navigate`) und `ui-navigation`. `installNavigateTargetMode()`
baut aus drei Hidden-Carriern (`targetMode`, `routeId`, `params`) und dem
`to`-typedInput eine Modus-UI:

- **Segment-Schalter** mit drei Modi (Icon + Label): **via Wire** · **Route** ·
  **URL**. Genau ein Modus ist aktiv; die Felder der anderen Modi werden
  ausgeblendet und beim Speichern **nicht serialisiert** (Modus-Exklusivität,
  P118-Schema). Der **Panel-Hintergrund** nimmt die Modus-Farbe an (blau/lila/
  neutral, P120-Tokens); ein separates Badge entfällt (ADR 0011 §4).
- **`scanWiredNavigationTargets(nodeId)`** — transitiver **Wire-Scan**: BFS über
  ausgehende Wires ab dem editierten Knoten, durch Zwischenknoten (function,
  switch …) hinweg, mit Visited-Set (Zyklus-Schutz) und Tiefenlimit (~50). Er
  sammelt erreichte `ui-route`/`ui-app` als **Menge** (Verzweigung ⇒ mehrere
  Treffer). **Dokumentierte Limitation:** Link-Nodes und Subflow-Instanzen werden
  nicht verfolgt. Der Scan ist **reine Assistenz** — er erzeugt **nie** einen
  Validierungsfehler (eine Heuristik darf keinen Deploy blockieren).
- **`parseRoutePlaceholders(path)`** — extrahiert die `:platzhalter` eines
  Routen-Pfads (geordnet, dedupliziert) für die Mapping-Tabelle.
- **Initiale Vorbelegung** nur, wenn `targetMode` noch nie gespeichert wurde
  (Scan ≥1 → `wire`, sonst `route`); danach gewinnt die gespeicherte Absicht —
  spätere Wire-Änderungen schalten den Modus nicht um (kein UI-Flackern).
- **`validateNavigateConfig(node)`** — Field-Validator: nur der `route`-Modus
  wird **hart** geprüft (auflösbare `routeId` + jeder `:platzhalter` mit Wert);
  `wire`/`url` blockieren nie. Wirkt sowohl bei offenem Panel (über den
  Controller) als auch zur Deploy-Zeit (liest die gespeicherten Felder).

Beide Knoten verdrahten **dieselbe** zentrale Funktion — keine Zweit-Implementierung.

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
- [backend-support.md](backend-support.md) — nicht nativ unterstützte Felder: Trennlinie + Warnung (gemeinsamer Editor-Helfer)
- [actions.md](actions.md) — `ui-action`-Ziele (Out-Port vs. Canvas-Picker `targets`)
