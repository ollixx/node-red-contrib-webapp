# `ui-navigation`

**Deprecated**

## Zusammenfassung

Repräsentiert im aktuellen MVP eine benannte Navigation zu einer Zielroute. Fachlich ist Navigation jedoch ein Spezialfall von `ui-action`.

Aktuelles MVP-Verhalten:
- Der Preview-Pfad kann Routenparameter in `to` einsetzen.
- Bei Navigation wird ein `msg.ui`-Ereignis mit Navigationsmetadaten emittiert.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Die App ist der Routing-Kontext für Navigation-Events.

**Gemeinsam genutzte Services und Komponenten:**
- Spezialfall von `ui-action` vom Typ `navigate`

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `to`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Navigation N"` (fortlaufende Nummer aller ui-navigation-Knoten, startend bei 1)

## Input

Wird von der Runtime ausgelöst wenn ein Client-Event diese Navigation referenziert. Format identisch mit `ui-action` Input.

## Output

```
msg.ui.event       = "navigate"
msg.ui.navigate.to = "/customers/42"
msg.ui.params      = { id: "42" }
msg.ui.clientId    = <auslösender Client>
```

## Besonderheiten

- Navigation sollte langfristig nicht als eigenständiges Verhaltenskonzept neben `ui-action` bestehen bleiben.
- Sinnvoller ist, `ui-navigation` als MVP-kompatiblen Alias oder Editor-Helfer für `ui-action` vom Typ `navigate` zu behandeln.
- Offen ist nur noch, ob dafür weiterhin ein eigener Komfort-Knoten im Editor sinnvoll ist oder ob der Knoten ganz in `ui-action` aufgeht.
