# Layout-Feature (zentral)

## Zweck

Diese Datei dokumentiert das mehrfach genutzte Layout-Feature, das in mehreren Knoten wiederkehrt.
Sie fasst die bestehenden Aussagen aus den Knoten-Dokumenten zusammen.

## Grundidee

- Das Layout bestimmt die strukturelle Anordnung von Bereichen in App, Route, Dialog oder Container.
- Knoten, die ein Layout brauchen, referenzieren eines der vorhandenen Standard-Presets.

## Presets

Es gibt **ein** gemeinsames Preset-Set (`standardLayoutPresetIds`), das alle
strukturellen Knoten (App, Route, Dialog, Container) teilen:

- `horizontal` mit dem Slot `content`
- `vertical` mit dem Slot `content`
- `app` mit den Slots `header`, `navbar`, `content`, `footer`
- `grid` mit dem Slot `content`
- `absolute` mit dem Slot `content`
- `dialog` mit den Slots `header`, `header-actions`, `content`, `footer` — sie mappen auf die nativen `<sl-dialog>`-Slots (`header`→`label`, `header-actions`, Default-Slot→`content`, `footer`); eingeführt mit `ui-dialog` (P64)

Das `dialog`-Preset ist nicht auf `ui-dialog` beschränkt — es liegt im
gemeinsamen Set. Weitere spätere Standard-Layouts bleiben möglich.

## Layout-injizierte Child-Props

Direkte Kinder eines Preset-Layouts erhalten im Editor layoutabhängige Zusatzfelder. Diese Felder werden über das Mount-Ziel sichtbar gemacht und auf dem gemounteten View-Knoten gespeichert.

- `horizontal`: `order`
- `vertical`: `order`
- `grid`: `row`, `col`, `colSize`, `rowSize`
- `absolute`: `layoutX`, `layoutY`
- `app`: keine zusätzlichen Child-Props

### Wertebereich Grid-Platzierung

Die Grid-Child-Props `row`, `col`, `colSize` und `rowSize` sind **positive Integer (>= 1)**. Grid-Positionen sind 1-basiert — ein Wert von 0 oder eine negative Zahl ist ungültig und wird vom Schema abgelehnt.

**Ausnahme:** `layoutX` und `layoutY` (Absolute-Preset) akzeptieren auch 0 und negative Werte, da sie absolute Koordinaten im Koordinatensystem des Containers darstellen.

Im Editor erzwingen die Eingabefelder für `row`, `col`, `colSize` und `rowSize` `min="1"` und `step="1"`. Ein Wert ausserhalb dieses Bereichs markiert den Knoten sofort als ungültig (roter Badge), bevor er deployed werden kann.

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

- Die Dialog-Shell ist mit dem `dialog`-Preset abgedeckt; weitere explizite Layout-Typen (z. B. Tabs-Container) fehlen noch.
- Es gibt noch keine deklarativen Layout-Varianten für Responsiveness oder Breakpoints.
- Es ist noch offen, ob Container später eigene Layout- oder Stylingvarianten tragen sollen.
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstützung für Parent-Auswahl und Visualisierung.
