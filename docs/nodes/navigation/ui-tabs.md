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

> **P168 / ADR 0018 (Modell 1a): Kinder definieren die Tabs.** Es gibt **kein**
> `tabs`-JSON-Feld mehr. Jeder Tab ist ein eigener [`ui-tab`](ui-tab.md)-Knoten,
> der in dieses `ui-tabs` gemountet wird. Der Mount **ist** die Deklaration des
> Tabs (kein zweite Quelle der Wahrheit, kein Orphan-Problem). Alte Flows mit
> einem `tabs`-Array werden beim Deploy automatisch migriert (siehe Migration).

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`.
- **Kinder:** ein oder mehrere [`ui-tab`](ui-tab.md)-Knoten, gemountet per `mount: ui-tabs:<tabsId>/content` (der Mount-Picker liefert die äquivalente `container:<tabsId>/content`-Form). Jeder `ui-tab` trägt sein eigenes `label`/`icon`/`order` und einen Default-`content`-Slot für den Tab-Inhalt. „Mounten in ein `ui-tabs` heißt: werde ein Tab."
- **Slot pro Kind:** Der Renderer erzeugt genau einen Tab/Panel je `ui-tab`-Kind; der Slot-Schlüssel ist die **id des Kindes** (zugleich das Token, das `activeTab` trägt). Inhalt eines Tabs mountet in `ui-tab:<tabId>/content`.
- **Eindeutigkeit:** Die ids der `ui-tab`-Kinder eines `ui-tabs` müssen **eindeutig** sein — ein Duplikat ist ein sichtbarer Deploy-Fehler (die id ist der Slot-Schlüssel und der `activeTab`-Wert).
- **Rolle zur Laufzeit:** Der Renderer stellt immer genau den Slot des aktiven Tabs dar und blendet die übrigen aus. Der aktive Tab kann über ein Binding gesteuert werden.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Tabs N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. Legt fest, in welchen Slot des Parents `ui-tabs` selbst platziert wird. |

### Gruppe „Tabs"

> **Kein `tabs`-Feld mehr.** Die Tabs werden aus den gemounteten
> [`ui-tab`](ui-tab.md)-Kindern abgeleitet (P168 / ADR 0018). Lege je Tab einen
> `ui-tab` an und mounte ihn in dieses `ui-tabs`.

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `activeTab` | „Active Tab" | typedInput (Binding, **zweiseitig**) | optional | Zweiseitiges Binding auf die `id` des derzeit aktiven Tabs = die id eines `ui-tab`-Kindes (P155 / ADR 0012): liest den aktiven Tab aus dem gebundenen Store/State **und** der Tab-Wechsel emittiert das Change-Event mit der gewählten Tab-ID für den Write-back-Roundtrip. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Default-Typ: `string`. Ein bestehender `activeTabPath` (plain string) wird automatisch als `state`-Binding übernommen. Default-Wert: **erstes `ui-tab`-Kind nach `order`**. Wird ein ungültiger Wert geliefert, fällt die Komponente auf das erste Kind zurück. |

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
ein Slot pro `ui-tab`-Kind), Hinweis auf das Kinder-Modell (je Tab ein `ui-tab`,
in dieses `ui-tabs` gemountet — „werde ein Tab"), `activeTab`-Binding,
Eindeutigkeit der Tab-ids und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-tabs.md`.

## Migration (P168 / ADR 0018 §5)

Alte Flows mit einem `tabs:[{id,label}]`-Array werden beim Deploy automatisch in
das Kinder-Modell überführt: je Array-Eintrag entsteht ein `ui-tab`-Kind
(`id`/`label` erhalten, gemountet in `ui-tabs:<id>/content`), und Inhalts-Kinder,
die in den alten abgeleiteten Slot `tab:<id>` gemountet waren, werden auf
`ui-tab:<id>/content` umgehängt. Die Migration ist verlustfrei und einmalig; ein
Flow, der bereits im Kinder-Modell vorliegt, bleibt unverändert.

## Dynamische Tabs = ein `ui-repeat` von `ui-tab` (P170 / ADR 0017 × 0018)

Tabs aus **Daten** sind **kein eigenes Feature** und kein „dynamischer Slot": sie
sind die **Komposition** aus [`ui-repeat`](../display/ui-repeat.md) (ADR 0017) und
dem Kinder-definieren-Modell (ADR 0018). Ein `ui-repeat`, dessen Schablone (der
Default-Slot `content`) ein **einzelnes** [`ui-tab`](ui-tab.md) ist und das in
dieses `ui-tabs` gemountet wird, erzeugt **einen Tab je Datenzeile**. Das Tab-
`label` (und der Panel-Inhalt) bindet `item.<feld>` und löst gegen die jeweilige
Zeile auf.

```
ui-tabs (id: viewTabs)
└── ui-repeat            mount: ui-tabs:viewTabs/content
    │                    items:  state  →  view.people   (ein Array)
    │                    keyField: id
    └── ui-tab           mount: container:viewRepeat/content
        │                label: item  →  name            (= item.name)
        └── ui-text      mount: ui-tab:viewTab/content
                         value: item  →  bio             (= item.bio)
```

Für ein Array `[{id:"ada",name:"Ada",bio:"…"}, {id:"lin",name:"Linus",bio:"…"}]`
rendert das **zwei** Tabs „Ada" / „Linus", jeder mit seinem eigenen Panel-Inhalt.

- **Keying/Stabilität:** die sichtbare Tab-Id ist `<itemKey>#<tab-id>` (Repeat-Key
  × Tab-id). Ändert sich das Array (Zeile hinzu/weg/umsortiert), formt sich die
  Tab-Menge um — **keyed**: unveränderte Tabs behalten ihre Id und werden nicht
  neu gemountet (kein Flackern). `activeTab` bleibt gültig, solange seine Zeile
  existiert; verschwindet die Zeile, fällt der aktive Tab auf das erste Kind
  zurück.
- **Statisch + dynamisch mischbar:** ein direkt gemountetes `ui-tab` (statischer
  Tab) und ein `ui-repeat`-von-`ui-tab` (dynamische Tabs) dürfen **gemeinsam**
  unter einem `ui-tabs` hängen; die Reihenfolge richtet sich nach `order`.
- **Kein neuer Mechanismus:** der Container zählt seine Tab-Kinder auf und
  expandiert dabei ein gemountetes `ui-repeat` je Item in genau ein keyed `ui-tab`
  — dieselbe Klon-/Key-Logik wie jeder andere Repeat (ADR 0017 §4).

## Input

`ui-tabs` nimmt Eingangs-Messages entgegen, um seinen Zustand oder seine
Darstellung zu steuern.

- **`msg.payload`** — setzt den aktiven Tab; der Wert muss die `id` eines `ui-tab`-Kindes sein. Ungültige Werte werden ignoriert (Fallback: erstes Kind).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `activeTab`-Binding, `variant`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
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
