# `ui-container`

## Zusammenfassung

Mountet einen Container an einen Slot und rendert darin ein Child-Layout.

Aktuelles MVP-Verhalten:
- Rendert aktuell das referenzierte Child-Layout rekursiv.
- Ist die vorgesehene Antwort auf verschachtelte UI-Struktur statt verschachtelter Slot-Pfade.
- Der Preview-Pfad nutzt Container mit Child-Layout, um Dialoginhalte inklusive Eingaben und Actions zu gruppieren.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert ein Layout-Preset über `layoutId` als Child-Layout

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `layout`: Referenz auf ein bekanntes Layout-Preset
  - Default: `vertical` (kinder werden untereinander dargestellt)

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Container N"` (fortlaufende Nummer aller ui-container-Knoten, startend bei 1)
- `variant`: Flächen-Rolle (`CONTAINER_VARIANTS`): `card | panel | section | transparent`. Default: `card`. Vokabular siehe [theming.md](../concepts/theming.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Konfigurierbare Events — im Editor per Checkbox aktivierbar. Pro aktivem Event ein Out-Port:

| Event | Beschreibung | `msg.ui`-Felder |
|---|---|---|
| `onShow` | Container wurde eingeblendet | `event: "onShow"`, `clientId` |
| `onHide` | Container wurde ausgeblendet | `event: "onHide"`, `clientId` |

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](../concepts/layout.md).

- Container verwenden ebenfalls Standard-Layout-Presets als Child-Layout.
- Wird ein Container direkt in ein Preset-Layout gemountet, erscheinen die passenden Layout-Child-Props im Editor (`order` bzw. Grid-/Absolute-Felder).
- ~~Es ist noch offen, ob Container später eigene Layout- oder Stylingvarianten tragen sollen.~~ Seit P49 trägt der Container ein festes Varianten-Vokabular (`CONTAINER_VARIANTS`).
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstützung für Parent-Auswahl und Visualisierung.
