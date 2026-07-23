# ui-component-instance

Setzt eine `ui-component-definition` an einer echten Stelle ein und übergibt ihr
Props.

> English: [../../nodes/ui-component-instance.md](../../nodes/ui-component-instance.md)

## Zweck

`ui-component-instance` **verwendet** eine
[`ui-component-definition`](ui-component-definition.md): sie mountet in einen
echten Route-/Container-Slot, referenziert eine Definition und übergibt ihr eine
**Props**-Map (Name → Wert, jede Binding-Art). Zur Render-Zeit wird der Teilbaum
der Definition mit diesen Props an Ort und Stelle geklont; jeder innere Knoten
wird `<instanceId>#<innerNodeId>` re-id't, sodass Instanzen unabhängig bleiben.

## Wann einsetzen

- Eine Komponenten-Definition überall wiederverwenden, je mit eigenen Props.
- Ein Prop an einen Store/Query binden, sodass nur diese Instanz live
  aktualisiert.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | — |
| **Node ID** (`uiId`) | Die eigene Instanz-ID (ihre Klone werden damit präfixiert). | ID | automatisch |
| **Parent Slot** (`mount`) | Wo die Instanz rendert — ein echter Route-/Container-Slot aus dem Mount-Baum. Pflicht. | Slot-Pfad | — |
| **Definition** (`definition`) | Die hier zu expandierende `ui-component-definition`, aus einem Picker. Pflicht — eine fehlende/ungültige Referenz ist ein Deploy-Fehler. | Definitions-Referenz | — |
| **Props** (`props`) | Eine Liste Name → Wert; jeder Wert ist eine volle Bindung (Literal, Store, Query, State, Prop, Item, …). Die Kinder der Definition lesen sie über **Prop (Component)**. | Name → Wert-Map | `{}` |
| **Platzierung** (`order` / `row`·`col` / …) | Position im Layout des Parents; welche Felder erscheinen, hängt vom Preset ab. | Zahlen | Canvas-Reihenfolge |

## Eingang

Keiner — eine Instanz ist ein Render-Zeit-Konstrukt, kein Laufzeit-Knoten. Sie
hat keinen Eingangs-Port.

## Ausgänge / Events

Keine an der Instanz selbst. Events der geklonten inneren Knoten tragen die
Instanz-Identität (`<instanceId>#<innerNodeId>`) in ihrer `sourceId`.

## Beispiele

### 1. Zwei Instanzen einer Definition

Zwei Instanzen derselben Definition, je mit anderem `title`-Prop.

Flow-Datei: [`examples/guide/ui-component.json`](../../../../examples/guide/ui-component.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-component.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideComponent/` öffnen — zwei Karten,
   „First card" und „Second card", aus einer Definition.

## Verwandt

- [`ui-component-definition`](ui-component-definition.md) — die Vorlage
- [Theming & Components](../guides/theming-components.md) — wiederverwendbare Komponenten
- Contract-Doc (intern, Englisch): `docs/nodes/structure/ui-component.md`
