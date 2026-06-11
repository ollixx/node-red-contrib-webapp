---
id: P140
title: "Konzept: Repeats — dynamische Listen von Elementen (n× eine Komponente aus Daten)"
epic: aspects/rendering
status: deferred
deferred_reason: "Foundationales Rendering-Feature, ADR + Owner-Entscheidung nötig (Datenquelle, Template-Modell, Slot/Key-Handling, Events pro Instanz). Eng verzahnt mit Components [[P141]] und dynamischen Slots [[P142]]."
dependencies: []
---
# P140 — Konzept: Repeats (geparkt)

## findings (Nutzer-Wortlaut, 2026-06-11)

- "offene Punkte: Wie rendern wir dynamische listen von Elementen (n mal text)
  > repeats"

## Worum es geht

Eine Komponente (oder ein kleines Set) **n-fach aus Daten** rendern — z. B. eine
Liste von `ui-text` aus einem Array im Store/Query. Heute gibt es kein
Repeat/Each-Konzept; Listen sind nur über vorab bekannte, einzeln gemountete
Knoten oder spezialisierte Knoten (ui-table) abbildbar.

## Zu klären (ADR-würdig)

- **Datenquelle:** Array aus Store/Query/Reactive; Re-Render bei Änderung.
- **Template-Modell:** Was ist die wiederholte Einheit — ein einzelner Knoten,
  ein Container, ein „Component" ([[P141]])?
- **Keying:** stabile Keys für effizientes Morphing (wie der Renderer heute
  keyed morpht), Fokus/Scroll erhalten.
- **Pro-Instanz-Bindings & Events:** wie binden Kind-Felder auf das
  Listen-Element (Index/Item-Scope), wie tragen Events den Item-Kontext.
- **Slots:** dynamische Anzahl → siehe [[P142]].

## Bei Aktivierung

Owner-Entscheidung + ADR; dann Schema/Renderer/Editor-Pakete.
