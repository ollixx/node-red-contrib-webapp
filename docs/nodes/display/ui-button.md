# `ui-button`

## Zusammenfassung

Rendert einen klickbaren Button. Ab P20a emittiert der Button Klick-Events direkt auf seinem Output-Port — die Weiterleitung an `ui-action` oder andere Knoten erfolgt durch Wiring im Flow.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Binding-Modell: `disabled`-Zustand über State-Binding

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `label`: aktuell ein einfacher String, kein Binding-Ausdruck

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Button N"` (fortlaufende Nummer aller ui-button-Knoten, startend bei 1)
- `disabled`
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `click` | `event: "click"`, `sourceId`, `clientId` |

Der Output-Port wird typischerweise mit einem `ui-action`-Knoten verdrahtet, der die gewünschte UI-Aktion ausführt.

## Besonderheiten

- Vor P20a referenzierte der Button eine Action-ID über das `action`-Feld. Dieses Feld ist deprecated, wird aber noch für bestehende Flows akzeptiert.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Mount ab. Details dazu stehen in [layout.md](../concepts/layout.md).
