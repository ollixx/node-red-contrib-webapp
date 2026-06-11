---
id: P143
title: "Konzept: Enums dynamisch bindbar — Pro-Feld-typedInput (Enum-Default + optionale dynamische Typen) statt globalem Advanced-Mode"
epic: aspects/editor
status: deferred
deferred_reason: "Querschnitt über ALLE Enum-Felder; ADR + Owner-Entscheidung nötig (per-Feld-typedInput vs. globaler Advanced-Mode). Empfehlung steht (per-Feld); Aktivierung erst nach Entscheidung."
dependencies: [P113]
---
# P143 — Konzept: Enums dynamisch bindbar (geparkt)

## findings (Nutzer-Wortlaut, 2026-06-11)

- "Einfache Auswahl ist gut, aber dynamisch Ändern für advanced usecases auch
  cool. Das gilt dann aber auch wieder für alle diese Enums. Ich dachte, ob man
  das als 'Advanced Mode' als user switchen kann (Anfänger > simple mode,
  möglichst enums, wenige TypedInputs, advanced mode > alles dynamisch) — macht
  die Sache aber noch komplexer."

## Worum es geht

Die Enum-Felder (`size`, `variant`, `displayType`, `shape`, `style`,
`orientation`, `mode`, `fit`, `inputType`, …) sind heute simple `<select>`s. Für
Fortgeschrittene wäre es nützlich, sie **dynamisch zu binden** (z. B. `size` aus
einem Store/Reactive). Frage: wie, ohne den Editor für Anfänger zu überladen.

## Zwei Ansätze

### A — Pro-Feld-typedInput (Empfehlung)

Jedes Enum wird ein **typedInput**, dessen **Default-Typ die Enum-Auswahl**
(Dropdown mit den erlaubten Werten) ist; **dieselbe ▾** bietet zusätzlich die
dynamischen Typen (Store/Reactive/Query/msg/…). 
- Anfänger: sehen faktisch ein Select (Default-Typ), nichts ändert sich.
- Advanced: klicken die ▾ und binden dynamisch.
- **Kein globaler Modus**, kein Doppel-Rendering, kein per-User-State. Das ▾ ist
  der **Pro-Feld-Schalter** simpel↔dynamisch — Node-RED-nativ.
- Benötigt einen typedInput-Typ „enum" (Wertliste je Feld) im geteilten Helfer
  (`valueBindingTypes({ category:"enum", values:[…] })` o. ä.).

### B — Globaler „Advanced Mode" (verworfen-Tendenz)

Ein User-Schalter (Anfänger → Selects, Advanced → alles typedInput). Mächtiger,
aber: jedes Enum braucht **zwei** Renderings, ein globaler Zustand, mehr
Komplexität — genau das Owner-Bedenken („macht die Sache noch komplexer").

## Zu klären (ADR)

- A oder B (Empfehlung: **A**).
- Welche Enums dürfen dynamisch werden (alle? `variant`/`size` ja; strukturelle
  wie `inputType`/`mode` evtl. nicht — Render-Target muss den Wert zur Laufzeit
  unterstützen → Capability, vgl. [[P102]]).
- Validierung: bei Default-Typ nur erlaubte Werte; bei Binding Laufzeit-Fallback
  (unbekannter Wert → sprechender Fehler / Default).

## Bei Aktivierung

ADR (Ansatz A), `enum`-Kategorie im typedInput-Helfer, dann per-Knoten-Rollout
der Enum-Felder. Verzahnt mit dem Basis-Felder-Rollout ([[P139]]).
