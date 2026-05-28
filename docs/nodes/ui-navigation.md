# `ui-navigation`

**Deprecated**

## Zusammenfassung

Repräsentiert im aktuellen MVP eine benannte Navigation zu einer Zielroute. Fachlich ist Navigation jedoch ein Spezialfall von `ui-action`.

Aktuelles MVP-Verhalten:
- Der Preview-Pfad kann Routenparameter in `to` einsetzen.
- Bei Navigation wird ein `msg.ui`-Ereignis mit Navigationsmetadaten emittiert.

## Abhängigkeiten

**Parent-Knoten:**
- Keiner.

**Gemeinsam genutzte Services und Komponenten:**
- Spezialfall von `ui-action` vom Typ `navigate`

## Editor

**Pflichtfelder:**
- `id`
- `to`

## Input

Ausgelöst durch UI-Interaktionen.

## Output

Emittiert ein `msg.ui`-Ereignis mit Navigationsmetadaten.

## Besonderheiten

- Navigation sollte langfristig nicht als eigenständiges Verhaltenskonzept neben `ui-action` bestehen bleiben.
- Sinnvoller ist, `ui-navigation` als MVP-kompatiblen Alias oder Editor-Helfer für `ui-action` vom Typ `navigate` zu behandeln.
- Offen ist nur noch, ob dafür weiterhin ein eigener Komfort-Knoten im Editor sinnvoll ist oder ob der Knoten ganz in `ui-action` aufgeht.
