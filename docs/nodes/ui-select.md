# `ui-select`

## Zusammenfassung

Rendert ein Dropdown- oder Combobox-Eingabefeld mit konfigurierbaren Optionen.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht.

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `label`
- `value`: Binding auf den aktuell gewählten Wert

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Select N"`
- `options`: statische Liste von `{ label, value }`-Objekten oder Binding auf ein Store-/Query-Array
- `placeholder`: Hinweistext wenn kein Wert gewählt
- `multiple`: Mehrfachauswahl erlaubt
- `searchable`: Filter-Input im Dropdown
- `disabled`
- `order`
- layoutabhängige Child-Props. Details in [layout.md](layout.md).

## Input

Akzeptiert Component-State-Messages (`show`, `hide`, `enable`, `disable`). Format siehe [messages.md](messages.md).

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `change` | `event: "change"`, `value`, `clientId` |
