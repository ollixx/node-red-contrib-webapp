# `ui-stepper`

## Zusammenfassung

Rendert einen mehrstufigen Prozessindikator. Jeder Schritt ist ein benannter Slot.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `steps`: Liste von `{ id, label }` — mindestens zwei Schritte
- `activeStep`: Binding auf die ID des aktiven Schritts

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Stepper N"`
- `variant`: `horizontal | vertical`. Default: `horizontal`
- `linear`: Nur sequentielles Durchlaufen erlaubt. Default: `true`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Slots

Für jeden Schritt in `steps` wird ein Slot `step:<stepId>` erzeugt.

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `stepChange` | `event: "stepChange"`, `stepId`, `previousStepId`, `clientId` |
| `complete` | `event: "complete"`, `clientId` |
