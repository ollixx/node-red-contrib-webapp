# ui-container

Ein verschachtelbarer Layout-Container mit eigenem Kind-Layout, Variant-Chrome und Show/Hide-Events.

> English (canonical): [nodes/ui-container.md](../../nodes/ui-container.md)

## Zweck

`ui-container` ist ein **Layout-Container** innerhalb einer Route, eines Dialogs
oder eines anderen Containers. Er mountet in einen Slot seines Parents und stellt
sein eigenes Kind-Layout (ein Layout-Preset) bereit, in das weitere View-Knoten
mounten — so entsteht beliebig tief verschachtelte UI-Struktur, ohne Slot-Pfade
künstlich zu verlängern. Sein `variant` gibt der Fläche ihre Chrome (card, panel,
section, transparent, span), und er ist die einzige Struktur-Ebene unterhalb von
Route/Dialog, die **Sichtbarkeits-Events** emittieren kann (`onShow` / `onHide`).

## Wann einsetzen

- Mehrere Knoten zu einer Karte/Panel/Section mit eigenem internen Layout
  gruppieren.
- Eine Inline-Textzeile aus mehreren `ui-text`-Knoten komponieren (`variant = span`).
- Die Daten eines Blocks erst bei erster Anzeige laden (`onShow` → `ui-query`)
  oder bei Ausblenden aufräumen (`onHide`).
- Die Sichtbarkeit eines Blocks per Button umschalten
  (`msg.ui.component.op: hide/show`).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Container N` |
| **Parent Slot** (`mount`) | Slot, in den der Container mountet. Pflicht. Bestimmt die sichtbaren Platzierungsfelder. | Mount-Pfad | — |
| **Child Layout** (`layout`) | Das Preset, nach dem die direkten Kinder angeordnet werden. Pflicht. Bestimmt die Kind-Slots und deren Platzierungsfelder. | `vertical`, `horizontal`, `app`, `grid`, `absolute` | `vertical` |
| **Variante** (`variant`) | Semantische Flächen-Rolle → die gerenderte Chrome. | `card` (`<sl-card>`: Rand, Padding, Elevation), `panel` (1px Rand, keine Elevation), `section` (nur Abstand), `transparent` (keine Chrome), `span` (Inline-Fluss) | `card` |
| **Events** (`events`) | Aktiviert die `onShow` / `onHide` Output-Ports. | Checkboxen → Ports | keine |
| **Visible / Color** | Basis-Felder (bindbar): Render-Gate, Farb-Override. | Binding / Wert | sichtbar / Theme |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung des Containers im Parent-Slot (welche erscheinen, hängt vom Parent-Layout ab). | Zahlen | Canvas-y |

`Disabled` und `Size` sind N/A (ein Container ist kein Steuerelement und hat
keine Größen-Stufen).

## Eingang

`ui-container` **hat einen Eingangs-Port**. Er akzeptiert:

- **`msg.ui.component.op`** (`show` / `hide`) — blendet den Container und alle
  seine Kinder ein/aus und feuert `onShow` / `onHide` (falls aktiviert).
- **`msg.ui.patch`** — überschreibt Felder (z. B. `variant`).
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

Er akzeptiert **kein** `msg.payload` als Primärwert — ein Container hat keinen
eigenen darstellbaren Wert.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `onShow` | wird sichtbar (nach `show` oder initialem Rendern) | `event`, `sourceId`, `appId`, `clientId` |
| `onHide` | ausgeblendet (nach `hide`) | `event`, `sourceId`, `appId`, `clientId` |

## Beispiele

### 1. Card-Container mit Kindern und onShow

Ein `card`-Container mit Überschrift und Body; `onShow` ist aktiviert und mit
einem Debug-Knoten verdrahtet, der loggt, sobald der Container erstmals rendert.

Flow-Datei: [`examples/guide/ui-container.json`](../../../../examples/guide/ui-container.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-container.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideContainer/` öffnen — die Karte zeigt
   Überschrift und Body; die `onShow`-Payload erscheint in der Debug-Sidebar.

## Verwandt

- [Layout & Slots](../guides/layout-slots.md) — Mount-Pfade, Layout-Presets
- [Theming & Components](../guides/theming-components.md) — Varianten und Chrome
- [Aktionen & Events](../guides/actions-events.md) — `onShow`/`onHide` verdrahten
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-container.md`
