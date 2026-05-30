# `ui-text`

## Zusammenfassung

Rendert einen Textwert an einem Mount-Ziel.

Aktuelles MVP-Verhalten:
- Unterstützt Literal-, State-, Query-, Route-Param-, msg-, flow-, global-, jsonata- und env-Bindings über das gemeinsame Binding-Modell.
- Dient für Überschriften, Labels und Statusanzeigen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Binding-Modell: Literal-, State-, Query-, RouteParam-, msg-, flow-, global-, jsonata- und env-Bindings

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `value`: Binding-Ausdruck

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Text N"` (fortlaufende Nummer aller ui-text-Knoten, startend bei 1)
- `variant`
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

Kein Output.

## Query path syntax

Query paths use dot-bracket notation to address nested data within a query result:

- **Dot access**: `user.address.city`
- **Array index**: `items[2].name`
- **Combined**: `results[0].customer.firstName`

Rules:
- The path must start with a letter, underscore (`_`), or dollar sign (`$`).
- Subsequent segments are separated by `.` (property access) or `[n]` (zero-based integer index).
- Examples of valid paths: `items[0].label`, `data.users[3].email`, `$response.count`
- Examples of invalid paths: `[0].name` (no leading identifier), `items.2.name` (numeric segment without brackets), `items[-1]` (negative index)

The editor validates query paths and highlights invalid entries before deploy.

## Besonderheiten

- Es ist unklar, ob `ui-text` nur Plaintext oder auch formatierte Inhalte unterstützen soll.
- Varianten sind heute frei benannt, aber noch nicht als Design-Tokens festgelegt.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Mount ab. Details dazu stehen in [layout.md](../concepts/layout.md).
