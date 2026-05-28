# `ui-layout`

## Zusammenfassung

Definiert einen benannten Seiten- oder Dialog-Container mit Slots. Langfristig ist `ui-layout` vor allem für frei modellierte Custom-Layouts gedacht.

Aktuelles MVP-Verhalten:
- Slots werden über `ui-slot` flach pro Layout aufgebaut.
- Routen und Dialoge verweisen über `layoutId` auf ein Layout.
- Layouts sind heute app-gescoped. Sie werden nicht direkt über ein generisches `parent`-Feld an Route oder Dialog gebunden.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app` (Layouts sind app-gescoped)

**Gemeinsam genutzte Services und Komponenten:**
- Wird von `ui-route`, `ui-dialog` und `ui-container` über `layoutId` referenziert
- Slots des Layouts sind Mount-Ziele für View-Knoten

## Editor

**Pflichtfelder:**
- `id`: fachliche Layout-ID

**Optionale Felder:**
- `title`: sichtbarer Titel des Layouts

## Input

## Output

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

`ui-layout` sollte nicht für jeden Standardfall nötig sein. Für häufige Fälle soll es eine feste Liste von Layout-Presets geben.
- Vorgesehene Presets sind mindestens:
  - `horizontal`
  - `vertical`
  - `app` mit `header`, `navbar`, `content`, `footer`
- `ui-layout` bleibt für den Fall `custom` bestehen. In diesem Fall werden Slots weiterhin explizit mit `ui-slot` modelliert.
- Alle Knoten, die ein Layout benötigen, sollen künftig zwischen einem Preset und `custom` wählen können.
- Nur wenn `custom` gewählt ist, soll der Editor zusätzlich passende `ui-layout`-Knoten zur Auswahl anbieten.
- Fehlen explizite Layout-Typen wie Shell, Dialog-Shell oder Tabs-Container. Weitere Ideen: `horizontal`, `vertical`, `stack`, `absolute`
- Es gibt noch keine deklarativen Layout-Varianten für Responsiveness oder Breakpoints.
