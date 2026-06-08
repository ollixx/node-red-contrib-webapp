# `ui-tabs`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-tabs` rendert eine **Tab-Leiste** mit einem Slot pro Tab. Der aktive Tab
bestimmt, welcher Inhalt sichtbar ist; alle anderen Slots sind ausgeblendet. Die
Tab-Leiste eignet sich überall dort, wo mehrere Inhaltsabschnitte platzsparend
in einem gemeinsamen Container wechseln sollen — von einfachen Formularbereichen
bis hin zu mehrspaltigen Arbeitsansichten.

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`.
- **Kinder:** View-Knoten mounten per `mount: tab:<tabId>` in den Slot des jeweiligen Tabs. Slots werden aus der `tabs`-Liste abgeleitet: ein Tab mit `id: "details"` erzeugt den Slot `tab:details`.
- **Rolle zur Laufzeit:** Der Renderer stellt immer genau den Slot des aktiven Tabs dar und blendet die übrigen aus. Der aktive Tab kann über ein Binding gesteuert werden.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Tabs N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. Legt fest, in welchen Slot des Parents `ui-tabs` selbst platziert wird. |

### Gruppe „Tabs"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `tabs` | „Tabs (JSON array)" | Textfeld (JSON) | **ja** | Geordnete Liste der Tabs. Jedes Element hat die Form `{ "id": "<bezeichner>", "label": "<anzeigename>" }`. Mindestens ein Tab erforderlich. Die `id` muss innerhalb des Knotens eindeutig sein; sie bestimmt den Slot-Namen (`tab:<id>`) und ist das Token, das `activeTab` trägt. |
| `activeTab` | „Active Tab Path" | typedInput (Binding) | optional | Binding auf die `id` des derzeit aktiven Tabs. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Default: erster Tab der Liste. Wird ein ungültiger Wert geliefert, fällt die Komponente auf den ersten Tab zurück. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `variant` | „Variant" | Variant-SelectBox | optional | Visueller Stil der Tab-Leiste: `line` (Unterstrich-Indikator, Standard), `contained` (Pill-ähnlich mit Hintergrund), `pills` (freistehendes Pill-Design). Default: `line`. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-tabs"`-Hilfetext soll knapp sein: Zweck (Tab-Leiste,
ein Slot pro Tab), Hinweis auf `tabs`-JSON-Format (`id`/`label`) und `activeTab`-Binding,
Hinweis auf Child-Mounting (`tab:<id>`) und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-tabs.md`.

## Input

`ui-tabs` nimmt Eingangs-Messages entgegen, um seinen Zustand oder seine
Darstellung zu steuern.

- **`msg.payload`** — setzt den aktiven Tab; der Wert muss einer der `id`-Werte aus der `tabs`-Liste sein. Ungültige Werte werden ignoriert.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `tabs`, `activeTab`-Binding, `variant`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit des gesamten `ui-tabs`-Blocks. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-tabs` hat einen konfigurierbaren Output-Port. Aktivierbare Events (via
Event-Checkboxen in der Konfiguration):

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `tabChange` | Nutzer wechselt den aktiven Tab | `event: "tabChange"`, `params.tabId`, `clientId`, `sourceId`, `appId` | Tab-Wechsel in einen `ui-store` schreiben; Daten für den neuen Tab laden |

Solange kein Event aktiviert ist, emittiert der Knoten nichts. Jedes aktive Event
erzeugt einen eigenen Output-Port; die Port-Reihenfolge entspricht der
Konfigurationsreihenfolge.

**Antizipierte Wiring-Szenarien:**
- `tabChange` → `ui-store` (`set`, `path: "activeTab"`) → das `activeTab`-Binding der `ui-tabs` liest denselben Store-Wert zurück → reaktive Synchronisierung über Seitenneuladen hinaus.
- `tabChange` → `function`-Knoten, der tab-spezifische Daten per `ui-query` nachlädt.

## Theming

`ui-tabs` rendert eine Tab-Leiste; das Theme wird von der Parent-App (Design-Tokens) geerbt.
Der `variant`-Wert (`line`, `contained`, `pills`) steuert die visuelle Ausprägung unabhängig
vom Token-Set. Rendert das Backend die Tabs (z. B. Shoelace `<sl-tab-group>`), wird der
Variant-Wert auf die Backend-Variante abgebildet; nicht erkannte Werte fallen auf `line` zurück.
Details: [theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten (`state`, `store`, `query`, `routeParam`)
- [editor.md](../concepts/editor.md) — typedInput, Variant-SelectBox, Mount-Picker

## Offene Punkte

- Keyboard-Navigation (Tab-Fokus, Arrow-Keys) ist noch nicht spezifiziert.
- Lazy-Loading von Tab-Inhalten (Slot erst rendern, wenn Tab erstmals betreten) ist noch nicht modelliert.
- Ob `ui-tabs` selbst Route-Parameter setzen kann (Navigation zu Tab via URL-Fragment), ist noch offen.
