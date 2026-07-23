# ui-divider

Eine visuelle Trennlinie zwischen Inhaltsbereichen — horizontal oder vertikal,
optional mit einem mittigen Label.

> English (canonical): [nodes/ui-divider.md](../../nodes/ui-divider.md)

## Zweck

`ui-divider` rendert eine Trennlinie zwischen benachbarten Inhaltsbereichen.
Der Knoten ist rein darstellend: er trägt keinen Zustand, emittiert keine
Events und hat keine Ports. Einsatz: Seiten visuell gliedern — zwischen
Formular-Abschnitten, Listen-Gruppen oder nebeneinanderliegenden Panels,
optional mit einem kleinen mittigen Label wie „Oder".

## Wann einsetzen

- Gestapelte Inhalte in einem vertikalen Layout trennen (**horizontaler**
  Trenner).
- Nebeneinanderliegende Bereiche in einem horizontalen Layout trennen
  (**vertikaler** Trenner).
- Eine Alternative beschriften („Oder", „Abschnitt B") über das mittige
  **Label**.
- NICHT verwenden, um interaktive Inhalte mit Überschrift zu gruppieren —
  dafür ist ein `ui-container` mit Titel die bessere Wahl.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Auswahllisten. | Freitext | `Divider N` (fortlaufend) |
| **Parent Slot** (`mount`) | Wo der Trenner lebt — der Parent-Slot über den Mount-Baum (`ui-app`, `ui-route`, `ui-dialog` oder `ui-container`). Pflicht. | Slot-Pfad | — |
| **Orientation** | Richtung der Linie. `horizontal` trennt gestapelte Inhalte; `vertical` trennt nebeneinanderliegende Bereiche (nur sinnvoll in horizontalen/Grid-Anordnungen). | `horizontal` / `vertical` | `horizontal` |
| **Label** | Optionaler Text mittig auf der Linie. Voll bindbar — fester Text (Literal) oder Live-Wert aus Store, State, Query, Route-Param, … | Text / Binding | leer (kein Label) |
| **Visible** | Render-Gate: ist der gebundene Wert `false`, wird der Trenner gar nicht gerendert. | Boolean / Binding | sichtbar |
| **Color** | Farbe der Linie. Bindbar; leer erbt die Rahmenfarbe des App-Themes. | CSS-Farbe / Binding | Theme-Default |
| **Disabled** | Nicht anwendbar — ein Trenner hat keinen interaktiven Zustand (deaktiviert mit Hinweis angezeigt). | — | — |
| **Size** | Nicht anwendbar — ein Trenner hat keine Größen-Stufen (deaktiviert, unter „Erweitert"). | — | — |
| **Platzierung** (`order` / `row`·`col` / `colSize`·`rowSize` / `X`·`Y`) | Position im Layout des Parents; welche Felder erscheinen, hängt vom Layout-Preset des Parents ab (order für Stapel, row/col für Grids, X/Y für absolut). | Zahlen | Canvas-Reihenfolge |

## Eingang

`ui-divider` hat **keinen Eingangs-Port** und empfängt keine Nachrichten. Er
wird ausschließlich über seine Konfiguration gesteuert; die bindbaren Felder
(Label, Color, Visible) aktualisieren sich live über ihre Bindings — an einen
Store gebunden, ändert sich der Trenner zur Laufzeit.

## Ausgänge / Events

Keine — der Trenner emittiert keine Events.

## Beispiele

### 1. Zwei Abschnitte mit beschriftetem Trenner

Zwei Textblöcke vertikal gestapelt, getrennt durch einen horizontalen Trenner
mit dem mittigen Label „Or" und eigener Linienfarbe.

Flow-Datei: [`examples/guide/ui-divider.json`](../../../../examples/guide/ui-divider.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/ui-divider.json` auswählen (oder ihren
   JSON-Inhalt einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideDivider/` öffnen — zu sehen sind
   „Section A", ein violetter Trenner mit Label „Or" und „Section B".

## Verwandt

- [Benutzerhandbuch (Start)](../README.md)
- Vertrags-Doku (intern): `docs/nodes/display/ui-divider.md`
