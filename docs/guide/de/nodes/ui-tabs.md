# ui-tabs

Eine Tab-Leiste mit einem Inhalts-Slot pro Tab, die Ansichten am Ort wechselt.

> English (canonical): [nodes/ui-tabs.md](../../nodes/ui-tabs.md)

## Zweck

`ui-tabs` rendert eine **Tab-Leiste**. Der aktive Tab bestimmt, welcher Inhalt
sichtbar ist; die anderen sind ausgeblendet. Jeder Tab ist ein eigenes
[`ui-tab`](ui-tab.md)-Kind, das in dieses `ui-tabs` gemountet wird — **in ein
`ui-tabs` mounten heißt: werde ein Tab**. Es gibt kein Tabs-JSON-Feld. Der aktive
Tab ist ein **zweiseitiges Binding** (`activeTab`): es liest die aktive Tab-ID aus
einem Store/State, und der Tab-Wechsel emittiert ein `tabChange`-Event mit der
neuen ID für den Write-back-Roundtrip.

## Wann einsetzen

- Zwischen mehreren Inhaltsabschnitten in einem gemeinsamen Container wechseln
  (Formularbereiche, Arbeitsansichten), ohne wegzunavigieren.
- Den aktiven Tab über Reloads hinweg per Store-Roundtrip persistieren und teilen.
- Für aufklappbare, gestapelte Sektionen (nicht ein-Inhalt-zur-Zeit)
  [`ui-accordion`](ui-accordion.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Tabs N` |
| **Parent Slot** (`mount`) | Slot, in den die Tab-Leiste mountet. Pflicht. | Mount-Pfad | — |
| **Active Tab** (`activeTab`) | **Zweiseitiges** Binding auf die ID des aktiven Tabs (= ID eines `ui-tab`-Kindes). Liest den aktiven Tab; der Tab-Wechsel emittiert `tabChange` für den Write-back-Loop. Ungültiger Wert → erstes Kind. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (Default-Typ `string`) | erstes `ui-tab` nach `order` |
| **Variant** (`variant`) | Nicht-Farb-Darstellung der Leiste, als `data-variant` für Adapter-CSS emittiert (keine Farbrolle). | `line`, `contained`, `pills` | `line` |
| **Events** (`events`) | Aktiviert den `tabChange`-Output-Port. | `tabChange` | keine |
| **Visible** / **Disabled** / **Color** | Basis-Felder. | — | — |

`Size` ist N/A (keine Größen-Stufen). **Tabs kommen aus Kindern:** lege je Tab
einen `ui-tab` an und mounte ihn in dieses `ui-tabs`; der Inhalt des Tabs mountet
in den `content`-Slot dieses `ui-tab`. Die Kind-Tab-IDs müssen **eindeutig** sein
(die ID ist der Slot-Schlüssel und der `activeTab`-Wert).

## Eingang

`ui-tabs` **hat einen Eingangs-Port**:

- **`msg.payload`** — setzt den aktiven Tab; der Wert muss die ID eines
  `ui-tab`-Kindes sein (ungültig → erstes Kind).
- **`msg.ui.patch`** — überschreibt Felder (z. B. `activeTab`-Binding, `variant`).
- **`msg.ui.component.op`** (`show`, `hide`) — schaltet den ganzen Block.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Wenn `tabChange` aktiviert ist, hat `ui-tabs` einen Output-Port:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `tabChange` | Nutzer wechselt den aktiven Tab | `event: "tabChange"`, `params.tabId`, `clientId`, `sourceId`, `appId` |

**Zweiseitiges Write-back:** verdrahte `tabChange` → (`params.tabId` extrahieren) →
`ui-store-action` (`set`) auf denselben Store, den das `activeTab`-Binding liest.
So übersteht der aktive Tab Reloads und bleibt synchron. Ohne aktiviertes Event
emittiert der Knoten nichts.

## Beispiele

### 1. Zwei Tabs mit Store-Write-back-Roundtrip

Eine „Overview"/„Details"-Tab-Leiste. `activeTab` liest einen Store-Wert;
`tabChange` schreibt die gewählte Tab-ID zurück in denselben Store — der
kanonische zweiseitige Loop.

Flow-Datei: [`examples/guide/ui-tabs.json`](../../../../examples/guide/ui-tabs.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-tabs.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideTabs/` öffnen — einen Tab klicken; das
   Panel wechselt und die gewählte Tab-ID wird in den Store geschrieben.

## Verwandt

- [`ui-tab`](ui-tab.md) — ein einzelner Tab (Kind dieses Knotens)
- [`ui-accordion`](ui-accordion.md) — gestapelte aufklappbare Sektionen
- [Bindings & State](../guides/bindings-state.md) — zweiseitige Bindings, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-tabs.md`
