# `ui-button`

## Zusammenfassung

Rendert einen klickbaren Button, der eine Action referenziert.

Aktuelles MVP-Verhalten:
- Rendert einen Link bzw. Trigger auf `/webapp/:appId/action/:actionId`.
- Emittiert standardisierte `msg.ui`-Ereignisse.
- Kann einen deaktivierten Zustand aus einem Binding beziehen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-action` über `action`
- Binding-Modell: `disabled`-Zustand über State-Binding

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `label`: aktuell ein einfacher String, kein Binding-Ausdruck
- `action`: Action-ID

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Button N"` (fortlaufende Nummer aller ui-button-Knoten, startend bei 1)
- `disabled`
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `click` | `event: "click"`, `actionId`, `clientId` |

## Besonderheiten

- Der Knoten kennt nur die Action-ID, aber keine deklarative Aussage über Variant, Intent, Busy-Zustand oder Bestätigungslogik.
- Für produktive Nutzung braucht es wahrscheinlich ein reichhaltigeres Action- oder Command-Modell.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Mount ab. Details dazu stehen in [layout.md](layout.md).
