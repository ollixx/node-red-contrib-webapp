---
id: P166
epic: aspects/rendering
title: "Feasibility-Spike: kann ein Node-RED-Subflow Component-Unterbau sein (Mount-Subtree + typisierte Props + ein äußerer Mount-Punkt)?"
findings:
  - "Owner (2026-06-11): 'componenten > set von Knoten, wiederverwendbar (definition / instanz)'."
  - "Owner-Entscheidung (2026-06-12): Subflow-Unterbau ZUERST prüfen (node-red first); geht es sauber → Subflow-Weg, sonst eigener ui-component-Knoten."
dependencies: []
status: in_progress
---
# P166 — Component-Unterbau: Subflow-Feasibility-Spike

> Forschungs-/Prototyp-Paket, **kein** Knoten-Vertrag. Liefert eine **begründete
> A/B-Empfehlung** als Eingabe für die Component-Folge-ADR ([[P141]]). Bricht
> nichts Bestehendes; Ergebnis ist ein Findings-Dokument (+ Wegwerf-Prototyp).

## Die zu beantwortende Frage

Kann ein **Node-RED-Subflow** der Unterbau für Components sein? Konkret drei
Tragfähigkeits-Tests:

1. **Mount-Subtree:** Kann ein Subflow ui-*-Knoten enthalten, die über
   `mount`/`parent` eine **interne Hierarchie** bilden (mount-not-wires-Invariante
   gilt auch innen)?
2. **Ein äußerer Mount-Punkt:** Kann die Subflow-**Instanz** als *ein* Element in
   eine echte Route gemountet werden, sodass der innere Baum an diesem Punkt
   erscheint? (Wie wird die innere Wurzel an den äußeren Mount gebunden?)
3. **Typisierte Props:** Können Subflow-Properties/env als **typedInput-Props**
   (Binding-Arten, nicht nur Strings) an die Instanz übergeben und innen als
   `prop.<name>`-Scope (ADR 0017) aufgelöst werden?

Sekundär: **Namespacing/Identität** (bekommt jede Instanz einen kollisionsfreien
ID-Namespace gratis?), **Struktur-Sidebar** (sieht der Editor in die Definition?),
**Events mit Instanz-Kontext**.

## Vorgehen

- Minimaler Prototyp in `.node-red-e2e`/einem Scratch-Flow (NICHT
  `.node-red-dev/flows.json` — off-limits): ein Subflow mit zwei ui-Knoten, einmal
  als Instanz in eine Route gemountet; eine Property als Prop durchgereicht.
- Den Runtime-/Renderer-Pfad nachvollziehen: wie weit kommt ein Subflow-Inhalt
  durch Registry→AppModel→Snapshot, wo bricht es (Mount-Auflösung, ID-Prefix,
  Property-Übergabe).
- Befunde je Test (1/2/3) als **geht / geht mit Aufwand X / geht nicht** notieren.

## Deliverable (acceptance)

- Ein Findings-Dokument unter `docs/adr/` (Entwurf der Component-ADR) oder
  `.ai/`-Notiz, das je Tragfähigkeits-Test ein belegtes Urteil enthält **und**
  eine klare **Empfehlung A (Subflow) vs. B (eigener `ui-component`-Knoten)** mit
  Begründung.
- Falls A: skizzierter Mount-Bind-Mechanismus + Prop-Übergabe.
- Falls B: die konkreten Subflow-Blocker, die B rechtfertigen.

## Risiken / Hinweise

- **`.node-red-dev/flows.json` ist off-limits** — Prototyp nur in Scratch/E2E-Dir.
- Wegwerf-Code: der Spike produziert **kein** Produkt, nur Erkenntnis + ADR-Input.
- Hängt logisch an der Scope-Grundlage aus ADR 0017, aber **nicht** hart an P163–
  P165 — der Spike kann parallel laufen; die *Implementierung* von Components
  sequenziert nach `ui-repeat`.
