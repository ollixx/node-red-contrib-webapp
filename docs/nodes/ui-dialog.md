# `ui-dialog`

## Zusammenfassung

Definiert einen Dialog mit eigenem Layout.

Aktuelles MVP-Verhalten:
- Dialoge werden über einen State in einem Store geöffnet und geschlossen.
  - Frage: macht es Sinn, ein flag nach Schema `<store-name>:<flag-name>` hier zu definieren?
- View-Knoten können über `dialog:<dialogId>/...` in Dialog-Slots mounten.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-layout` über `layoutId`
- Optionale Verknüpfung mit `ui-route` über `routeId`
- Öffnen/Schließen läuft über `ui-store` State

## Editor

**Pflichtfelder:**
- `id`
- `layoutId`

**Optionale Felder:**
- `title`: sichtbarer Titel des Dialogs
- `routeId`: optionale Route-Verknüpfung
- `modal`: Legt fest, ob der rest der webapp geblockt wird (light box) oder nicht.

## Input

## Output

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Auch Dialoge sollten künftig ein Layout-Preset oder `custom` verwenden können.
- Nur für `custom` ist dann ein expliziter Verweis auf einen `ui-layout`-Knoten nötig.
- Das Öffnen und Schließen ist heute nicht generisch modelliert, sondern im Preview-Pfad teilhart codiert.
- Es fehlt ein klares Dialogmodell für Fokus, Backdrop, Escape-Verhalten und Rückgabewerte.
