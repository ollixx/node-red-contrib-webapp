# `ui-input`

## Zusammenfassung

Rendert ein generisches Eingabefeld mit State-Binding und optionalem Store-Binding.

Aktuelles MVP-Verhalten:
- Rendert einfache HTML-Inputs für Text, E-Mail und Zahlen.
- Schreibt Änderungen im Renderer in den gebundenen State-Pfad.
- Kann im Preview zusammen mit `ui-container` und Action-Buttons als dialogartige Eingabegruppe arbeiten.

## Abhängigkeiten

**Parent-Knoten:**
- Mount-Ziel (Route-, Dialog- oder Layout-Slot)

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-store` über `storeId`
- State-Binding für `value`
- Client-State: schreibt Änderungen direkt in den gebundenen State-Pfad

## Editor

**Pflichtfelder:**
- `id`
- `mount`
- `label`
- `value`

**Optionale Felder:**
- `storeId`
- `path`
- `inputType`
- `placeholder`
- `order`

## Input

## Output

Schreibt Änderungen im Renderer in den gebundenen State-Pfad.

## Besonderheiten

- Validierung, Select-Optionen, Mehrzeiligkeit und komplexere Feldtypen fehlen noch.
- Das Zusammenspiel zwischen direktem State-Binding und Store-Operationen muss weiter geschärft werden.
