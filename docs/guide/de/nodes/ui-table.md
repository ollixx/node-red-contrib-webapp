# ui-table

Rendert tabellarische Daten mit konfigurierbaren Spalten und optionalem Row-Select-Event.

> English (canonical): [nodes/ui-table.md](../../nodes/ui-table.md)

## Zweck

`ui-table` rendert ein **Array von Zeilen-Objekten** als Tabelle. Die
Zeilendaten kommen aus dem `rows`-Binding (typisch ein Query- oder Store-Ergebnis
oder ein statisches Array); die Spaltenstruktur wird über `columns` deklariert.
Eine Spalte kann ein einfaches Datenfeld oder ein typisierter Renderer sein
(Text, Zahl, Datum, Checkbox, Aktions-Buttons) und sortier-/filterbar gemacht
werden. Klickt der Nutzer eine Zeile an, kann der Knoten ein `rowSelect`-Event
auf einem Output-Port emittieren — der übliche Treiber eines Master/Detail-Flows.

## Wann einsetzen

- Eine Liste von Datensätzen als Gitter zeigen (Kunden, Bestellungen, Log).
- Eine Detailansicht treiben: `rowSelect` → `ui-action` (navigate) oder
  `ui-store` (Auswahl setzen) → `ui-query` (Detail laden).
- Für ein Karten-/Freiform-Layout einer Liste `ui-list`; um beliebige
  Kind-Knoten pro Element zu layouten `ui-repeat`.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Table N` |
| **Parent Slot** (`mount`) | Slot, in den die Tabelle mountet. Pflicht. | Mount-Pfad `<type>:<id>/<slot>` | — |
| **Columns** (`columns`) | Spaltendefinition. Pflicht — mindestens eine Spalte. Kurzform: kommagetrennte Keys (Key = Header). Vollform: JSON-Array von Objekten mit `key`, `label`, `type` (`text`/`number`/`date`/`checkbox`/`actions`), `sortable`, `filterable`, `width`. | z. B. `name,email,status` oder JSON-Array | — |
| **Rows** (`rows`) | Strukturelle Daten-Quelle — ein Array von Zeilen-Objekten, das die Tabelle selbst rendert. Bindbar über alle Standard-Arten. | `json`/Literal (statisches Array), `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | keine (leere Tabelle) |
| **Events** (`events`) | Aktiviert den `rowSelect`-Output-Port. | Checkbox → Output-Port | aus |
| **Visible / Disabled / Color** | Basis-Felder: Render-Gate, Disabled-Zustand, Farb-Override — alle bindbar. | Binding / Wert | sichtbar / aktiv / Theme |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot; welche Zeilen erscheinen, hängt vom Layout-Preset ab. | Zahlen | Canvas-y |

`Size` gilt nicht für eine Tabelle (advanced N/A). Fehlende Zeilen-Keys rendern
als leere Zelle.

## Eingang

`ui-table` **hat einen Eingangs-Port**. Bei einer Message:

- **`msg.payload`** (nicht-`null`) setzt `rows` auf diesen Wert und pusht einen
  frischen Snapshot an alle verbundenen Clients.
- **`msg.ui.patch`** überschreibt Felder (z. B. `rows`, `columns`);
  Binding-Felder (`rows`) als Binding-Objekt übergeben.
- **Component-State-Ops** (`msg.ui.component.op`): `show` / `hide`.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `rowSelect` | Nutzer klickt eine Zeile | `event: "rowSelect"`, `params: { rowId, row }` |

`rowId` ist die `id` der Zeile (falls vorhanden), sonst der Array-Index als
String. `row` ist das vollständige Zeilenobjekt (der Runtime reichert
`params.row` read-only aus dem aktuellen Render an). Ohne aktives Event hat die
Tabelle keinen Output-Port.

> `selectAction` (deprecated, aber wirksam) ist die ältere direkte
> Action-bei-Klick-Referenz; neue Flows nutzen `events: [rowSelect]`.

## Beispiele

### 1. Statische Tabelle mit Row-Select-Event

Drei Spalten über ein statisches Zeilen-Array; `rowSelect` ist aktiviert und mit
einem Debug-Knoten verdrahtet, sodass ein Zeilenklick `{ rowId, row }` loggt.

Flow-Datei: [`examples/guide/ui-table.json`](../../../../examples/guide/ui-table.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-table.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideTable/` öffnen — die Tabelle zeigt
   drei Zeilen; eine anklicken und die `rowSelect`-Payload in der Node-RED-Debug-
   Sidebar beobachten.

## Verwandt

- [Daten anzeigen](../guides/displaying-data.md) — Query-Loop, Tabellen, Listen
- [Aktionen & Events](../guides/actions-events.md) — `rowSelect` verdrahten
- Verwandte Anzeigeknoten: `ui-list`, `ui-repeat`, `ui-text`
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-table.md`
