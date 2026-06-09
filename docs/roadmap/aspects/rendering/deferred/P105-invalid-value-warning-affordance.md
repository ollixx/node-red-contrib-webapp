---
id: P105
title: "Nicht-darstellbarer Wert: elegantes Signal statt nacktem \"?\" — Achtung-Icon neben der Komponente, optional mit Alert/Dialog (Erklärung: welcher Pfad/Typ)"
epic: aspects/rendering
status: deferred
deferred_reason: "Stufe 2 über P104. Erst die zentrale Normalisierung + das einfache \"?\" (P104) liefern; die elegante UI-Affordance kommt danach als eigenes Paket. Zurückgestellt."
dependencies: [P104]
verify: browser
spec: docs/nodes/concepts/value-rendering.md
---
# P105 — Nicht-darstellbarer Wert: elegante Warn-Affordance

> Setzt §2a von [value-rendering.md](../../../../nodes/concepts/value-rendering.md) um.
> Ersetzt das nackte `"?"` aus P104 durch ein erklärendes Signal.

## Findings
> Owner-Vorgabe.

- Das `"?"` (P104) ist die erste, einfache Stufe. Später soll der „kann nicht dargestellt werden"-Fall **eleganter** gelöst werden: ein **Achtung-Icon** neben der Komponente, ggf. mit Link auf einen **Alert/Dialog**, der erklärt, dass der gebundene Wert nicht sinnvoll angezeigt werden kann.

## Acceptance
> `verify: browser`. Vor Umsetzung Detailpunkte (unten) mit dem Owner schärfen — nicht raten.

- Ist der normalisierte Wert „nicht darstellbar" (`null`/`undefined`/Nicht-Skalar — derselbe Fall, der in P104 `"?"` ergibt), zeigt die App **neben der Komponente ein Achtung-Icon** statt/zusätzlich zum `"?"`.
- Klick/Hover auf das Icon öffnet einen **Alert/Dialog**, der erklärt, **warum** der Wert nicht darstellbar ist — mindestens: welcher Binding-Pfad, welcher tatsächlich angekommene Typ.
- Einheitlich für alle wertbindenden Knoten, zentral (kein Pro-Knoten-Code) — analog zur Normalisierung in P104.

## Notes
- **Vor Umsetzung zu klären (Owner):** Icon statt oder zusätzlich zum `"?"`? Trigger Klick oder Hover? Alert (inline) vs. Dialog (modal)? Nur im Dev-/Debug-Modus oder immer? Diese Punkte sind bewusst noch offen — dieses Paket ist deferred.
