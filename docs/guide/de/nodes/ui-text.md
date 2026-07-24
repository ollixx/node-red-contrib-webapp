# ui-text

Rendert einen gebundenen Textwert an einem Mount-Ziel — der Arbeitspferd-Anzeigeknoten.

> English (canonical): [nodes/ui-text.md](../../nodes/ui-text.md)

## Zweck

`ui-text` zeigt **einen Textwert** in einem Slot. Der Wert ist bindbar — ein
statisches Literal, ein reaktiver Store-Wert, ein Query-Ergebnis, ein
Routen-Parameter, ein serverseitig aufgelöster Kontext-Wert oder ein per Message
hereingereichter Wert. Zwei orthogonale Achsen steuern die Darstellung:
**Style** legt die typografische *Rolle* fest (Überschrift, Body, Caption,
Label, Code — und damit das gerenderte HTML-Element), **Variante** legt die
semantische *Farbe* fest (wie bei `ui-button`/`ui-badge`). Ein zweiter
Anzeigemodus macht denselben Knoten zu einer read-only gelabelten Formular-Zeile.

## Wann einsetzen

- Ein Label, eine Überschrift, einen Absatz oder irgendeinen einzelnen
  dynamischen Wert in einem Route-, Dialog- oder Container-Slot zeigen.
- Einen Store-Wert oder ein Query-Feld live spiegeln (re-rendert bei Änderung).
- Ein read-only-Feld (z. B. eine `_id`) bündig neben echten Inputs in einem
  Formular zeigen — **Display: Form field**.
- Für wiederholte Datenzeilen stattdessen `ui-table`, `ui-list` oder
  `ui-repeat` — `ui-text` rendert genau einen Wert.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Text N` |
| **Parent Slot** (`mount`) | Slot, in den der Text mountet. Pflicht. | Mount-Pfad `<type>:<id>/<slot>` | — |
| **Text / value** (`value`) | Anzuzeigender Wert. Bindbar über den kanonischen Value-Binding-Typ-Satz. | `string`, `number`, `boolean`, `json`, `timestamp` (statisch); `store`, `query`, `routeParam`, `reactive` (live); `flow`, `global`, `env` (serverseitig einmalig); `msg`, `jsonata` (message-getrieben). `item`/`index`/`prop` nur im `ui-repeat`/Component-Scope. | Literal `""` |
| **On Missing** (`onMissing`) | Was bei `null`/fehlendem Wert erscheint. | `Marker` (`?` zeigen) · `Ignore` (leer) | `Marker` |
| **Style** (`style`) | Typografische Rolle → gerendertes HTML-Element. | `heading-1`…`heading-3`, `body`, `caption`, `label`, `code` | `body` |
| **Variante** (`variant`) | Semantische Farbe (nicht das Element). | `default`, `muted`, `primary`, `success`, `warning`, `danger`, `neutral` | `default` |
| **Display** (`display`) | Anzeigemodus. | `text` (freier Anzeigetext) · `formField` (read-only gelabelte Zeile, gestylt wie die Inputs) | `text` |
| **Field Label** (`label`) | Linke Beschriftung — nur im Modus **Form field** relevant. | Freitext | leer |
| **Visible** (`visible`) | Render-Gate — bindbar; `false` blendet aus. | Binding / Boolean | sichtbar |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot; welche Zeilen erscheinen, hängt vom Layout-Preset ab. | Zahlen | Canvas-y |

`Disabled` und `Size` gelten nicht für einen Text-Knoten (kein interaktiver
Zustand; Größe wird über **Style** gesteuert).

## Eingang

`ui-text` **hat einen Eingangs-Port**. Bei einer Message:

- **`msg.payload`** (nicht-`null`) setzt den angezeigten `value` (serverseitig
  gehalten) und pusht einen frischen Snapshot an alle verbundenen Clients — das
  ist der `msg`-Wert-Quellen-Modus.
- **`msg.ui.patch`** überschreibt Felder der Knoten-Definition (z. B. `value`,
  `variant`); Binding-Felder als Binding-Objekt übergeben.
- **Component-State-Ops** (`msg.ui.component.op`): `show` / `hide` steuern die
  Sichtbarkeit.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-text` hat **keinen Output-Port** und emittiert keine Events. Reiner
Anzeige-Knoten.

## Beispiele

### 1. Statischer und store-gebundener Text

Zwei Text-Knoten: eine Überschrift (statisches Literal) und ein Body-Wert,
gebunden an einen Store, live per Inject aktualisiert.

Flow-Datei: [`examples/guide/ui-text.json`](../../../../examples/guide/ui-text.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-text.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideText/` öffnen — Überschrift und
   Body-Wert erscheinen; Inject klicken, um den Store-Wert zu ändern und das
   Live-Update im Body zu sehen.

## Verwandt

- [Daten anzeigen](../guides/displaying-data.md) — Query-Loop, Tabellen, Listen
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- [Theming & Components](../guides/theming-components.md) — Varianten vs. Farben
- Verwandte Anzeigeknoten: `ui-badge`, `ui-table`, `ui-list`, `ui-repeat`
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-text.md`
