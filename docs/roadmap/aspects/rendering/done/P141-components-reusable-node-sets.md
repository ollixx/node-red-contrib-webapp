---
id: P141
title: "Konzept: Components — wiederverwendbare Knoten-Sets (Definition / Instanz)"
epic: aspects/rendering
status: done
dependencies: [P166]
---

> **Aufgelöst (2026-06-14).** Der Spike [[P166]] ist abgeschlossen; die Unterbau-
> Entscheidung ist als [ADR 0020](../../../../adr/0020-component-model-dedicated-ui-component-node.md)
> festgeschrieben (**dedizierter `ui-component`-Knoten**, kein Subflow). Dieses
> Konzept-Paket ist damit erledigt — die Implementierung läuft als eigene Welle
> `nodes/ui-component` (**P177** Schema → **P178** Renderer → **P179** Node+Editor+Beweis).

# P141 — Konzept: Components (geparkt — Richtung steht)

## findings (Nutzer-Wortlaut, 2026-06-11)

- "offene Punkte: Wie rendern wir … componenten > set von Knoten,
  wiederverwendbar (definition / instanz)"

## Worum es geht

Ein **Set von Knoten** einmal als **Definition** beschreiben und mehrfach als
**Instanz** verwenden (mit Parametern) — die Grundlage für Wiederverwendung.

## Entschiedene Richtung (Owner 2026-06-12)

- **Component = benanntes, parametrisiertes, wiederverwendbares Template** — die
  Geschwister-Idee zu `ui-repeat`. **Props sind ein benannter Render-Zeit-Scope**
  (`prop.<name>`), exakt die Scope-Maschinerie aus
  **[ADR 0017](../../../../adr/0017-ui-repeat-template-container-render-time-scope.md)**:
  Repeat-Scope = das Item (`item.*`/`index`), Component-Scope = die Props. Darum
  **sequenziell nach `ui-repeat`** bauen (Scope-Grundlage bewiesen).
- **Unterbau: Subflow zuerst prüfen** (node-red first). Der **Feasibility-Spike
  [[P166]]** klärt, ob ein NR-Subflow einen ui-Mount-Subtree + typisierte Props +
  einen einzigen äußeren Mount-Punkt tragen kann. Geht das sauber → Subflow-Weg
  (NR liefert Instanziierung/Namespacing gratis); sonst Fallback eigener
  `ui-component`-Knoten. **Eigenes Epic** bei Aktivierung.
- **v1 hart geschnitten:** Props rein / Events raus. **Keine** Kind-Slot-
  Projektion (das ist Komposition — [[P142]]), **kein** Pro-Instanz-State
  (Component ist präsentational; State bleibt extern/explizit).

## Zu klären (im Spike / der Folge-ADR)

- **Definition off-canvas:** die Definition ist in keine Route gemountet; ihre
  Kinder mounten in eine **eigene Definitions-Wurzel** (neuer freier Mount-Root).
  Erst die **Instanz** wird in eine echte Route gemountet.
- **Props als Scope:** scope-lokale Binding-Art `prop.<name>` (Geschwister zu
  `item`/`index`); Instanz liefert Prop-Werte als typedInputs (jede Binding-Art).
- **Identität/Namespacing:** N Instanzen → innere IDs kollidieren; Key =
  `instanceKey × innerNodeId` (Subflow schenkt das, eigener Knoten muss es
  synthetisieren).
- **Events mit Instanz-Kontext:** ein Event aus einer Instanz trägt, *welche*
  Instanz.
- **Editor + Struktur-Sidebar:** Definition pflegen, Instanz konfigurieren;
  Definition vs. Instanzen in der Sidebar (nicht aus Wires inferiert).
- **Verschachtelung/Rekursion:** Component-in-Component; Schutz gegen
  Selbstreferenz.

## Bei Aktivierung

Nach dem Spike [[P166]]: Folge-ADR (Unterbau-Entscheidung A/B festschreiben) +
eigenes Epic; dann Schema (Definition/Instanz + `prop`-Binding-Art) / Runtime /
Renderer (Definition→Instanz-Auflösung, Props-Scope, Keying) / Editor-Pakete.
