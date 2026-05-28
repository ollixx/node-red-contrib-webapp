# `ui-slot`

## Zusammenfassung

Definiert einen benannten Mount-Slot innerhalb eines Layouts.

Aktuelles MVP-Verhalten:
- Slots werden flach pro Layout validiert.
- Geschwister dürfen denselben Namen nicht doppelt verwenden.
- View-Knoten mounten direkt in Route-, Dialog- oder Layout-Slots.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-layout` (über `layoutId`)

**Gemeinsam genutzte Services und Komponenten:**
- Slots sind Mount-Ziele für alle View-Knoten (`ui-text`, `ui-button`, `ui-table`, `ui-container`, `ui-input`)

## Editor

**Pflichtfelder:**
- `id`: fachliche Slot-ID
- `layoutId`: Layout, in dem dieser Slot lebt
- `name`: Bezeichnet diesen Slot. Darf nicht leer sein und muss für sein Layout eindeutig sein.

**Optionale Felder:**
- `title`: sichtbarer Titel des Slots
- `order`: Sortierreihenfolge; im Schema effektiv mit Default `0`

## Input

## Output

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Slot-Namen sind heute frei, aber nicht typisiert. Es gibt kein festes Slot-Vokabular.
- Es ist noch nicht geklärt, ob Slots rein strukturell bleiben oder künftig Styling- und Sichtbarkeitsregeln tragen.
- Die frühere Vermischung von Slot und verschachteltem Container ist aufgelöst: Verschachtelung läuft über `ui-container` mit Child-Layout, nicht über geschachtelte Slot-Pfade.
