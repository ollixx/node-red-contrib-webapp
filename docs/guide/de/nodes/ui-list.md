# ui-list

Rendert eine gestylte Liste aus einem Daten-Array mit festem Item-Schema, optional single-select.

> English (canonical): [nodes/ui-list.md](../../nodes/ui-list.md)

## Zweck

`ui-list` rendert eine **strukturierte Liste** an einem Mount-Ziel. Die Elemente
kommen aus dem `items`-Binding — ein statisches Array oder ein lebender
State-/Query-/Store-/Kontext-Wert. Jedes Element ist ein **String** (Kurzform
fürs Label) oder ein **Item-Objekt** mit festem Schema (`id`/`label`/`value`/
`icon`). Dieses Schema ist der **Vertrag zwischen deinen Daten und der
gerenderten Zeile** — ui-list rät keine Feldnamen, aber das **Item-Feld-Mapping**
legt fest, welches Feld einer rohen Entity das Label/Value/Id/Icon ist. Ein
Display-Typ steuert den Look; die Liste kann **auswählbar** sein (Single-Select).
Klicks und Auswahlwechsel werden als Events auf Output-Ports emittiert.

## Wann einsetzen

- Eine polierte, backend-gestylte Liste zeigen, deren Daten ins Item-Schema
  passen (Menüs, Schnellauswahl, Kategorien mit Anzahl-Badge).
- Eine Zeile auswählbar machen und die Auswahl in einen Store spiegeln
  (`selectable` + `selectedId`).
- Für **reiche oder variierende** Zeileninhalte (Karten mit Buttons) `ui-repeat`;
  für **Spalten** [`ui-table`](ui-table.md). „Tabellarisch" ist keine ui-list-Option.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `List N` |
| **Parent Slot** (`mount`) | Slot, in den die Liste mountet. Pflicht. | Mount-Pfad | — |
| **Items** (`items`) | Die strukturelle Array-Quelle. Pflicht. Skalar-Literale sind ausgeblendet. | `json` (statisches Array), `state`, `query`, `store`, `routeParam`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` | keine (leere Liste) |
| **Display Type** (`displayType`) | Semantischer Look-Intent (adapter-gemappt, keine Farbe). | `plain` (Default), `divided` (Trennlinien), `grouped` (umrandete Karten), `actionable` (Hover/Fokus-Affordanz) | `plain` |
| **Ordered list (ol)** (`ordered`) | Schaltet `ul` ↔ `ol` (nummeriert). | Checkbox | aus |
| **Value-Anzeige** (`displayValue`) | Wie der `value` einer Zeile gezeigt wird (value ist stets im Event). | `none`, `secondary` (trailing Text), `badge` (Pille) | `none` |
| **Badge Variant** (`badgeVariant`) | Badge-Farbe — nur bei `displayValue = badge`. | `neutral`, `primary`, `info`, `success`, `warning`, `danger` | `neutral` |
| **Label / Value / Id / Icon Field** | Item-Feld-Mapping (P208): welches flache Feld einer rohen Entity das Label/Value/Id/Icon ist. Nur flache Namen (kein Dot-Pfad). | Feldnamen | `label` / `value` / `id` / `icon` |
| **Auswählbar** (`selectable`) | Schaltet Single-Select ein (ein Klick markiert die Zeile). | Checkbox | aus |
| **Ausgewählt (id)** (`selectedId`) | Zweiseitiges Binding auf die `id` der ausgewählten Zeile — nur relevant bei auswählbar. Liest die Auswahl aus Store/State und schreibt sie beim Wechsel zurück. | `state`, `store`, `query`, `routeParam`, Literal | keine |
| **Events** (`events`) | `itemClick` (immer verfügbar) und `itemSelect` (nur sinnvoll bei auswählbar) — je aktives Event ein Output-Port. | Checkboxen → Ports | keine |
| **Visible / Disabled / Color** | Basis-Felder (bindbar). `disabled` sperrt die Zeilen-Interaktion; ohne aktive Events wirkungslos. | Binding / Wert | sichtbar / aktiv / Theme |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot. | Zahlen | Canvas-y |

`Size` ist N/A — Dichte wird über **Display Type** gesteuert.

## Item-Schema — das Datenmodell

`items` löst zu einem **Array** auf. Jedes Element ist ein **String** (Kurzform
für `{label}`) oder ein **Objekt**:

| Feld | Typ | Pflicht | Rolle |
|---|---|---|---|
| `label` | String | ja (Objektform) | Primärtext der Zeile (die String-Kurzform setzt dies) |
| `id` | String | nein (sonst Index) | Identität — als `rowId` im Event und als Render-Key |
| `value` | String / Number | nein | Anwendungswert — stets im Event (`row.value`); Anzeige über `displayValue` |
| `icon` | String | nein | führendes Icon (Icon-Name des App-Icon-Sets) |

Eine Nicht-Array-Wurzel rendert eine leere Liste (kein Crash). Fehlt `label`,
zeigt nur diese Zeile `?`. Zusätzliche Felder werden ignoriert — du kannst eine
ganze DB-Zeile binden und per **Feld-Mapping** wählen, welches Feld welche Rolle
hat; `itemClick.row` trägt weiterhin die volle Entity.

## Eingang

`ui-list` **hat einen Eingangs-Port**. Bei einer Message:

- **`msg.payload`** (nicht-`null`) setzt `items` und pusht einen Snapshot an alle
  Clients.
- **`msg.ui.patch`** überschreibt Felder (z. B. `items`, `displayType`);
  Binding-Felder (`items`) als Binding-Objekt.
- **Component-State-Ops** (`msg.ui.component.op`): `show` / `hide`.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `itemClick` | jeder Zeilenklick (unabhängig von selectable) | `event`, `params: { rowId, row }`, `clientId`, `sourceId`, `appId` |
| `itemSelect` | Auswahl wechselt (nur bei selectable) | gleiche Payload |

`rowId` ist die `id` des Elements (sonst der Index); `row` ist das volle Element
inkl. `value`. `itemClick` feuert bei jedem Klick; `itemSelect` nur bei aktivem
`selectable` und Auswahlwechsel — und paart mit dem `selectedId`-Write-Back
(`itemSelect` → `ui-store` set verdrahten).

## Beispiele

### 1. Auswählbare Liste mit Badge-Wert

Fünf statische Items mit numerischem `value` als Badge; die Liste ist auswählbar,
ihre Auswahl wird in einen Store gespiegelt, `itemSelect` an einen Debug-Knoten
verdrahtet.

Flow-Datei: [`examples/guide/ui-list.json`](../../../../examples/guide/ui-list.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-list.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideList/` öffnen — eine Zeile anklicken,
   um sie auszuwählen (sie hebt sich hervor); die `itemSelect`-Payload erscheint
   in der Debug-Sidebar.

## Verwandt

- [Daten anzeigen](../guides/displaying-data.md) — Query-Loop, Tabellen, Listen
- [Aktionen & Events](../guides/actions-events.md) — `itemClick`/`itemSelect` verdrahten
- [`ui-table`](ui-table.md) — Spalten; `ui-repeat` — beliebiger Subtree pro Element
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-list.md`
