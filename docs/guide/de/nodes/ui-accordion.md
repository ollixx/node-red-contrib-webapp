# ui-accordion

Eine Liste aufklappbarer Abschnitte — gestapelte Panels, die am Ort auf- und
zuklappen.

> English (canonical): [nodes/ui-accordion.md](../../nodes/ui-accordion.md)

## Zweck

`ui-accordion` rendert eine **Liste aufklappbarer Abschnitte**. Jeder Abschnitt
hat einen Header und einen Inhalts-Slot; offene Abschnitte zeigen ihren Inhalt,
geschlossene blenden ihn aus. Jeder Abschnitt ist ein eigenes
[`ui-accordion-section`](ui-accordion-section.md)-Kind, das in dieses Accordion
gemountet wird — **in ein `ui-accordion` mounten heißt: werde eine Sektion**. Die
offene Sektion ist ein **zweiseitiges Binding** (`openSection`). Im Einzel-Modus
(`multiple: false`, Default) **schließt** das Öffnen einer Sektion die anderen —
das ist echtes Verhalten.

## Wann einsetzen

- FAQ-artige Inhalte, gegliederte Einstellungen oder gestapelte Abschnitte, die am
  Ort aufklappen, ohne wegzunavigieren.
- Immer nur eine Sektion offen halten (Default) oder mehrere erlauben
  (`Allow Multiple Open`).
- Für den Wechsel ganzer Ansichten nacheinander in einer Leiste
  [`ui-tabs`](ui-tabs.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Accordion N` |
| **Parent Slot** (`mount`) | Slot, in den das Accordion mountet. Pflicht. | Mount-Pfad | — |
| **Open Section** (`openSection`) | **Zweiseitiges** Binding auf die ID der offenen Sektion (= ID eines Sektions-Kindes). Liest die offene Sektion; ein Sektions-Wechsel emittiert ein Event für den Write-back-Loop. Ungültig → erste Sektion. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (Default-Typ `string`) | erste Sektion nach `order` |
| **Allow Multiple Open** (`multiple`) | `true` — mehrere Sektionen gleichzeitig offen. `false` — nur `openSection` ist offen (Öffnen einer schließt die anderen). | Checkbox | aus (Einzel-Modus) |
| **Events** (`events`) | Aktiviert die `sectionOpen`/`sectionClose`-Output-Ports. | `sectionOpen`, `sectionClose` | keine |
| **Visible** / **Disabled** / **Color** | Basis-Felder. | — | — |

`Size` ist N/A (keine Größen-Stufen). **Sektionen kommen aus Kindern:** lege je
Sektion einen `ui-accordion-section` an und mounte ihn in dieses Accordion; der
Inhalt der Sektion mountet in den `content`-Slot dieses Kindes. Die Sektions-IDs
müssen **eindeutig** sein (die ID ist der Slot-Schlüssel und der
`openSection`-Wert).

## Eingang

`ui-accordion` **hat einen Eingangs-Port**:

- **`msg.payload`** — setzt die offene Sektion; der Wert muss die ID eines
  Sektions-Kindes sein (ungültig → erste Sektion).
- **`msg.ui.patch`** — überschreibt Felder (z. B. `openSection`-Binding, `multiple`).
- **`msg.ui.component.op`** — `show`, `hide` schalten den ganzen Block; `open`,
  `close` öffnen/schließen eine Sektion über ihr `part` (= Sektions-ID).
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `sectionOpen` | Nutzer öffnet eine Sektion | `event: "sectionOpen"`, `params.sectionId`, … |
| `sectionClose` | Nutzer schließt eine Sektion | `event: "sectionClose"`, `params.sectionId`, … |

**Zweiseitiges Write-back:** verdrahte `sectionOpen` → (`params.sectionId`
extrahieren) → `ui-store-action` (`set`) auf den Store, den das
`openSection`-Binding liest. Ohne aktiviertes Event emittiert der Knoten nichts.

## Beispiele

### 1. Ein Einzel-Modus-FAQ mit Store-Write-back

Drei FAQ-Sektionen, Einzel-Modus (Öffnen einer schließt die anderen).
`openSection` liest einen Store-Wert; `sectionOpen` schreibt die geöffnete ID
zurück — der zweiseitige Loop.

Flow-Datei: [`examples/guide/ui-accordion.json`](../../../../examples/guide/ui-accordion.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-accordion.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideAccordion/` öffnen — eine Sektion
   öffnen; die anderen klappen zu und die geöffnete ID wird in den Store
   geschrieben.

## Verwandt

- [`ui-accordion-section`](ui-accordion-section.md) — eine einzelne Sektion (Kind)
- [`ui-tabs`](ui-tabs.md) — ganze Ansichten nacheinander wechseln
- [Bindings & State](../guides/bindings-state.md) — zweiseitige Bindings, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-accordion.md`
