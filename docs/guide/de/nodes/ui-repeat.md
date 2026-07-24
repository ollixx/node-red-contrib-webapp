# ui-repeat

Klont ein Kind-Template einmal pro Element einer gebundenen Collection — transparente Iteration.

> English (canonical): [nodes/ui-repeat.md](../../nodes/ui-repeat.md)

## Zweck

`ui-repeat` rendert **einen Kind-Subtree n-fach aus Daten**. Der Knoten bindet an
eine Liste (oder ein Objekt) über `items`; der Renderer **klont die Schablone** —
die Kinder im `content`-Slot — einmal pro Element. Jeder Klon bekommt einen
**Render-Zeit-Scope** mit dem aktuellen Element, gegen den die Kinder über die
Binding-Arten `item` / `index` binden. Anders als [`ui-list`](ui-list.md) (Blatt-
Widget mit festem `{id,label,value,icon}`-Schema und Listen-Optik) wiederholt
`ui-repeat` einen **beliebigen** Subtree.

`ui-repeat` ist **transparent** (ADR 0025): es fügt **keinen** Wrapper um die
Klone ein — es iteriert nur. Die geklonten Kinder fließen direkt in die
Eltern-Region, an die Stelle, wo der Repeat saß. Layout & Chrome (Karte, Panel,
nebeneinander) sind die Aufgabe eines expliziten `ui-container` — entweder **um**
den Repeat (arrangiert alle Klone) oder **als das eine Kind** des Repeats
(gruppiert die Felder je Item zu einer Karte/Zeile).

## Wann einsetzen

- Eine variabel lange Liste reicher Zeilen rendern (Karten mit Buttons, gemischt).
- Repeats verschachteln für gruppierte Daten (Kunden, je mit ihren Bestellungen).
- Für eine schlichte gestylte Liste mit festem Schema [`ui-list`](ui-list.md);
  für ein Spaltengitter [`ui-table`](ui-table.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Repeat N` |
| **Parent Slot** (`mount`) | Slot, in den der Repeat mountet. Pflicht. | Mount-Pfad | — |
| **Items** (`items`) | Die zu iterierende Collection. Pflicht. Auflösung zu einem Array (ein Objekt wird als `{key, value}`-Einträge iteriert; reaktiv → Re-Render). | `json`/Literal, `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | — |
| **Key Field** (`keyField`) | Feld als stabiler Per-Instanz-Key (keyed Morph — Fokus/Scroll überleben Umsortieren). | Feldname | Array-Index |
| **Scope Name** (`itemName`) | Alias für den Item-Scope dieses Repeats (das `v-for="customer in customers"`-Modell). Ein Nachfahre adressiert das Element *dieses* Repeats namentlich, auch über innere Repeats hinweg. Muss ein Identifier sein. | Identifier | keiner (nur innerstes) |
| **Visible** (`visible`) | Render-Gate (bindbar). | Binding | sichtbar |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung des Repeats im Parent-Slot. | Zahlen | Canvas-y |

`Disabled`, `Color` und `Size` sind N/A — ein transparenter Iterator hat keinen
interaktiven Zustand und rendert keine eigene Chrome.

## Item-Scope (in den Kindern)

Innerhalb der Schablone binden Kinder **relativ zum aktuellen Element**:

- **Item (Repeat)** — das ganze Element; ein optionaler Dot-Pfad wählt ein Feld
  (`name`, `address.city`). Leerer Pfad = das ganze Element.
- **Index (Repeat)** — die nullbasierte Position (pfadlos).

Der Scope ist Render-Zeit (wie `routeParam`) — keine Persistenz, kein
Store-Nebeneffekt. Außerhalb eines `ui-repeat` lösen `item`/`index` zu
`undefined` (der Editor zeigt einen Hinweis). Bei **verschachtelten** Repeats
meinen die generischen `item`/`index` den **innersten** Frame; gib einem äußeren
Repeat einen **Scope Name**, um ihn namentlich zu adressieren (`Item (customer)`),
oder nutze in einer Reactive-Expression `scope("customer").name`. Der Scope
propagiert auch durch kind-tragende Knoten (Container, Tabs, Accordions), nicht
nur zu direkten Kindern.

## Eingang

`ui-repeat` **hat einen Eingangs-Port** (Wire-Pfad wie `ui-list`): ein
`msg.payload`-Array setzt `items` und pusht einen frischen Snapshot. Es gibt
**kein** Message-Fan-out an die Kind-Knoten — die „einzeln"-Zustellung ist die
Render-Iteration, kein Wire-Split. `msg.ui.patch` überschreibt Felder.

## Ausgänge / Events

Keine — `ui-repeat` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Einfach — Repeat über eine Liste

Ein statisches Array von `{name, qty}`-Objekten; zwei Text-Knoten je Item lesen
`item.name` und `item.qty`.

Flow-Datei: [`examples/guide/ui-repeat.json`](../../../../examples/guide/ui-repeat.json)

### 2. Verschachtelt — benannte Scopes

Ein äußerer Repeat (`itemName = customer`) über Kunden, jeder mit einem inneren
Repeat (`itemName = order`) über `item.orders`. Ein tiefes Kind liest den Namen
des äußeren Kunden via `Item (customer)` und die Summe der inneren Bestellung via
das innerste `Item (Repeat)`.

Flow-Datei: [`examples/guide/ui-repeat-nested.json`](../../../../examples/guide/ui-repeat-nested.json)

### 3. Mit Container — eine Karte pro Item

Das eine Kind des Repeats ist ein `ui-container` (Card-Variante); die Felder je
Item mounten in die Karte, sodass jedes Item als eigene Karte rendert.

Flow-Datei: [`examples/guide/ui-repeat-container.json`](../../../../examples/guide/ui-repeat-container.json)

Import-Anleitung (je Beispiel):

1. In Node-RED Menü (☰) → **Import**.
2. Die JSON-Datei wählen (oder Inhalt einfügen) → **Import**.
3. **Deploy** klicken.
4. Die im Tab-Info genannte App-Root öffnen (z. B.
   `http://<dein-node-red>:1880/webapp/guideRepeat/`).

## Verwandt

- [Daten anzeigen](../guides/displaying-data.md) — Query-Loop, Repeat, Item-Bindings
- [Bindings & State](../guides/bindings-state.md) — die `item`/`index` Scope-lokalen Arten
- [`ui-list`](ui-list.md) / [`ui-table`](ui-table.md) / `ui-container`
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-repeat.md`
