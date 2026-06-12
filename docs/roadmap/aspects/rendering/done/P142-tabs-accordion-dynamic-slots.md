---
id: P142
title: "Konzept: ui-tabs / ui-accordion — Slots bei (dynamischen) Optionen; dynamische Slot-Zuweisung"
epic: aspects/rendering
status: deferred
deferred_reason: "Design offen: Slots erscheinen nicht in der Mount-Auswahl, und bei dynamisch gefüllten Tabs/Sektionen ist die Slot-Anzahl erst zur Laufzeit bekannt. Hängt an der Repeats/Components-Entscheidung [[P140]]/[[P141]]."
dependencies: []
---
# P142 — Konzept: dynamische Slots (ui-tabs / ui-accordion) (geparkt)

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
