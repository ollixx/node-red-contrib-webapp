# `ui-container`

## Zusammenfassung

Mountet einen Container an einen Slot und rendert darin ein Child-Layout.

Aktuelles MVP-Verhalten:
- Rendert aktuell das referenzierte Child-Layout rekursiv.
- Ist die vorgesehene Antwort auf verschachtelte UI-Struktur statt verschachtelter Slot-Pfade.
- Der Preview-Pfad nutzt Container mit Child-Layout, um Dialoginhalte inklusive Eingaben und Actions zu gruppieren.

## Abhängigkeiten

**Parent-Knoten:**
- Mount-Ziel (Route-, Dialog- oder Layout-Slot)

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-layout` über `layoutId` als Child-Layout

## Editor

**Pflichtfelder:**
- `parent`: Auswahl gültiger Parents, d.h. Slots in bestehenden Containern. Wenn es mehr als X (20?) mögliche Einträge gibt, wird stattdessen ein kleiner Dialog angezeigt, der eine scrollbare Liste von Slots (hierarchisch) zeigt und gefiltert werden kann.
- `layout`: Referenz auf ein bekanntes Layout
  - Default: `vertical` (kinder werden untereinander dargestellt)

**Optionale Felder:**
- `name`: node-red Standard zur lesbaren Identifikation des Knotens.
  - default ist "Container X", wobei X die fortlaufende Nummer aller ui-container Knoten ist, startend bei 1

## Input
```
noch nicht definiert. 
Ideen:
- ui-action (show / hide etc.)
- message zum dynamischen Erzeugen/Ändern/Löschen eines Kind-Elementes 
```

## Output
```
noch nicht definiert. 
Ideen:
- ui-event (onShow / onHide etc.)
- ui-event als antwort auf create / update / delete eines Kindelements 
```

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Container sollten ebenfalls zwischen Standard-Layout-Presets und `custom` unterscheiden können.
- Wird `custom` gewählt, referenziert der Container wie bisher ein Child-Layout über `ui-layout` und `ui-slot`.
- ~~Es ist noch offen, ob Container später eigene Layout- oder Stylingvarianten tragen sollen.~~
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstützung für Parent-Auswahl und Visualisierung.
