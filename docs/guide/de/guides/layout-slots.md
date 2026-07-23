# Layout & Slots

Wie die UI-Hierarchie entsteht: Mount-Pfade, Layout-Presets und die
Platzierungsfelder, die jedes Preset seinen Kindern gibt.

> English (canonical): [../../guides/layout-slots.md](../../guides/layout-slots.md)

## Ziel

Verstehen, wo eine Komponente „lebt" (ihr Mount), welche Layout-Presets es
gibt und wie Kinder in jedem Preset positioniert werden — und eine Seite mit
Header, Grid-Bereich und horizontaler Zeile bauen.

## Voraussetzungen

- Das Paket ist installiert und du hast eine erste App gebaut —
  [Erste Schritte](../getting-started.md).

## Die Struktur-Regel

Die UI-Hierarchie entsteht **ausschließlich** aus der Knoten-Konfiguration:

- Jeder View-Knoten deklariert seinen **Parent-Slot** im `mount`-Feld (der
  Mount-Picker im Editor zeigt einen Baum aller verfügbaren Slots).
- Jeder Knoten deklariert außerdem seine **App** (`app`-Feld).
- **Wires drücken nie Hierarchie aus** — sie tragen nur Daten und Events.

Ein Mount-Pfad adressiert `<Ziel>/<Slot>`. Im Editor wählst du den Slot
einfach im Baum; in einem exportierten Flow siehst du Formen wie:

| Mount-String | Bedeutung |
|---|---|
| `myApp.content` | der `content`-Slot der App (benannter Mount: Knoten-Id + Slot) |
| `myContainer.content` | der `content`-Slot eines `ui-container` |
| `myDialog.footer` | der `footer`-Slot eines `ui-dialog` |
| `route:/customers/content` | der `content`-Slot der Route mit Pfad `/customers` |
| `dialog:myDialog/content` | expliziter Dialog-Scope (gleiches Ziel wie `myDialog.content`) |

Jeder gemountete Knoten besetzt genau eine Slot-Region; ein nicht
auflösbarer Mount (unbekanntes Ziel oder Slot) wird beim Deploy abgelehnt.

## Layout-Presets

Es gibt keine eigenen Layout-Knoten — Layout ist immer eines der
gemeinsamen **Presets**, gewählt im `layout`-Feld der Struktur-Knoten
(`ui-app`, `ui-route`, `ui-dialog`, `ui-container`):

| Preset | Slots | Anordnung |
|---|---|---|
| `vertical` | `content` | Kinder untereinander |
| `horizontal` | `content` | Kinder nebeneinander |
| `grid` | `content` | Kinder in Zeilen/Spalten |
| `absolute` | `content` | Kinder an freien X/Y-Koordinaten |
| `app` | `header`, `navbar`, `content`, `footer` | Anwendungs-Hülle |
| `dialog` | `header`, `header-actions`, `content`, `footer` | Dialog-Hülle |

## Platzierungsfelder

Das gewählte Preset des **Eltern-Slots** bestimmt, welche
Platzierungsfelder seine direkten Kinder bekommen (sie erscheinen
automatisch im Editor des Kindes):

| Eltern-Preset | Kind-Felder | Bedeutung |
|---|---|---|
| `vertical` / `horizontal` | `order` | Sortierschlüssel im Stapel/in der Zeile |
| `grid` | `row`, `col`, `colSize`, `rowSize` | 1-basierte Zellenposition und Spannweite (positive Integer) |
| `absolute` | `X`, `Y` | freie Koordinaten (0 und negativ erlaubt) |
| `app` | — | Kinder füllen ihren Slot |

**Order-Default:** Lässt du `order` leer, wird die vertikale Position des
Knotens auf dem Node-RED-Canvas als Sortierschlüssel verwendet — ordne die
Knoten auf dem Canvas von oben nach unten an, und die Seite folgt. Ein
explizit gesetztes `order` gewinnt immer über die Canvas-Position.

## Schritte

1. Erstelle eine `ui-app` mit dem `app`-Layout. Mounte einen `ui-text`
   (Variant `heading-2`) in ihren **header**-Slot. Du siehst: eine Seite
   mit Titelbereich oben.
2. Füge einen `ui-container` mit Layout `grid` hinzu, gemountet in den
   **content**-Slot der App. Mounte drei `ui-text`-Knoten in den
   `content`-Slot des Containers mit den Platzierungen (row 1 / col 1),
   (row 1 / col 2) und (row 2 / col 1 mit `colSize` 2). Du siehst: zwei
   Zellen nebeneinander und eine dritte in voller Breite darunter.
3. Füge einen zweiten `ui-container` mit Layout `horizontal` in den
   App-Content ein und mounte zwei `ui-text`-Knoten mit `order` 1 und 2.
   Du siehst: zwei Texte nebeneinander, in der konfigurierten Reihenfolge.
4. Deploye und öffne die App — die gesamte Seitenstruktur entstand aus
   `mount` + `layout`, ohne ein einziges Wire.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/layout-slots.json`](../../../../examples/guide/layout-slots.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/layout-slots.json` auswählen (oder ihr JSON
   einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/layoutApp/` öffnen — Header,
   Grid-Bereich und horizontale Zeile wie beschrieben.

## Wie weiter

- [Navigation & Dialoge](navigation-dialogs.md) — Routen und Dialoge als
  weitere Mount-Ziele.
- [Daten anzeigen](displaying-data.md) — Struktur pro Datenelement
  wiederholen.
- Knoten-Referenz: siehe die Knoten-Liste im
  [Guide-Zuhause](../README.md#inhalt).
