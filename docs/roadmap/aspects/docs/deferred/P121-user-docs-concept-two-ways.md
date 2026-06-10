---
id: P121
title: "Konzept Nutzer-Dokumentation: Wo und Wie werden die zwei Wege (Wire vs. Referenz) mit Beispielen dokumentiert?"
epic: aspects/docs
status: deferred
deferred_reason: "Owner-Entscheidung zu Ort und Form der Nutzer-Doku nötig (In-Editor-Hilfe? Doku-Site? Beispiel-Galerie/Import-Flows?) — erst Konzept mit Owner abstimmen, dann Pakete schneiden."
dependencies: [P119]
---
# P121 — Konzept: Nutzer-Doku der zwei Wege (geparkt)

> Kontext: [ADR 0011](../../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md).
> Owner (2026-06-10): "Wenn der User dann eine unsinnige Verdrahtung baut,
> dann ist das seine Verantwortung. Dafür sollten wir dann hier eine gute
> Dokumentation mit Beispielen für die Wege anbieten. Wo und Wie die Doku
> umgesetzt wird ist aber auch noch ein offener Punkt und damit ein Concept."

## Warum geparkt

ADR 0011 ersetzt Validierungs-Härte bewusst durch Nutzer-Verantwortung — die
Kompensation ist gute, beispielgetriebene Doku der zwei Wege (Wire vs.
Referenz: wann welcher, wie kombiniert, Grenzen wie Link-Nodes/Verzweigungen).
**Ort und Form sind unentschieden** und eine Owner-Entscheidung:

- **In-Editor:** ausgebaute `data-help-name`-Hilfen? Eine eigene
  Hilfe-Sidebar? Geführte Beispiele?
- **Doku-Site:** README/Wiki/Pages aus `docs/nodes/**` generiert? Eigene
  Anwender-Doku getrennt von den Spec-Contracts?
- **Beispiel-Galerie:** importierbare Beispiel-Flows pro Muster
  (`pnpm gen:node-examples` existiert als Unterbau)?

## Was bei Aktivierung zu tun ist

1. Mit dem Owner Ort + Form festlegen (ggf. kleines ADR).
2. Daraus konkrete Pakete schneiden (Inhalte: die zwei Wege mit je 2–3
   Beispielen, inkl. des bedingten Navigierens über Verzweigung und der
   Wire-Scan-Limitationen aus P119).

Bis dahin tragen die Inline-Hilfen der Knoten (P89-Standard) und die
Spec-Doku die Last.
