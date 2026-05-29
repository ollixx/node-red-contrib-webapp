# `ui-route`

## Zusammenfassung

Definiert eine URL-Route und bindet sie an ein Layout. Aka "Page".

Aktuelles MVP-Verhalten:
- Pfade mit Parametern wie `/customers/:id` werden aufgelöst.
- Der Renderer ermittelt daraus die aktive Route und Route-Parameter.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert ein Layout-Preset über `layoutId`
- Route-Parameter werden im Binding-Modell als `routeParam`-Bindings verfügbar gemacht

## Editor

**Pflichtfelder:**
- `parent`: Auswahl gültiger Parents, d.h. hier einer App (ui-app). Wenn es mehr als X (20?) mögliche Einträge gibt, wird stattdessen ein kleiner Dialog angezeigt, der eine scrollbare Liste von Apps zeigt und gefiltert werden kann.
- `path`: Das URL-Element, das die Route definiert (Beispiel: /webapp/appName/<path>)
  - Validierung: innerhalb einer App (selbes Parent) muss der path eindeutig sein
- `layout`: Layout-Preset
  - Default: `vertical` (Kinder werden untereinander dargestellt)
  - Presets: `vertical`, `horizontal`, `app`, `grid`, `absolute`


**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Route N"` (fortlaufende Nummer aller ui-route-Knoten, startend bei 1)
  - Fallback wenn leer: `path`-Feld

## Input

Navigation-Messages werden von der Runtime intern zugestellt — keine explizite Flow-Verdrahtung nötig. `ui-action` mit `actionType: navigate` erzeugt diese Messages. Format siehe [messages.md](messages.md).

Zusätzlich akzeptiert `ui-route` Component-State-Messages für seine Kind-Elemente (show/hide etc.) — ebenfalls über die Runtime geroutet.

## Output

Konfigurierbare Events — im Editor per Checkbox aktivierbar. Pro aktivem Event ein Out-Port:

| Event | Beschreibung | `msg.ui`-Felder |
|---|---|---|
| `onEnter` | Route wurde betreten | `event: "onEnter"`, `path`, `params`, `clientId` |
| `onLeave` | Route wurde verlassen | `event: "onLeave"`, `path`, `params`, `clientId` |

`params` enthält aufgelöste Routenparameter, z.B. `{ id: "42" }` für `/customers/:id`.

## Besonderheiten

- `ui-app` ist gleichzeitig die implizite Route `"/"`. View-Knoten können direkt in die Slots der App gehängt werden — `ui-route` ist nur nötig wenn es mehr als eine Seite gibt. `ui-app` sollte deshalb alles unterstützen, was `ui-route` bietet. Hier sollte gemeinsamer Code genutzt werden.

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Knoten, die ein Layout referenzieren, verwenden eines der vorhandenen Presets.
- Direkte Kinder der Route-Slots erhalten je nach Preset zusätzliche Layout-Felder im Editor. Details dazu stehen in [layout.md](layout.md).
- Route Guards, Loader, Titelauflösung und verschachtelte Routen fehlen.
- Die Beziehung zwischen Route und Query-Lebenszyklus ist noch nicht explizit modelliert.
