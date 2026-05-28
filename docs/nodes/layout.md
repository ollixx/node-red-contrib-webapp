# Layout-Feature (zentral)

## Zweck

Diese Datei dokumentiert das mehrfach genutzte Layout-Feature, das in mehreren Knoten wiederkehrt.
Sie fasst die bestehenden Aussagen aus den Knoten-Dokumenten zusammen.

## Grundidee

- Das Layout bestimmt die strukturelle Anordnung von Bereichen in App, Route, Dialog oder Container.
- Knoten, die ein Layout brauchen, sollen zwischen einem Preset und `custom` unterscheiden können.
- Bei `custom` erfolgt die freie Modellierung über `ui-layout` und `ui-slot`.

## Presets

Vorgesehene Presets sind mindestens:
- `horizontal`
- `vertical`
- `app` mit den Slots `header`, `navbar`, `content`, `footer`

Weitere spätere Standard-Layouts sind vorgesehen.

## Custom-Layout

- `ui-layout` bleibt für den Fall `custom` bestehen.
- Slots werden weiterhin explizit über `ui-slot` modelliert.
- Nur wenn `custom` gewählt ist, soll der Editor passende `ui-layout`-Knoten zur Auswahl anbieten.

## Referenzierende Knoten

- `ui-app`: Basis-Layout der Anwendung
- `ui-route`: Layout der Seite
- `ui-dialog`: Layout des Dialogs
- `ui-container`: Child-Layout innerhalb eines Mount-Ziels
- `ui-layout` und `ui-slot`: Bausteine für frei modellierte Layouts

## Aktueller Stand im MVP

- Layouts sind heute app-gescoped.
- Routen und Dialoge verweisen über `layoutId` auf ein Layout.
- Slots werden flach pro Layout aufgebaut und validiert.

## Offene Spezifikation

- Es fehlen explizite Layout-Typen wie Shell, Dialog-Shell oder Tabs-Container.
- Es gibt noch keine deklarativen Layout-Varianten für Responsiveness oder Breakpoints.
- Es ist noch offen, ob Container später eigene Layout- oder Stylingvarianten tragen sollen.
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstützung für Parent-Auswahl und Visualisierung.
