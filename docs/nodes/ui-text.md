# `ui-text`

## Zusammenfassung

Rendert einen Textwert an einem Mount-Ziel.

Aktuelles MVP-Verhalten:
- Unterstützt Literal-, State-, Query- und Route-Param-Bindings über das gemeinsame Binding-Modell.
  - Das Binding muss genauer beschrieben werden. Ideal wäre es, nur Elemente aus einem Store zu verwenden, um Responsiveness zu gewährleisten. Alternativ statische Werte. Hier könnten auch eingehende Messages mit dynamischen Werten - wie in node-red üblich - eingesetzt werden, die dann per Event im Store (client seitig) verändert werden.
- Dient für Überschriften, Labels und Statusanzeigen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Binding-Modell: Literal-, State-, Query- und RouteParam-Bindings

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `value`: Binding-Ausdruck

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Text N"` (fortlaufende Nummer aller ui-text-Knoten, startend bei 1)
- `variant`
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

Kein Output.

## Besonderheiten

- Es ist unklar, ob `ui-text` nur Plaintext oder auch formatierte Inhalte unterstützen soll.
- Varianten sind heute frei benannt, aber noch nicht als Design-Tokens festgelegt.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Mount ab. Details dazu stehen in [layout.md](layout.md).
