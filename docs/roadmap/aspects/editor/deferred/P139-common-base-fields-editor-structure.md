---
id: P139
title: "Konzept: standardisierte Basis-Felder (visible/enabled/color/size) + Editor-Struktur (Gruppierung, Überschriften, Einklappen, N/A-Disable mit Hinweis)"
epic: aspects/editor
status: deferred
deferred_reason: "Querschnitt über ALLE Knoten; ADR + Owner-Entscheidungen nötig (Namensgebung enabled vs disabled, exakter Feld-Satz, Einklapp-Verhalten, Verhältnis zur Capability-/Backend-Support-Map P102). Erst ADR, dann per-Knoten-Rollout."
dependencies: [P113]
---
# P139 — Konzept: Basis-Felder + Editor-Struktur (geparkt)

> Keystone aus dem Review 2026-06-11. Erklärt mehrere Einzelfälle
> (skeletons `visible` [[P138]], avatars/skeletons N/A-Felder) und vereinheitlicht
> sie. **Braucht ADR + Owner-Entscheidungen** — daher geparkt.

## findings (Nutzer-Wortlaut, 2026-06-11)

- "Vielleicht brauchen alle Knoten bestimmte Basis-Felder, die im Editor
  aufgeklappt werden können, weil sie selten benutzt werden. Visible sollten die
  aber alle by default sein."
- "Zu den Feldern würden gehören: visible, enabled, color, size. Dabei sollten
  die Felder, die für einen Knoten nicht anwendbar sind, hier disabled werden
  (Hinweise, warum, wären hier auch wichtig)."
- "Hier wäre eine Trennung der Felder gut, ggf. auch mit einer passenden
  Überschrift."
- "Allgemein: Die Layout-Felder (Order etc.) sollten für ihren Abschnitt eine
  Überschrift 'Layout' bekommen."

## Idee (Zielbild, noch zu entscheiden)

- **Gemeinsamer Basis-Feld-Satz** auf jedem Knoten: `visible`, `enabled`,
  `color`, `size` — **by default sichtbar**; selten genutzte Felder in einen
  **einklappbaren** Abschnitt.
- **N/A-Felder kontextabhängig disabled** (z. B. `size`/`color` bei einem Knoten,
  der das nicht rendert) — **mit Hinweis, warum**.
- **Feld-Gruppierung mit Überschriften** (gemeinsamer Block; **„Layout"**-
  Überschrift für order/row/col/…).

## Offene Entscheidungen (vor ADR)

1. **Namensgebung:** `enabled` vs. das bereits ausgerollte `disabled` (ADR 0012).
   Eins von beiden — nicht beide. (`visible` deckt sich mit der „später
   hidden/readonly"-Notiz aus ADR 0012.)
2. **Feld-Satz:** ist `color` = das bestehende `variant` (Farb-Konvention)? Ist
   `size` das bestehende `size` (P71)? Dann sind 2 der 4 schon da, nur zu
   vereinheitlichen.
3. **N/A-Disable mit Hinweis** = genau die **Capability-/Backend-Support-Map**
   aus [[P102]] (deferred). Soll P139 darauf aufbauen / P102 mitziehen?
4. **Einklapp-Verhalten** (welche Felder default eingeklappt; Persistenz?).
5. **Rollout:** ADR + per-Knoten-Pakete (wie ADR 0012 → P123ff.), groß.

## Bei Aktivierung

ADR schreiben (Basis-Felder + Editor-Struktur), Entscheidungen 1–4 klären, dann
per-Knoten-Rollout schneiden. Die node-lokalen Vorgriffe ([[P138]] visible,
ui-avatar N/A) bleiben kompatibel.
