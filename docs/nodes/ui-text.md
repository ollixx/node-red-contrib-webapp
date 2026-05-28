# `ui-text`

## Zusammenfassung

Rendert einen Textwert an einem Mount-Ziel.

Aktuelles MVP-Verhalten:
- Unterstützt Literal-, State-, Query- und Route-Param-Bindings über das gemeinsame Binding-Modell.
  - Das Binding muss genauer beschrieben werden. Ideal wäre es, nur Elemente aus einem Store zu verwenden, um Responsiveness zu gewährleisten. Alternativ statische Werte. Hier könnten auch eingehende Messages mit dynamischen Werten - wie in node-red üblich - eingesetzt werden, die dann per Event im Store (client seitig) verändert werden.
- Dient für Überschriften, Labels und Statusanzeigen.

## Abhängigkeiten

**Parent-Knoten:**
- Mount-Ziel (Route-, Dialog- oder Layout-Slot)

**Gemeinsam genutzte Services und Komponenten:**
- Binding-Modell: Literal-, State-, Query- und RouteParam-Bindings

## Editor

**Pflichtfelder:**
- `id`
- `mount`
- `value`: Binding-Ausdruck

**Optionale Felder:**
- `variant`
- `order`

## Input

## Output

## Besonderheiten

- Es ist unklar, ob `ui-text` nur Plaintext oder auch formatierte Inhalte unterstützen soll.
- Varianten sind heute frei benannt, aber noch nicht als Design-Tokens festgelegt.
