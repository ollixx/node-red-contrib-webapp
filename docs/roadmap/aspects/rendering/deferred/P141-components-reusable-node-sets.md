---
id: P141
title: "Konzept: Components — wiederverwendbare Knoten-Sets (Definition / Instanz)"
epic: aspects/rendering
status: deferred
deferred_reason: "Großes Modellierungs-/Rendering-Feature (Definition vs. Instanz, Parameter, Scoping). ADR + Owner-Entscheidung nötig. Verzahnt mit Repeats [[P140]]."
dependencies: []
---
# P141 — Konzept: Components (geparkt)

## findings (Nutzer-Wortlaut, 2026-06-11)

- "offene Punkte: Wie rendern wir … componenten > set von Knoten,
  wiederverwendbar (definition / instanz)"

## Worum es geht

Ein **Set von Knoten** einmal als **Definition** beschreiben und mehrfach als
**Instanz** verwenden (mit Parametern) — die Grundlage für Wiederverwendung und
für Repeats ([[P140]], die eine Component n-fach rendern).

## Zu klären (ADR-würdig)

- **Definition vs. Instanz:** Wie wird eine Component im Flow definiert (eigener
  `ui-component`-Definitionsknoten? Subflow-ähnlich?) und instanziiert.
- **Parameter/Props:** Eingaben einer Component (typedInputs), Scoping der
  Bindings innerhalb der Definition (eigener State-/Slot-Namensraum).
- **Slots/Children:** kann eine Instanz Kinder in benannte Slots der Definition
  mounten? (Verzahnt mit [[P142]].)
- **Rendering/Identität:** Renderer-Auflösung Definition→Instanz, Keys, Events
  mit Instanz-Kontext.
- **Editor:** Definition pflegen, Instanz konfigurieren; Struktur-Sidebar.

## Bei Aktivierung

Owner-Entscheidung + ADR (vermutlich eigenes Epic); dann Schema/Runtime/Renderer/
Editor-Pakete. Klären, ob Node-REDs **Subflows** ein gangbarer Unterbau sind.
