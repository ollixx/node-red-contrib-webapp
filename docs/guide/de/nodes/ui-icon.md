# ui-icon

Rendert ein Icon per symbolischem Namen — icon-set-agnostisch, bindbarer Name und Farbe.

> English (canonical): [nodes/ui-icon.md](../../nodes/ui-icon.md)

## Zweck

`ui-icon` rendert ein **Icon per symbolischem Namen**, unabhängig vom Icon-Set.
Das Renderer-Backend bestimmt, welches Set verwendet wird (Shoelace-System-Icons,
das vendorte Bootstrap-Set, eine registrierte Zusatz-Library); der Knoten kennt
nur den semantischen Namen. Sowohl **Name** als auch **Farbe** sind bindbar,
sodass ein Icon live aus State/Store/Query wechseln kann. Rein präsentational,
emittiert keine Events.

## Wann einsetzen

- Ein Status-/Deko-Icon neben Text oder in einem Button/Listen-Eintrag zeigen.
- Das Icon live anhand von Daten tauschen (ein `state`/`store`-gebundener Name).
- Das Icon auf ein Theme-Token einfärben, sodass es dem App-Theme folgt.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Icon N` |
| **Parent Slot** (`mount`) | Slot, in den das Icon mountet. Pflicht. | Mount-Pfad | — |
| **Icon Name** (`icon`) | Der backend-neutrale Icon-Wert. Pflicht, bindbar (P239). Zwei Wege in einem Control. | **Icon** (literal): ein nackter Name (`home`) nutzt die Default-Library; `library:name` (`lucide:user`) wählt eine registrierte Library; Picker + Vorschau sind literal-only. **Binding**: jede kanonische Art (store/query/routeParam/reactive/msg/flow/global/env) — ein gebundener Name tauscht das Icon live. | — |
| **Color** (`color`) | Die Icon-Farbe — das gemeinsame Standard-Control (ADR 0039). Drei Wege. | **Theme-Token** (`primary`, `success`, `warning`, `danger`, `neutral`, `info`, `muted`) → persistiert `token:<name>`, gerendert `var(--wa-color-<token>)`, folgt dem App-Theme; **Farbe** (beliebiger CSS-Wert über Selector oder getippt); **Binding** (jede kanonische Art — eine gebundene Farbe färbt live). | leer (erbt Textfarbe) |
| **Größe** (`size`) | Icon-Größen-Token. | `xs`, `sm`, `md`, `lg`, `xl` (alte freie CSS-Werte round-trippen) | `md` |
| **Visible** (`visible`) | Render-Gate (bindbar). | Binding | sichtbar |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot. | Zahlen | Canvas-y |

`Disabled` ist N/A (ein Icon hat keinen interaktiven Zustand).

### Das Farbmodell (ADR 0039)

`ui-icon` hat kein `variant`-Feld — die Farbe ist das Basis-Feld `color`, die
**Obermenge**: es bietet die Theme-Tokens **und** jede Farbe an (`variant` ist
die Reduktion auf nur die Tokens). Ein **Theme-Token** (`token:primary`) rendert
als `var(--wa-color-primary)` und folgt den `designTokens` der App, re-themed also
mit ihr; eine freie Farbe (`#ff0000`) ist fix. Ein unbekannter Wert wird ignoriert
(nie ungültiges CSS). Leer ⇒ das Icon erbt die umgebende Textfarbe.

## Eingang

`ui-icon` **hat einen Eingangs-Port**:

- **`msg.ui.component.op`** (`show` / `hide`) — blendet das Icon ein/aus.
- **`msg.ui.patch`** — überschreibt Felder (`icon`, `size`, `color`).
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

Er hat **kein** `msg.payload` als Primärwert.

## Ausgänge / Events

Keine — `ui-icon` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein token-gefärbtes Icon

Ein Icon (`home`) mit dem `primary`-Theme-Token eingefärbt in Größe `lg`.

Flow-Datei: [`examples/guide/ui-icon.json`](../../../../examples/guide/ui-icon.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-icon.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideIcon/` öffnen — das Icon rendert in
   der Primary-Farbe des Themes.

## Verwandt

- [Theming & Components](../guides/theming-components.md) — Design-Tokens, Varianten vs. Farben
- [`ui-image`](ui-image.md) — ein Rasterbild (kein Vektor-Icon)
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-icon.md`
