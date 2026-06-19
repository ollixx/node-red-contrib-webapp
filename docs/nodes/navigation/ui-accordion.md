# `ui-accordion`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-accordion` rendert eine **Liste aufklappbarer Abschnitte** (Sektionen). Jeder
Abschnitt hat einen Header (Bezeichnung) und einen Inhalts-Slot, in den View-Knoten
gemountet werden. Geöffnete Abschnitte zeigen ihren Inhalt; geschlossene blenden
ihn aus. Die Komponente eignet sich für FAQ-artige Strukturen, gegliederte
Einstellungsseiten und jeden anderen Fall, in dem mehrere Inhaltsbereiche
platzsparend untereinander angeordnet werden sollen, ohne zwischen Ansichten zu
navigieren.

## Einordnung

> **P169 / ADR 0018 (Modell 1a): Kinder definieren die Sektionen.** Es gibt
> **kein** `sections`-JSON-Feld mehr. Jede Sektion ist ein eigener
> [`ui-accordion-section`](ui-accordion-section.md)-Knoten, der in dieses
> `ui-accordion` gemountet wird. Der Mount **ist** die Deklaration der Sektion
> (keine zweite Quelle der Wahrheit, kein Orphan-Problem). Alte Flows mit einem
> `sections`-Array werden beim Deploy automatisch migriert (siehe Migration).
> Spiegelt [`ui-tabs`](ui-tabs.md).

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`.
- **Kinder:** ein oder mehrere [`ui-accordion-section`](ui-accordion-section.md)-Knoten, gemountet per `mount: ui-accordion:<accId>/content` (der Mount-Picker liefert die äquivalente `container:<accId>/content`-Form). Jede Sektion trägt ihr eigenes `label`/`icon`/`order` und einen Default-`content`-Slot für den Sektions-Inhalt. „Mounten in ein `ui-accordion` heißt: werde eine Sektion."
- **Slot pro Kind:** Der Renderer erzeugt genau eine aufklappbare Sektion je Kind; der Slot-Schlüssel ist die **id des Kindes** (zugleich das Token, das `openSection` trägt). Inhalt einer Sektion mountet in `ui-accordion-section:<sectionId>/content`.
- **Eindeutigkeit:** Die ids der Sektions-Kinder eines `ui-accordion` müssen **eindeutig** sein — ein Duplikat ist ein sichtbarer Deploy-Fehler (die id ist der Slot-Schlüssel und der `openSection`-Wert).
- **Rolle zur Laufzeit:** Der Renderer stellt pro Sektion einen Header (`<sl-details>`-Summary) und — bei geöffnetem Zustand — den zugehörigen Inhalt dar. Im Einzel-Modus (`multiple: false`) ist genau die `openSection` offen.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Accordion N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. Legt fest, in welchen Slot des Parents `ui-accordion` selbst platziert wird. |

### Gruppe „Sektionen"

> **Kein `sections`-Feld mehr.** Die Sektionen werden aus den gemounteten
> [`ui-accordion-section`](ui-accordion-section.md)-Kindern abgeleitet (P169 /
> ADR 0018). Lege je Sektion einen `ui-accordion-section` an und mounte ihn in
> dieses `ui-accordion`.

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `openSection` | „Open Section" | typedInput (Binding, **zweiseitig**) | optional | Zweiseitiges Binding auf die `id` der derzeit offenen Sektion = die id eines `ui-accordion-section`-Kindes (analog `ui-tabs` `activeTab`, P155 / ADR 0012): liest die offene Sektion aus dem gebundenen Store/State **und** der Sektions-Wechsel emittiert das Change-Event mit der gewählten Sektions-ID für den Write-back-Roundtrip. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Default-Typ: `string`. Ein bestehender `openSectionPath` (plain string) wird automatisch als `state`-Binding übernommen. Default-Wert: **erste Sektion nach `order`**. Wird ein ungültiger Wert geliefert, fällt die Komponente auf die erste Sektion zurück. |
| `multiple` | „Allow Multiple Open" | Checkbox | optional | `true` — mehrere Sektionen können gleichzeitig offen sein. `false` (Default) — nur die `openSection` ist offen. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `sectionOpen`, `sectionClose`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-accordion"`-Hilfetext soll knapp sein: Zweck (aufklappbare
Abschnitte, ein Slot pro Sektions-Kind), Hinweis auf das Kinder-Modell (je Sektion
ein `ui-accordion-section`, in dieses `ui-accordion` gemountet — „werde eine
Sektion"), `openSection`-Binding, Eindeutigkeit der Sektions-ids und ein Link auf
die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-accordion.md`.

## Migration (P169 / ADR 0018 §5)

Alte Flows mit einem `sections:[{id,label}]`-Array werden beim Deploy automatisch
in das Kinder-Modell überführt: je Array-Eintrag entsteht ein
`ui-accordion-section`-Kind (`id`/`label` erhalten, gemountet in
`ui-accordion:<id>/content`), und Inhalts-Kinder, die in den alten abgeleiteten
Slot `section:<id>` gemountet waren, werden auf
`ui-accordion-section:<id>/content` umgehängt. Die Migration ist verlustfrei und
einmalig; ein Flow, der bereits im Kinder-Modell vorliegt, bleibt unverändert.

## Dynamische Sektionen = ein `ui-repeat` von `ui-accordion-section` (P170 / ADR 0017 × 0018)

Sektionen aus **Daten** sind **kein eigenes Feature** und kein „dynamischer Slot":
sie sind die **Komposition** aus [`ui-repeat`](../display/ui-repeat.md) (ADR 0017)
und dem Kinder-definieren-Modell (ADR 0018) — spiegelbildlich zu
[`ui-tabs`](ui-tabs.md). Ein `ui-repeat`, dessen Schablone (der Default-Slot
`content`) ein **einzelnes** [`ui-accordion-section`](ui-accordion-section.md) ist
und das in dieses `ui-accordion` gemountet wird, erzeugt **eine Sektion je
Datenzeile**. Das Sektions-`label` (und der Inhalt) bindet `item.<feld>`.

```
ui-accordion (id: faqAcc)
└── ui-repeat                  mount: ui-accordion:faqAcc/content
    │                          items:  state  →  faq.entries   (ein Array)
    │                          keyField: id
    └── ui-accordion-section   mount: container:faqRepeat/content
        │                      label: item  →  question        (= item.question)
        └── ui-text            mount: ui-accordion-section:faqSection/content
                               value: item  →  answer          (= item.answer)
```

Für ein Array `[{id:"a",question:"…",answer:"…"}, {id:"b",…}]` rendert das **zwei**
Sektionen, jede mit ihrem eigenen Inhalt.

- **Keying/Stabilität:** die sichtbare Sektions-Id ist `<itemKey>#<section-id>`
  (Repeat-Key × Sektions-id). Array-Änderungen (Zeile hinzu/weg/umsortiert) formen
  die Sektions-Menge um — **keyed**: unveränderte Sektionen behalten ihre Id (kein
  Re-Mount). Der offene-Sektion-Zustand bleibt gültig, solange seine Zeile
  existiert, sonst Fallback auf die erste Sektion.
- **Statisch + dynamisch mischbar** unter einem `ui-accordion` (Reihenfolge per
  `order`).
- **Kein neuer Mechanismus:** der Container expandiert ein gemountetes `ui-repeat`
  je Item in genau eine keyed Sektion — dieselbe Klon-/Key-Logik wie jeder andere
  Repeat (ADR 0017 §4).

## Input

- **`msg.payload`** — setzt die offene Sektion; der Wert muss die `id` eines `ui-accordion-section`-Kindes sein. Ungültige Werte werden ignoriert (Fallback: erste Sektion).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `openSection`-Binding, `multiple`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit des gesamten Accordion-Blocks; `open`, `close` öffnen/schließen eine Sektion über deren `part` (= Sektions-id). Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Nutzer eine Sektion
öffnet oder schließt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `sectionOpen` | Nutzer öffnet eine Sektion | `event: "sectionOpen"`, `params.sectionId`, `clientId`, `sourceId`, `appId` | Lazy-Daten für die geöffnete Sektion laden |
| `sectionClose` | Nutzer schließt eine Sektion | `event: "sectionClose"`, `params.sectionId`, `clientId`, `sourceId`, `appId` | Sektions-spezifischen Zustand aufräumen |

Solange kein Event aktiviert ist, emittiert der Knoten nichts.

**Antizipierte Wiring-Szenarien:**
- `sectionOpen` → `ui-store` (`set`, `path: "openSection"`) → das `openSection`-Binding liest denselben Store-Wert zurück → reaktive Synchronisierung über Seitenneuladen hinaus.
- `sectionOpen` → `function`-Knoten, der aus `msg.ui.params.sectionId` erkennt, welche Daten geladen werden sollen (Lazy-Loading).

## Theming

`ui-accordion` rendert Header-Zeilen und Aufklapp-Bereiche (Shoelace
`<sl-details>`); das Theme (Design-Tokens) wird von der Parent-App geerbt. Es gibt
keinen eigenen `variant`- oder `displayType`-Wert — das visuelle Erscheinungsbild
wird ausschließlich über Design-Tokens gesteuert. Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [ui-accordion-section.md](ui-accordion-section.md) — das Sektions-Kind (`label`, `icon`, `order`, `content`-Slot)
- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten für `openSection`
- [editor.md](../concepts/editor.md) — Mount-Picker, typedInput, Event-Checkboxen
- [composition.md](../concepts/composition.md) — Naht-Verträge der Container-Knoten (Scope/Mount/Re-Id/Slot-Layout, ADR 0024)

## Offene Punkte

- Animationsdauer und -art (Ease, Slide, Fade) sind noch nicht über Tokens spezifiziert.
- Lazy-Loading von Sektions-Inhalten (Slot erst rendern, wenn Sektion erstmals geöffnet) ist noch nicht modelliert.
- Dynamische Sektionen (ein `ui-repeat`, das `ui-accordion-section`-Kinder emittiert) sind separat (P170 / ADR 0018 §2).
