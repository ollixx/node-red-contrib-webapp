# `ui-table`

## Zusammenfassung

Rendert tabellarische Query-Daten und optional eine Selektionsaktion.

Aktuelles MVP-Verhalten:
- Erwartet eine Zeilenliste über ein Query-Binding.
- Kann pro Zeile eine Action beim Selektieren auslösen.
- Treibt im CRUD-Beispiel die Listen- und Detailnavigation.

## Abhängigkeiten

**Parent-Knoten:**
- Mount-Ziel (Route-, Dialog- oder Layout-Slot)

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-action` über `selectAction`
- Query-Binding für Zeilendaten (`rows`)

## Editor

**Pflichtfelder:**
- `id`
- `mount`
- `columns`: mindestens eine Spalte
- `rows`: Binding auf die Zeilenliste

**Optionale Felder:**
- `selectAction`
- `order`

## Input

## Output

Kann pro Zeile eine Action beim Selektieren auslösen.

## Besonderheiten

- Sortierung, Formatierung, Pagination, Spaltentypen und Mehrfachselektion sind nicht modelliert.
- `columns` ist heute nur eine Liste von Strings und damit für echte Tabellen zu schwach.
