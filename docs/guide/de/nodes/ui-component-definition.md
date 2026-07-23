# ui-component-definition

Eine wiederverwendbare, parametrisierte Vorlage aus `ui-*`-Knoten — einmal
angelegt, vielfach über `ui-component-instance` verwendet.

> English: [../../nodes/ui-component-definition.md](../../nodes/ui-component-definition.md)

## Zweck

Eine **Komponente** ist ein benanntes, parametrisiertes, wiederverwendbares Set
von `ui-*`-Knoten. `ui-component-definition` ist die **Vorlage**: einmal
angelegt, Kind-Knoten in ihren `content`-Slot gemountet, klont jede
[`ui-component-instance`](ui-component-instance.md) sie mit eigenen Props. Die
Definition ist **off-canvas** — sie rendert nie selbst; sie existiert nur, um
von einer Instanz expandiert zu werden.

## Wann einsetzen

- Ein kleines UI-Fragment (eine Karte, ein beschriftetes Feld, eine Zeile), das
  an mehreren Stellen mit anderen Daten wiederverwendet werden soll.
- Die von einer Instanz übergebenen Werte lesen: in einem Kind-Knoten einen Wert
  an **Prop (Component)** binden (z. B. `title`, `address.city`).
- Nicht für Pro-Instanz-Zustand — v1-Komponenten sind darstellend (Props rein,
  Events raus; keine Child-Slot-Projektion, kein eigener Zustand).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in der Strukturansicht. | Freitext | — |
| **Node ID** (`uiId`) | Die eigene Knoten-ID — zugleich die `componentId`, die Instanzen referenzieren. | ID | automatisch |

Es gibt **keinen** Parent-Slot: eine Definition ist off-canvas und hat kein
äußeres Mount. Kind-Knoten in ihren `content`-Slot mounten — im Mount-Picker
unter **Komponenten**.

## Eingang

Keiner — eine Definition ist eine Vorlage, kein Laufzeit-Knoten. Sie hat keinen
Eingangs-Port und empfängt keine Nachrichten.

## Ausgänge / Events

Keine direkt. Events der geklonten Kinder einer Instanz tragen die Identität der
Instanz (`<instanceId>#<innerNodeId>`) in ihrer `sourceId`.

## Beispiele

### 1. Eine Definition, von zwei Instanzen verwendet

Eine Definition mit einem `ui-text`, gebunden an `prop.title`; zwei Instanzen
rendern sie mit unterschiedlichem `title`-Prop.

Flow-Datei: [`examples/guide/ui-component.json`](../../../../examples/guide/ui-component.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-component.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideComponent/` öffnen — zwei Karten,
   „First card" und „Second card", aus derselben Definition.

## Verwandt

- [`ui-component-instance`](ui-component-instance.md) — instanziiert eine Definition
- [Theming & Components](../guides/theming-components.md) — wiederverwendbare Komponenten
- Contract-Doc (intern, Englisch): `docs/nodes/structure/ui-component.md`
