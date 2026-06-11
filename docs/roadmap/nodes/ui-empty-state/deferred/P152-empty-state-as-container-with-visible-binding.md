---
id: P152
node: ui-empty-state
epic: nodes/ui-empty-state
title: "Redesign: ui-empty-state = Container mit Slot(s) + visible-Binding (an Result-Set), Inhalt autor-bestimmt — feste icon/title/message/action-Felder weg"
status: deferred
deferred_reason: "Knoten-Vertragswechsel (Container + Slot statt fester Felder); ADR + Owner-Entscheidung zu Restfragen nötig (eigener Knoten vs. Container-Preset, 'ist-leer'-Komfort, Migration). Richtung steht."
dependencies: []
spec: docs/nodes/feedback/ui-empty-state.md
---
# P152 — ui-empty-state als Container + visible-Binding (geparkt)

## findings (Nutzer-Wortlaut, 2026-06-11)

- "ich finde das Konzept schräg. Die Idee einen Platzhalter zu haben ist OK. Aber
  das ist dann ein Container mit Slot(s), der an ein Result-Set gebunden wird
  (faktisch ein Binding auf 'visible'). Aber ob da ein Button oder sonst was
  drin steckt ist Sache des Autors."

## Befund (heute)

- `ui-empty-state` ist ein **fest strukturierter** Feedback-Knoten:
  `icon`/`title`/`message` + ein eingebauter CTA-Button (`actionLabel` +
  `action` = Referenz auf eine `ui-action`, beim Klick ausgelöst). `visiblePath`
  steuert die Sichtbarkeit (nacktes Textfeld).
- Das eingebaute „action"-Referenz-Modell ist ein **dritter** Klick-Auslöser-Weg
  neben dem ui-button-Modell (wire/route/url, ADR 0011) — inkonsistent.

## Zielmodell (Richtung steht)

- `ui-empty-state` wird ein **Container mit Slot(s)** (wie `ui-container`): der
  Autor mountet **beliebige** Kinder hinein (Text, Button, Bild, …).
- Sichtbarkeit über das **Standard-`visible`-Binding** (ADR 0012 / Basis-Felder
  [[P139]]), typischerweise an eine **Leer-Bedingung** eines Result-Sets gebunden
  (z. B. Reactive `query("customers").length === 0` oder ein Store-Flag).
- Die festen Felder `icon`/`title`/`message`/`actionLabel`/`action` **entfallen**
  (Inhalt = Slot-Kinder). Der „eingebaute CTA" verschwindet — ein Button im Slot
  nutzt das normale ui-button-Modell.
- **Mein bisheriger Welle-2-Fix** (action→Picker, title/message→value, visible)
  wird damit **gegenstandslos** — der Redesign ersetzt ihn.

## Offene Punkte (vor ADR)

1. **Eigener Knoten oder Container-Preset?** Bleibt `ui-empty-state` ein eigener,
   semantisch benannter Knoten (dünner Container-Preset mit sinnvollem
   `visible`-Default), oder geht er in `ui-container` auf (und wird deprecatet)?
2. **„Ist-leer"-Komfort:** Reicht das nackte `visible`-Binding (Autor schreibt
   die Bedingung selbst), oder gibt es einen Komfort („zeige, wenn diese
   Query/dieser Store leer ist")? Verzahnt mit Repeats/Result-Sets [[P140]].
3. **Migration:** Bestands-`ui-empty-state` (icon/title/message/action) → wie auf
   das Container-Modell überführen (oder Alt-Render beibehalten)?

## Bei Aktivierung

ADR (Knoten wird Container + visible), Restfragen 1–3 klären; dann Schema/
Runtime/Renderer/Editor + Migration. Bis dahin bleibt der Knoten wie er ist.
