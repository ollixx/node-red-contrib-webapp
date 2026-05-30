# `ui-table`

## Zusammenfassung

Rendert tabellarische Query-Daten und emittiert konfigurierbare Zeilen-Events als Node-RED-Messages.

Aktuelles MVP-Verhalten:
- Erwartet eine Zeilenliste über ein Query-Binding.
- Kann pro Zeile eine Action beim Selektieren auslösen.
- Treibt im CRUD-Beispiel die Listen- und Detailnavigation.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`: Pflicht. Der Knoten wird in einen Slot des gewählten Parent-Knotens eingehängt. `ui-app` fungiert dabei als implizite Route `"/"` und kann direkt als Parent verwendet werden.

**Gemeinsam genutzte Services und Komponenten:**
- Query-Binding für Zeilendaten (`rows`)
- Emittiert konfigurierbare Events als Messages an Out-Ports

## Editor

**Pflichtfelder:**
- `parent`: Auswahl eines Slots aus allen `ui-app`-, `ui-route`-, `ui-dialog`- und `ui-container`-Knoten. Die Einträge werden hierarchisch (App → Route/Dialog → Container) aufgelistet. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `columns`: Liste der anzuzeigenden Spalten. Jeder Eintrag ist gleichzeitig der Spaltenheader **und** der Property-Key, der im Zeilenobjekt nachgeschlagen wird. Eingabe als komma- oder zeilengetrennte Liste. Beispiel: `name, email, city` → rendert `row.name`, `row.email`, `row.city`.
  - Mindestens eine Spalte erforderlich.
- `rows`: Binding-Ausdruck der zu einem Array von Objekten aufgelöst wird. Jedes Objekt sollte die in `columns` deklarierten Keys enthalten. Typischer Wert: `query:customers.list`. Fehlende Keys werden als leerer String gerendert.

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Table N"` (fortlaufende Nummer aller ui-table-Knoten, startend bei 1)
- `events`: Mehrfachauswahl der zu emittierenden Events. Pro aktivem Event erscheint ein Out-Port am Knoten. Verfügbare Events:
  - `rowSelect`: Zeile angeklickt — Payload: `{ rowId, rowData }`
  - `rowAction`: Button in einer Zeile geklickt — Payload: `{ rowId, rowData, action }`
  - `checkboxChange`: Checkbox-Spalte geändert — Payload: `{ rowId, col, checked }`
  - `cellSelect`: Einzelne Zelle angeklickt — Payload: `{ rowId, col, value }`
- `selectAction` _(deprecated)_: Ersetzt durch `events: [rowSelect]`. Wird vorerst weiter unterstützt, aber nicht für neue Flows empfohlen.
- `footer`: Aktiviert einen Footer-Slot unterhalb der Tabelle. Beliebige View-Knoten können dort als Parent `ui-table/footer` verwenden — für Pagination, Aggregationen oder freien Inhalt.
  - Default: `false`
- `order`
- layoutabhängige Child-Props: sichtbar abhängig vom Layout-Preset des gewählten Parent — `row`, `col`, `colSize`, `rowSize` (grid) bzw. `layoutX`, `layoutY` (absolute). Details in [layout.md](../concepts/layout.md).

## Input

## Output

Pro aktivem Event ein Out-Port. Die Message enthält immer `msg.ui.event` mit dem Event-Namen und `msg.ui.clientId`, plus event-spezifische Felder:

| Event | `msg.ui`-Felder |
|---|---|
| `rowSelect` | `event: "rowSelect"`, `rowId`, `rowData` |
| `rowAction` | `event: "rowAction"`, `rowId`, `rowData`, `action` |
| `checkboxChange` | `event: "checkboxChange"`, `rowId`, `col`, `checked` |
| `cellSelect` | `event: "cellSelect"`, `rowId`, `col`, `value` |

## Zeilen-Elemente: Checkboxen, Row-Actions (Konzept für spätere Versionen)

Heute gibt es keine Möglichkeit, zusätzliche Elemente pro Zeile zu rendern — weder Checkboxen noch Row-Buttons. `selectAction` löst nur eine einzelne Aktion auf die ganze Zeile aus.

Für spätere Versionen sind zwei Ausbaustufen vorgesehen:

### Stufe 1: Strukturierte Spaltendefinition

`columns` wird von einer String-Liste zu einer strukturierten Definition erweitert — rückwärtskompatibel: ein einfacher String bleibt weiterhin gültig und wird als `{ key, label: key }` interpretiert.

Eine vollständige Spaltendefinition:

```yaml
columns:
  - key: name          # Property-Key im Zeilenobjekt
    label: Name        # Angezeigter Header-Text (optional, Default: key)
    sortable: true     # Spalte ist sortierbar
    filterable: true   # Spalte hat einen Filter-Input im Header
    width: 200         # Breite in px (optional)
  - key: active
    label: Aktiv
    type: checkbox     # Zellen-Renderer
  - type: actions      # Keine Datenspalte, nur Buttons
    actions:
      - label: Bearbeiten
        action: editCustomer
      - label: Löschen
        action: deleteCustomer
```

Verfügbare `type`-Werte: `text` (Default), `checkbox`, `number`, `date`, `actions`.

### Stufe 2: Row-Template-Knoten (`ui-table-row`)

Für komplexe Zeileninhalte definiert ein eigener `ui-table-row`-Knoten das Template einer Zeile. Darin können beliebige View-Knoten hängen, die über einen `rowData`-Binding-Kontext auf die Felder des aktuellen Datensatzes zugreifen:

```
ui-table
  └── ui-table-row
        ├── ui-text:   value = rowData.name
        ├── ui-input:  value = rowData.active  (type: checkbox)
        └── ui-button: label = "Bearbeiten", action = editCustomer
```

Maximale Flexibilität, sauberer Schnitt zwischen Tabellenstruktur und Zeileinhalt. Erfordert ein Binding-Modell das den `rowData`-Kontext dynamisch pro Zeile auflöst.
-> Könnte als eigener Type im editor input field realisiert werden. 

### Footer-Slot

Wenn `footer: true` gesetzt ist, öffnet die Tabelle einen Slot `ui-table/footer`. View-Knoten die dort gemountet werden, erscheinen unterhalb des `<tbody>`. Typische Inhalte:

- **Pagination**: `ui-text` für "Seite 1 von 5", `ui-button` für Vor/Zurück — verdrahtet mit einem `ui-store` der die aktuelle Seite hält und einem `ui-query` der `params: store:customersFilter` referenziert
- **Aggregationen**: `ui-text` mit Binding auf berechnete Werte (z.B. `query:customers.summary/total`)
- **Freier Inhalt**: beliebige Kombination von View-Knoten

Der Footer-Slot verhält sich wie jeder andere Slot — Layout-Preset des Slots bestimmt die Child-Props der gemounteten Knoten.

---

## Besonderheiten

- `columns` ist heute nur eine String-Liste. Die strukturierte Spaltendefinition (Label, Typ, Sortierung, Filter) ist noch nicht implementiert.
- Footer-Slot ist noch nicht implementiert.
- Mehrfachselektion ist nicht modelliert.
- Welche Layout-Child-Props sichtbar sind, hängt vom gewählten Parent ab. Details in [layout.md](../concepts/layout.md).
