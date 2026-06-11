---
id: P139
title: "Fundament: gemeinsame Basis-Felder (visible/disabled/color/size) + Editor-Struktur (Gruppen-Überschriften, 'Layout'-Überschrift, Einklappen, N/A-Disable mit Hinweis)"
epic: aspects/editor
status: in_progress
dependencies: [P113]
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/placement-rows.spec.ts
---
# P139 — Fundament: Basis-Felder + Editor-Struktur

> Entscheidung & Begründung: [ADR 0015](../../../adr/0015-common-base-fields-and-editor-structure.md).
> Dieses Paket baut die **geteilte Mechanik**; der **per-Knoten-Rollout** folgt
> danach (siehe ADR 0015 „Consequences"). Owner-Entscheidungen (2026-06-11):
> `disabled` (nicht `enabled`); `color` allgemein, `variant` knoten-spezifisch
> (nicht im Basis-Satz); N/A vorerst **knoten-lokal** (zentrale Map später P102).

## findings (Nutzer-Wortlaut, 2026-06-11)

- "Vielleicht brauchen alle Knoten bestimmte Basis-Felder, die im Editor
  aufgeklappt werden können, weil sie selten benutzt werden. Visible sollten die
  aber alle by default sein. Zu den Feldern würden gehören: visible, enabled,
  color, size. Dabei sollten die Felder, die für einen Knoten nicht anwendbar
  sind, hier disabled werden (Hinweise, warum, wären hier auch wichtig). Hier
  wäre eine Trennung der Felder gut, ggf. auch mit einer passenden Überschrift."
- "Allgemein: Die Layout-Felder (Order etc.) sollten für ihren Abschnitt eine
  Überschrift 'Layout' bekommen."

## Zielmodell

### 1. Geteilter Helfer `installBaseFields(config)`

In `resources/lib/editor-common.js`: rendert die **Basis-Feld-Gruppe** in einem
eigenen Abschnitt **mit Überschrift** (Vorschlag „Allgemein"):

- **`visible`** — Boolean-Zustand-typedInput (ADR 0012-Satz). Default sichtbar.
- **`disabled`** — Boolean-Zustand-typedInput (bereits Standard, P122–P130).
- **`color`** — allgemeiner Farb-typedInput. **N/A**, wenn der Knoten `variant`
  trägt (dann disabled + Hinweis „nutzt semantische Variant").
- **`size`** — Größen-Feld (bestehendes `size`-Token, wo anwendbar).

`config` deklariert **knoten-lokal**, welche Basis-Felder anwendbar sind (z. B.
`{ visible:true, disabled:false, color:false, size:true, hints:{…} }`).

### 2. N/A-Disable mit Hinweis

Ein nicht anwendbares Basis-Feld wird **angezeigt, aber disabled**, mit einer
**kurzen Begründung** (aus `config.hints`): z. B. `disabled` bei nicht-interaktivem
Knoten → „kein interaktiver Zustand"; `color` bei variant-Knoten → „nutzt
Variant"; `size`/`color` bei Knoten, die das nicht rendern. (Quelle der
Begründung knoten-lokal; zentrale Capability-Map später, P102.)

### 3. „Layout"-Überschrift (zentral, universell)

Die Platzierungs-Zeilen (order/row/col/colSize/rowSize/layoutX/layoutY) werden
zentral injiziert (`injectPlacementRows`/`installLayoutChildPropRows`). Dort eine
**„Layout"-Überschrift** voranstellen → landet **auf einen Schlag** auf jedem
Knoten.

### 4. Einklappbarer „Erweitert"-Abschnitt (optional)

Selten genutzte Basis-Felder können in einen **einklappbaren** Unterabschnitt
(default eingeklappt); **alle Basis-Felder sind by default sichtbar** (nur
selten-genutzte eingeklappt). Reine Editor-Affordanz, keine Persistenz nötig.

## Explizit OUT of scope

- Der **per-Knoten-Rollout** (jeden Knoten auf `installBaseFields` umstellen,
  visible/color/size ergänzen, Farbe variant vs color mappen) — folgt als eigene
  Pakete (ADR 0015). `disabled` ist bereits ausgerollt.
- Zentrale Capability-Map (P102) — bleibt deferred.

## acceptance (observierbar, browser)

- **Layout-Überschrift:** Jeder Knoten mit Platzierungs-Feldern zeigt über
  order/row/col… eine **„Layout"**-Überschrift (eine zentrale Änderung).
- **Basis-Feld-Gruppe (Referenzknoten):** an einem Referenzknoten rendert
  `installBaseFields` die Gruppe mit Überschrift; `visible`/`disabled` als
  Boolean-Zustand-typedInputs; `color` aktiv (Nicht-variant-Knoten) bzw. **disabled
  mit Hinweis** an einem variant-Knoten.
- **N/A-Hinweis:** ein als N/A deklariertes Feld ist ausgegraut und zeigt die
  konfigurierte Begründung (sichtbar / als Title-Tooltip).
- **Einklappen:** der „Erweitert"-Abschnitt lässt sich auf-/zuklappen; Basis-
  Felder sind by default sichtbar.
- Bestehende Editor-E2E (placement-rows) bleiben grün.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` — neuer Abschnitt „Basis-Felder + Editor-
  Struktur" (Basis-Satz, Gruppen-Überschriften, Layout-Überschrift, Einklappen,
  N/A-Disable); ADR 0015 verlinken.
- tests: `tests/e2e/nodes/editor/placement-rows.spec.ts` um die „Layout"-Überschrift
  erweitern; neue Spec für `installBaseFields` (Gruppe, N/A-Disable+Hinweis,
  variant→color-N/A) an einem Referenzknoten. Unit: die Anwendbarkeits-/Hint-Logik.

## Risiken / Hinweise

- `disabled` ist schon ausgerollt — `installBaseFields` muss das bestehende
  `disabled`-typedInput **wiederverwenden**, nicht doppeln.
- Reihenfolge: erst dieses Fundament, dann per-Knoten; die node-lokalen
  Vorgriffe ([[P138]] visible) bleiben kompatibel.
