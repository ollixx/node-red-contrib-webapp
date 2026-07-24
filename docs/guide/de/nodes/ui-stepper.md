# ui-stepper

Ein mehrstufiger Prozessindikator (Wizard-Leiste), der den Nutzer durch eine
geordnete Folge von Schritten führt.

> English (canonical): [nodes/ui-stepper.md](../../nodes/ui-stepper.md)

## Zweck

`ui-stepper` rendert eine **Wizard-Leiste** für eine geordnete Folge von
Schritten. Jeder Schritt hat einen Inhalts-Slot; nur der Slot des aktiven
Schritts wird gezeigt. Der aktive Schritt ist ein **zweiseitiges Binding**
(`activeStep`) — ändere ihn und die Ansicht wechselt; ein Step-Klick emittiert ein
`stepChange`-Event für den Write-back-Loop. Die Schritte werden durch ein kleines
JSON-Array (`id` + `label`) definiert; Kinder mounten in `step:<id>`-Slots.

## Wann einsetzen

- Mehrseitige Formulare, Checkout-Prozesse, geführte Konfigurationsdialoge.
- Fortschritt durch eine geordnete Folge zeigen und dabei nur den aktiven Schritt
  rendern.
- Für freien Wechsel zwischen gleichrangigen Ansichten (kein geordneter Prozess)
  [`ui-tabs`](ui-tabs.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Stepper N` |
| **Parent Slot** (`mount`) | Slot, in den der Stepper mountet. Pflicht. | Mount-Pfad | — |
| **Steps (JSON array)** (`steps`) | Die geordneten Schritte, je `{ "id", "label" }`. Mindestens zwei; IDs eindeutig. Jede ID erzeugt einen `step:<id>`-Slot und ist das `activeStep`-Token. Pflicht. | JSON-Array | — |
| **Active Step** (`activeStep`) | **Zweiseitiges** Binding auf die aktive Schritt-ID. Liest den aktiven Schritt; der Step-Klick schreibt zurück (Roundtrip). Ungültig → erster Schritt. Pflicht. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` | erster Schritt |
| **Orientation** (`orientation`) | Ausrichtung der Leiste. **Real** (P251): `horizontal` legt Schritte nebeneinander, `vertical` untereinander. Intern als `variant` abgelegt. | `horizontal`, `vertical` | `horizontal` |
| **Events** (`events`) | Aktiviert den `stepChange`-Output-Port. | `stepChange` | keine |
| **Visible** / **Color** | Basis-Felder. | — | — |

`Disabled` und `Size` sind N/A (ein Stepper zeigt Fortschritt und hat keinen
Deaktiviert-Zustand oder Größen-Stufen). Ein früheres `complete`-Event und ein
totes `linear`-Feld wurden **entfernt** (P251) — keine DOM-Quelle löste `complete`
aus, und `linear` wurde nie durchgesetzt; Legacy-Flows werden verlustfrei
bereinigt.

## Eingang

`ui-stepper` **hat einen Eingangs-Port**:

- **`msg.payload`** — setzt den aktiven Schritt; der Wert muss eine der
  `steps`-IDs sein.
- **`msg.ui.patch`** — überschreibt Felder (z. B. `steps`, `variant`).
- **`msg.ui.component.op`** (`show`, `hide`) — schaltet den ganzen Block.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Wenn `stepChange` aktiviert ist, hat `ui-stepper` einen Output-Port:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `stepChange` | Nutzer klickt einen anderen Schritt | `event: "change"`, `params.value` (der Schritt-**Index**), `clientId`, `sourceId`, `appId` |

Beachte die Form: das DOM-Event trägt `params.value` = den Schritt-**Index**
(während `activeStep`/`msg.payload` einen Schritt über seine **ID** adressieren).
Verdrahte `stepChange` → `ui-store-action` (`set`) auf den Store, den das
`activeStep`-Binding liest, um den Loop zu schließen. Es gibt kein
`complete`-Event — verdrahte den Prozessabschluss stattdessen aus einem
„Fertig"-Button im Slot des letzten Schritts.

## Beispiele

### 1. Ein dreistufiger Wizard mit Store-Write-back

Ein Account/Profile/Confirm-Stepper. `activeStep` liest einen Store-Wert;
`stepChange` schreibt den Wechsel zurück — der zweiseitige Loop.

Flow-Datei: [`examples/guide/ui-stepper.json`](../../../../examples/guide/ui-stepper.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-stepper.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideStepper/` öffnen — der Wizard rendert
   mit dem Inhalt des aktiven Schritts; ein Step-Klick emittiert `stepChange`.

## Verwandt

- [`ui-tabs`](ui-tabs.md) — freier Wechsel zwischen gleichrangigen Ansichten
- [Bindings & State](../guides/bindings-state.md) — zweiseitige Bindings, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-stepper.md`
