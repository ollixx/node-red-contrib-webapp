---
id: P142
title: "Konzept: ui-tabs / ui-accordion — Slots bei (dynamischen) Optionen; dynamische Slot-Zuweisung"
epic: aspects/rendering
status: done
dependencies: []
---
# P142 — Konzept: dynamische Slots (ui-tabs / ui-accordion) (aufgelöst)

## Auflösung (2026-06-12)

Aufgelöst durch **[ADR 0018](../../../../adr/0018-tabs-accordion-children-define-sections.md)**
(Modell 1a: **Kinder definieren die Sektionen** über `ui-tab`/
`ui-accordion-section`-Kinder; `tabs`/`sections`-JSON entfällt). Der **statische**
Picker-Teil löst sich auf (Mounten in `ui-tabs` = „werde ein Tab", normale
Slot-Enumeration). Der **dynamische** Teil **fällt aus `ui-repeat`** ([[P140]]/
ADR 0017): N Tabs = ein `ui-repeat`, das `ui-tab`-Kinder aus Daten erzeugt — keine
eigene „dynamischer-Slot"-Bindung nötig. Umsetzung: P167–P170 (Reversed-Link 1b
und Config-Beibehaltung 2 wurden verworfen — Begründung in der ADR).

## findings (Nutzer-Wortlaut, 2026-06-11)

- "ui-tabs, ui-accordion: die slots werden nicht angezeigt bei der auswahl. Das
  ist dann ja auch dynamisch, wenn man die options dynamisch füllt. Wie gehen wir
  damit um? Muss man den Slot da dynamisch zuweisen können?"

## Worum es geht

`ui-tabs`/`ui-accordion` haben **pro Tab/Sektion einen Slot**. Wenn die Tabs/
Sektionen aus **dynamischen Optionen** (Store/Query) kommen, ist die **Anzahl der
Slots erst zur Laufzeit** bekannt — die statische Mount-Auswahl (Modus B,
ADR 0014) kann sie nicht anbieten. Zwei verschränkte Probleme:

1. **Statisch:** Selbst bei festen Tabs erscheinen die Tab-Slots heute nicht in
   der Mount-Auswahl — der Mount-Tree (P135) muss die Slots dieser Container-Art
   überhaupt führen.
2. **Dynamisch:** Bei dynamischen Optionen braucht es ein Konzept, wie ein Kind
   einem **per Index/Key** bestimmten Slot zugeordnet wird — das ist genau der
   Repeats/Components-Fall ([[P140]]/[[P141]]).

## Zu klären

- Führt der Mount-Tree (P135) die statischen Tab-/Sektions-Slots korrekt? (ggf.
  kleiner Fix dort, unabhängig vom dynamischen Teil)
- Dynamische Zuordnung: Slot per Index/Key aus den Optionen — über Repeats?
  Eigene „dynamischer Slot"-Bindung?

## Bei Aktivierung

Den **statischen** Teil ggf. als kleinen Fix zu P135 abspalten. Den
**dynamischen** Teil mit der Repeats/Components-Entscheidung zusammen entscheiden.
