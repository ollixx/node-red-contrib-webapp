---
id: P104
title: "Wert-Rendering zentralisieren: einheitliche Normalisierung (leer→leer, null/undefined/Nicht-Skalar→\"?\") in der Binding-Auflösung; alle wertbindenden Knoten scannen, schärfen und Doc-Rollout"
epic: aspects/rendering
status: done
dependencies: [P3, P67]
verify: browser
spec: docs/nodes/concepts/value-rendering.md
---
# P104 — Wert-Rendering zentralisieren

> Setzt das Konzept [value-rendering.md](../../../../nodes/concepts/value-rendering.md)
> um. Querschnitt über **alle** Knoten mit gebundenem Anzeige-Wert.

## Findings
> Owner-Vorgabe (Entscheidung 2026-06-09).

- Das Verhalten bei leerem/`null`/`undefined`/nicht-skalarem Wert muss **an einer Stelle im Code zentral** abgebildet werden (nahe der Wert-/typedInput-Auflösung), nicht pro Knoten. Danach **alle Knoten scannen** und darauf schärfen — ein größeres Refactoring.
- **Einheitliche Regel** (kein Pro-Knoten-Verhalten): echtes Leer (`""`) → **leer** anzeigen; `null`/`undefined`/Objekt/Array → **`"?"`** anzeigen (sichtbares „kann nicht dargestellt werden"-Signal). `0`/`false` bleiben gültige Werte.

## Acceptance
> `verify: browser` — Render-Outcome im laufenden App-Frontend zu beweisen.

- Eine **zentrale Normalisierungsfunktion** in der Binding-/Wert-Auflösung des Renderers wandelt jeden Rohwert exakt nach der Tabelle in §1 des Konzepts:
  - nicht-leerer String → unverändert; `number`/`boolean`/`bigint` → `String(wert)`.
  - `""` → **leer** (Element gerendert, kein Inhalt).
  - `null` / `undefined` / Objekt / Array / Funktion / Symbol → **`"?"`** (nie `[object Object]`, nie JSON-Dump, nie Crash).
- Outcome-Tests (im DOM beobachtbar): Badge/Text mit `0` → „0"; mit `false` → „false"; mit `""` → leerer Inhalt; mit `null`/`undefined` → `"?"`; mit `{}`/`[]` → `"?"`.
- **Einheitlich, keine Pro-Knoten-Konfiguration.** `ui-avatar` `initials` durchläuft zuerst seine Fallback-Kette (Bild→Initialen→Icon), der Ergebniswert dann die Normalisierung.
- **Scan aller wertbindenden Knoten**: jeder Knoten, der einen Anzeige-Wert bindet, läuft durch die zentrale Stelle; etwaige knotenlokale Sonderbehandlung wird entfernt. Liste per `grep` der Binding-Felder ermitteln.
- Doc-Rollout: jede betroffene Node-Doc referenziert [value-rendering.md](../../../../nodes/concepts/value-rendering.md) an der Wert-Feldzeile + „Referenzen".

## Notes
- Die elegantere Signalisierung (Achtung-Icon + Dialog statt nacktem `"?"`) ist **deferred** (eigenes Paket) — siehe §2a des Konzepts. P104 liefert nur das `"?"`.
- Eng verwandt, aber getrennt von P102 (Backend-Capability) — das ist die *Backend*-Achse, dies die *Wert*-Achse.

## Result

delivered: Central `normalizeDisplayValue` function in `packages/renderer/src/renderer.ts` (exported) normalises every bound display value per value-rendering.md §1 (`""`→empty; null/undefined/object/array/function/symbol→`"?"`; number/boolean/bigint→String so 0/false stay valid), wired into ui-text, ui-badge, and ui-alert(message) render paths; ui-avatar initials keep their fallback chain then the same rule.
stats: 11 files; renderer.ts + index.ts (1 new exported fn, 3 call-sites); 4 docs updated (value-rendering.md, ui-text, ui-alert, ui-avatar); 3 test files — renderer.test.ts (+19 tests), p104-central-value-rendering.test.ts (19 full-pipeline tests), E2E p104-central-value-rendering.spec.ts (10 tests, all green) + catalogue .md; 4 commits
notes: Form/input/structural-value kinds deliberately NOT routed through "?"-normalisation (data/URL/array, not display strings). Pre-existing E2E red baseline (ui-alert duration/countdown/editor, p36-app-shell, flaky p106) confirmed unrelated — reproduced with renderer reverted; logged to friction-log.md for owner decision.
cost: session ab10ee379b041548f, ~21m
