# `ui-accordion`

## Zusammenfassung

Rendert aufklappbare Sektionen. Jede Sektion ist ein benannter Slot.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`
- `sections`: Liste von `{ id, label }` — mindestens eine Sektion

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Accordion N"`
- `multiple`: Mehrere Sektionen gleichzeitig offen. Default: `false`
- `defaultOpen`: ID(s) der initial geöffneten Sektionen
- `order`
- layoutabhängige Child-Props. Details in [layout.md](../concepts/layout.md).

## Slots

Für jede Sektion in `sections` wird ein Slot `section:<sectionId>` erzeugt.

## Input

Akzeptiert Component-State-Messages (`show`, `hide`). Format siehe [messages.md](../concepts/messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `sectionOpen` | `event: "sectionOpen"`, `sectionId`, `clientId` |
| `sectionClose` | `event: "sectionClose"`, `sectionId`, `clientId` |
