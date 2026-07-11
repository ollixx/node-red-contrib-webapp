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

### `order`-Default (P207): leer ⇒ Canvas-y

Jeder order-tragende Knoten (die view-Knoten, deren Mount-Ziel `horizontal`
oder `vertical` ist) mappt seinen Sortierschlüssel über den zentralen Helper
`resolveOrder(config)` in `nodes/webapp.js`:

```js
function resolveOrder(config) {
    const o = toOptionalNumber(config.order);
    return o !== undefined ? o : toOptionalNumber(config.y);
}
```

- **Explizit gesetztes `order`** gewinnt immer und wird unverändert als
  Sortierschlüssel verwendet.
- **Leeres `order`** übernimmt stattdessen die rohe Node-RED-Canvas-y-Position
  des Knotens (`config.y`, **nicht** `layoutY` — das ist das separate
  Absolute-Layout-Feld und bleibt davon unberührt). Dadurch entspricht die
  visuelle Anordnung der Knoten auf dem Canvas ohne manuelles `order` der
  gerenderten Reihenfolge im Slot.
- **Misch-Semantik (bewusst, kein Sonderfall):** In einem Slot, in dem manche
  Knoten explizites `order` und andere leeres `order` (⇒ y-Fallback) haben,
  gilt weiterhin die literale Sortierung `order ?? Number.MAX_SAFE_INTEGER`
  aus Renderer/Registry. Ein kleiner expliziter `order`-Wert sortiert also vor
  einem y-Fallback-Knoten mit großem Pixelwert. Beispiel: Knoten A hat
  `order=5`, Knoten B hat kein `order` und steht bei `y=120` auf dem Canvas —
  A rendert vor B, weil `5 < 120`. Es gibt keine slot-weite Umschaltung
  zwischen „alle explizit" und „alle y-basiert".
- Ist ein Slot komplett ohne `order`-Werte und ohne Canvas-y (z. B. bei
  synthetisierten Sub-Knoten wie Tab-/Accordion-Sections, die intern über den
  Array-Index sortieren), bleibt das bestehende Verhalten unverändert.

Die per-Node-`order`-Feldbeschreibungen (z. B. in `docs/nodes/input/*.md`,
`docs/nodes/display/*.md`) verweisen auf diesen Abschnitt statt das Verhalten
zu duplizieren.

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
