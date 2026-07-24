# ui-breadcrumb

Ein hierarchischer Navigationspfad, der zeigt, wo der Nutzer in der App ist.

> English (canonical): [nodes/ui-breadcrumb.md](../../nodes/ui-breadcrumb.md)

## Zweck

`ui-breadcrumb` rendert einen **Navigationspfad** — eine horizontale Folge von
Labels, durch ein Trennzeichen getrennt, die die Position des Nutzers in der
App-Hierarchie zeigt. **Jedes Element ist klickbar** und emittiert ein
`click`-Event auf dem Output-Port. Das aktuelle Element kann `active` markiert
werden (anders gerendert, aber weiterhin klickbar). Die Elemente kommen entweder
aus einem `items`-Array/Binding oder — im Child-Node-Modus — aus gemounteten
Kind-Knoten.

## Wann einsetzen

- Eine Positions-Spur (Home › Customers › Details) am Kopf einer Route zeigen.
- Den Nutzer in der Hierarchie nach oben springen lassen — `click` →
  `ui-action` verdrahten.
- Für die Hauptnavigation zwischen Top-Level-Bereichen [`ui-menu`](ui-menu.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Breadcrumb N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Mode** (`layout`) | Woher die Items kommen: der Standard-Modus *Items / Binding* oder *Child Nodes (Slots)*, in dem gemountete Kinder zu Items werden. | `""` (Items/Binding), `breadcrumb` (Child-Slots) | Items/Binding |
| **Items** (`items`) | Die Pfad-Elemente — ein JSON-Array oder ein Binding (nur im Items/Binding-Modus). String-Items (`["Home","Details"]`) nutzen den String als Label und Action; Objekt-Items sind `{ "label", "action"?, "active"? }`. | `literal` (JSON), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | `[]` |
| **Separator** (`separator`) | Das Trennzeichen zwischen Items (Items/Binding-Modus). Ein nicht-leerer String überschreibt Shoelaces natives `/`; leer → `/`. | Freitext | `/` |
| **Visible** / **Color** | Basis-Felder. | — | — |

`Disabled` und `Size` sind N/A (ein Breadcrumb spiegelt die Navigation und hat
keinen Deaktiviert-Zustand oder Größen-Stufen). Im Child-Node-Modus werden
Item-Knoten in den `default`-Slot und ein optionaler Trennzeichen-Knoten in den
`separator`-Slot gemountet.

## Eingang

`ui-breadcrumb` **hat einen Eingangs-Port**:

- **`msg.payload`** — ersetzt die Items-Liste (ein Array von
  `{ label, action?, active? }` oder ein String-Array). Ein gebundenes `items`
  wird bei der nächsten Binding-Auflösung wiederhergestellt.
- **`msg.ui.patch`** — überschreibt Knoten-Felder (z. B. `items`, `separator`).
- **`msg.ui.component.op`** (`show`, `hide`) — schaltet die Sichtbarkeit der
  gesamten Spur.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

`ui-breadcrumb` hat einen Output-Port. **Jeder** Item-Klick (auch `active`-Items)
emittiert:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `click` | Nutzer klickt ein Item | `event: "click"`, `params.action` (Action oder Label des Items), `clientId`, `sourceId`, `appId` |

Es gibt **kein `navigate`-Event** — auch ein Item, dessen `action` ein Routen-Pfad
ist, feuert `click`. Verdrahte `click` → `ui-action` (`navigate`,
`to: msg.ui.params.action`) für den Wechsel. Im Child-Node-Modus ist
`params.action` die Node-ID des angeklickten Kindes.

## Beispiele

### 1. Eine dreistufige Spur mit aktueller Seite aktiv

`Home › Customers › Details`, „Details" als aktiv markiert; Klicks emittieren
`click`.

Flow-Datei: [`examples/guide/ui-breadcrumb.json`](../../../../examples/guide/ui-breadcrumb.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-breadcrumb.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideBreadcrumb/` öffnen — die Spur
   rendert mit „Details" als aktueller Seite.

## Verwandt

- [`ui-menu`](ui-menu.md) — Haupt-Route-Navigation
- [Navigation & Dialoge](../guides/navigation-dialogs.md) — Routen und Navigate-Modi
- [`ui-action`](ui-action.md) — macht aus einem `click` einen Route-Wechsel
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-breadcrumb.md`
