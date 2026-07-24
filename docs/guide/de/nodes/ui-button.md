# ui-button

Ein klickbarer Button — die Ereignis-Quelle der App oder ein echter Link.

> English: [../../nodes/ui-button.md](../../nodes/ui-button.md)

## Zweck

`ui-button` rendert einen Button. Im Default-Modus ist er eine
**Ereignis-Quelle**: ein Klick verlässt den Output-Port, und der Flow
entscheidet, was passiert. Zwei weitere Link-Modi machen daraus einen Hyperlink
oder eine In-App-Navigation. Die Farbe kommt über **Variant** — die
Konvention „variant = Farbe".

## Wann einsetzen

- Etwas auslösen: speichern, löschen, Dialog öffnen, Flow-Zweig starten.
- In der App navigieren (`linkMode = navigate`) oder sie verlassen
  (`linkMode = url`).
- Die Verdrahtungsmuster hinter einem Klick stehen in
  [Aktionen & Events](../guides/actions-events.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Button N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung des Buttons. Pflicht und **voll bindbar** — Literal oder Store-/Query-/Route-Param-/…-Binding (ein store-gebundenes Label aktualisiert sich live). | Binding / Literal | — |
| **Icon** (`icon`) | Icon im Prefix-Slot des Buttons. Backend-neutral `library:name` (ein nackter Name nutzt die Default-Library); ein Picker-Button öffnet die Icon-Auswahl. Bindbar. | Binding / `plus` / `lucide:user` | leer |
| **Disabled** (`disabled`) | Bindbarer Boolean. Löst er zu `true` auf, ist der Button deaktiviert und emittiert **keine** Click-Events. | Binding (Boolean-Satz) | ungesetzt |
| **Variant** (`variant`) | Semantische Rolle **und Farbe**. | `primary` / `secondary` / `success` / `danger` / `warning` / `neutral` / `ghost` / `link` | `neutral` |
| **Size** (`size`) | Dreistufige Größe. Leer = Backend-Default. | `(default)` / `sm` / `md` / `lg` | leer |
| **Outline** (`outline`) | Zeichnet den Button mit Kontur statt Füllung. Unabhängig von der Variant-Darstellung. | Checkbox | `false` |
| **Link Mode** (`linkMode`) | `button` = Ereignis-Quelle (Klick am Output-Port); `url` = echter Hyperlink (rendert ein `<a>`); `navigate` = clientseitige In-App-Navigation zur Route in **URL / Route**, der Klick wird *zusätzlich* an den Flow gemeldet. | `button` / `url` / `navigate` | `button` |
| **URL / Route** (`href`) | Ziel für `url` / `navigate`. Bindbar. Der Editor zeigt diese Zeile nur in diesen beiden Modi. | Binding / Literal | leer |
| **Visible** (`visible`) | Bindbares Render-Gate — **siehe [Bekannte Lücken](#bekannte-lücken): es wirkt bei `ui-button` derzeit nicht.** | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-button` hat **kein `color`-Basisfeld** — das ist Absicht: die Farbe kommt
aus **Variant**.

> **Veraltet:** ein `action`-Feld (direkte Action-ID-Referenz) wird vom Schema
> aus Kompatibilitätsgründen noch akzeptiert. Neue Flows verdrahten stattdessen
> den Output-Port mit einem [`ui-action`](ui-action.md)-Knoten.

## Eingang

`ui-button` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable` — schaltet Sichtbarkeit / Interaktivität, ohne das Binding zu ändern. |
| `msg.ui.patch` | Überschreibt beliebige Felder der Knoten-Definition. |
| `msg.payload` (nicht null) | *Contract:* überschreibt das `label`. **Gemessen (P236): erreicht den Client nicht** — siehe [Bekannte Lücken](#bekannte-lücken). |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-button` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui` |
|---|---|---|
| `click` | Nutzer klickt den Button und er ist nicht deaktiviert | `event: "click"`, `sourceId`, `appId`, `clientId` |

`msg.ui.params` ist bei `click` **leer** — der Button transportiert keine
eigenen Nutzdaten. Weitere Daten (Formularstand, gewählte ID) liefern
verdrahtete `ui-store`-/`ui-query`-Knoten. Im `navigate`-Modus navigiert der
Klick **und** emittiert das Event.

## Bekannte Lücken

Im Konformitäts-Pass P236 gemessen; beide sind durch Tests fixiert, die das
*reale* Verhalten asserten — sie werden grün, sobald der Bug behoben ist:

- **`visible` schaltet das Rendering nicht.** `ui-button` gehört zu den
  hand-verzweigten Knotentypen, deren Config-Mapping `visible` nie an das
  Render-Gate der Runtime verdrahtet. Ein gebundenes `visible = false` wird
  verworfen, der Button rendert trotzdem. Bis zum Fix
  `msg.ui.component.op: "hide"` oder einen bedingten Container nutzen.
- **`msg.payload` aktualisiert das Label nicht.** Der Live-View-Patch trägt das
  Feld `label` nicht mit; eine payload-getriebene Label-Änderung erreicht den
  Browser nie. Stattdessen **Label** an einen Store-Slice binden und den Store
  schreiben.

Das fehlende `color` ist **keine** Lücke — es ist die Variant-Konvention.

## Beispiele

### 1. Ein Klick, der einen Dialog öffnet, plus ein Link-Button

Zwei Buttons: ein `primary`-Button, verdrahtet an eine `ui-action`, die einen
Dialog öffnet, und ein Button der Variante `link` im `url`-Modus, der auf eine
externe Seite zeigt.

Flow-Datei: [`examples/guide/ui-button.json`](../../../../examples/guide/ui-button.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-button.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideButton/` öffnen und beide Buttons klicken.

## Verwandt

- [Aktionen & Events](../guides/actions-events.md) — woran man einen Klick verdrahtet
- [`ui-action`](ui-action.md) — der übliche Folgeknoten
- [`ui-dialog`](ui-dialog.md) — ein häufiges Klick-Ziel
- [Theming & Komponenten](../guides/theming-components.md) — das Variant-Vokabular
- Contract-Doc (intern, Deutsch): `docs/nodes/display/ui-button.md`
