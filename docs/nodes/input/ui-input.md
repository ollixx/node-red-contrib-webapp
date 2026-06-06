# `ui-input`

## Zusammenfassung

Rendert ein generisches Eingabefeld mit State-Binding und optionalem Store-Binding.

Aktuelles MVP-Verhalten:
- Rendert einfache HTML-Inputs für Text, E-Mail und Zahlen.
- Schreibt Änderungen im Renderer in den gebundenen State-Pfad.
- Kann im Preview zusammen mit `ui-container` und Action-Buttons als dialogartige Eingabegruppe arbeiten.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-store` über `storeId`
- State-Binding für `value`
- Client-State: schreibt Änderungen direkt in den gebundenen State-Pfad

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `label`
- `value`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Input N"` (fortlaufende Nummer aller ui-input-Knoten, startend bei 1)
- `storeId`: Auswahl eines `ui-store`-Knotens derselben App. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `path`
- `inputType`
- `placeholder`
- `variant`: visuelle Feld-Rolle (`INPUT_VARIANTS`): `default | filled | outlined`. Default: `default`. Vokabular siehe [theming.md](../concepts/theming.md).
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](../concepts/layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`, `focus`, `reset`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value`, `path`, `clientId` |
| `submit` | `event: "submit"`, `value`, `path`, `clientId` |

## Besonderheiten

- Validierung, Select-Optionen, Mehrzeiligkeit und komplexere Feldtypen fehlen noch.
- Das Zusammenspiel zwischen direktem State-Binding und Store-Operationen muss weiter geschärft werden.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Mount ab. Details dazu stehen in [layout.md](../concepts/layout.md).
