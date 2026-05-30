# Layout-Feature (zentral)

## Zweck

Diese Datei dokumentiert das mehrfach genutzte Layout-Feature, das in mehreren Knoten wiederkehrt.
Sie fasst die bestehenden Aussagen aus den Knoten-Dokumenten zusammen.

## Grundidee

- Das Layout bestimmt die strukturelle Anordnung von Bereichen in App, Route, Dialog oder Container.
- Knoten, die ein Layout brauchen, referenzieren eines der vorhandenen Standard-Presets.

## Presets

Aktuell verfügbare Presets sind:
- `horizontal`
- `vertical`
- `app` mit den Slots `header`, `navbar`, `content`, `footer`
- `grid` mit dem Slot `content`
- `absolute` mit dem Slot `content`

Weitere spätere Standard-Layouts sind weiterhin möglich.

## Layout-injizierte Child-Props

Direkte Kinder eines Preset-Layouts erhalten im Editor layoutabhängige Zusatzfelder. Diese Felder werden über das Mount-Ziel sichtbar gemacht und auf dem gemounteten View-Knoten gespeichert.

- `horizontal`: `order`
- `vertical`: `order`
- `grid`: `row`, `col`, `colSize`, `rowSize`
- `absolute`: `layoutX`, `layoutY`
- `app`: keine zusätzlichen Child-Props

## Referenzierende Knoten

- `ui-app`: Basis-Layout der Anwendung
- `ui-route`: Layout der Seite
- `ui-dialog`: Layout des Dialogs
- `ui-container`: Child-Layout innerhalb eines Mount-Ziels

## Aktueller Stand im MVP

- Layouts bestehen aus den fest eingebauten Standard-Presets.
- Routen, Dialoge und Container verweisen über `layoutId` auf eines dieser Presets.
- Slots werden aus den Preset-Definitionen abgeleitet und validiert.

## Offene Spezifikation

- Es fehlen explizite Layout-Typen wie Shell, Dialog-Shell oder Tabs-Container.
- Es gibt noch keine deklarativen Layout-Varianten für Responsiveness oder Breakpoints.
- Es ist noch offen, ob Container später eigene Layout- oder Stylingvarianten tragen sollen.
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstützung für Parent-Auswahl und Visualisierung.
