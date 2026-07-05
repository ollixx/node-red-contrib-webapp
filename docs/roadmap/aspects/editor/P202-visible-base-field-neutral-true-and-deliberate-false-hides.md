---
id: P202
title: "Base-Field visible: leeres Feld zeigt/meint TRUE (nicht false), und ein bewusst gesetztes visible=false versteckt den Knoten wirklich (P181-Synthetik-Default pro Feld)"
epic: aspects/editor
findings:
  - "Owner (2026-07-05, entdeckt an ui-list): 'Ich sehe ui-list hat die Felder. Aber Visibility ist dort hart auf FALSE, aber die Liste wird angezeigt. Default sollte TRUE sein.'"
  - "Code-Befund: der Bool-typedInput normalisiert einen leeren visible-Wert beim Init auf 'false' (editor-common.js installBaseFields, ~Z.498-515) → das Feld ZEIGT 'false', obwohl 'leer = sichtbar' gilt (Renderer defaultet korrekt auf true, packages/renderer/src/renderer.ts:932). Server rendert die Liste deshalb korrekt trotz angezeigtem 'false'."
  - "Code-Befund (schwerwiegender): applyBaseFields (editor-common.js ~Z.585-603) behandelt 'ursprünglich leer UND Wert===false' als synthetischen Default (P181) und speichert null. Damit ist ein ABSICHTLICH gesetztes visible=false nicht vom leeren Default unterscheidbar → wird zu null → der Knoten bleibt sichtbar. Ein frisch hinzugefügter Knoten lässt sich per Bool-false gar nicht verstecken."
  - "Ursache (ADR 0026): P181 nutzte EINEN fixen Synthetik-Default-Sentinel (bool false) für BEIDE Felder. Das ist richtig für disabled (neutral=false), aber falsch für visible (neutral=true). Zwei Felder mit entgegengesetzten Defaults können keinen gemeinsamen Sentinel teilen."
acceptance:
  - "Editor: ein frisch hinzugefügter Knoten mit ungebundenem/leerem Visible zeigt im Bool-Control 'true' (nicht 'false'). disabled zeigt weiterhin 'false'."
  - "Save-Roundtrip (unit, base-fields.spec.ts): ein unberührtes leeres Visible speichert weiterhin `null` (kein synthetisches Binding); ein unberührtes leeres Disabled ebenso `null`. Öffnen→ohne Berührung Speichern erzeugt an visible/disabled KEINEN Diff."
  - "Save-Roundtrip (unit): visible bewusst auf `false` gesetzt persistiert `{kind:'literal',value:false}` (wird NICHT zu null verschluckt). disabled bewusst auf `true` gesetzt persistiert `{kind:'literal',value:true}`."
  - "Save-Roundtrip (unit): visible bewusst auf `true` gesetzt persistiert `null` ODER `{kind:'literal',value:true}` — beide semantisch = sichtbar; der ursprünglich-leer-Fall bleibt `null`. Ein gespeichertes Nicht-Literal-Binding (state/store/reactive/…) an visible/disabled öffnet unverändert im richtigen Typ und wird beim Speichern durchgereicht."
  - "Browser (E2E, an ui-list): ein ui-list mit Visible=`false` (Bool-Literal) wird NICHT gerendert — der Knoten ist im DOM abwesend (per Messung/Locator-Count 0), nicht nur CSS-versteckt. Derselbe ui-list mit leerem Visible IST sichtbar (Locator-Count > 0). Beweist die owner-Meldung 'false versteckt wirklich' rot→grün."
  - "Zentral in resources/lib/editor-common.js (installBaseFields Init + applyBaseFields Save); wirkt für ALLE View-Knoten, die die Helfer nutzen. Knoten, die visible/disabled inline verwalten (P181-Result-Liste: ui-skeleton für visible), werden geprüft und angeglichen, falls sie den Sentinel duplizieren."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/base-fields.spec.ts
dependencies: [P181]
status: in_progress
---
# P202 — Base-Field `visible`: neutral = true, bewusstes `false` versteckt wirklich

> Entscheidung & Begründung: [ADR 0026](../../../adr/0026-boolean-state-base-field-neutral-equals-semantic-default.md)
> (korrigiert P181). Zentraler Editor-Fix in `resources/lib/editor-common.js` —
> eine Stelle, alle View-Knoten.

## Kern des Fixes

Der neutrale Wert eines Boolean-State-Basisfelds — sowohl die **Leer-Anzeige** als
auch der **Synthetik-Default-Sentinel** beim Speichern — ist der **semantische
Default des Feldes**, nicht pauschal `false`:

| Feld | leer ⇒ | Leer-Anzeige | Sentinel (⇒ `null` speichern) |
|---|---|---|---|
| `visible` | true (sichtbar) | **true** | ursprünglich leer **und** Wert === **true** |
| `disabled` | false (aktiv) | **false** | ursprünglich leer **und** Wert === **false** |

- **Init (`installBaseFields`, ~Z.498-515):** bei ursprünglich leerem Feld den
  angezeigten Bool-Wert auf den Feld-Neutralwert setzen (`visible`→`true`,
  `disabled`→`false`), statt alles per Bool-Typ auf `false` zu normalisieren.
- **Save (`applyBaseFields`, ~Z.585-603):** den Synthetik-Default gegen den
  **pro-Feld**-Neutralwert prüfen. Ursprünglich-leer + Neutralwert → `null`; **jeder
  andere Literal-Wert — inkl. des entgegengesetzten Booleans — wird verbatim
  persistiert.**

Ergebnis: leeres `Visible` liest „true"; ein bewusstes `Visible = false`
persistiert `{kind:literal,value:false}` und **versteckt** den Knoten;
`disabled`-Verhalten unverändert; gespeicherte Nicht-Literal-Bindings unberührt.

## acceptance / verify

- `verify: browser` — die „false versteckt wirklich"-Wirkung an `ui-list` im
  Haupt-Checkout durch den Orchestrator beweisen
  ([[orchestrator-must-verify-e2e-in-main-checkout]]). Die Sichtbarkeit wird per
  **DOM-Messung** belegt (Locator-Count 0 vs. >0), nicht per Klasse/Tag — die
  reine Anzeige-Prüfung hätte den verschluckten `false` (wie P181) verfehlt.
- `tests/e2e/nodes/editor/base-fields.spec.ts` erweitern: leer→`true`-Anzeige;
  bewusstes visible=`false` persistiert Literal-false; unberührt→`null`;
  disabled unverändert.

## Risiken / Hinweise

- **Nur** die Leer-Anzeige und der pro-Feld-Sentinel ändern sich. Die P181-
  Invariante „leer = kein Binding" (`null`) bleibt für beide Felder erhalten.
- Ein ursprünglich-leeres, bewusst auf `true` gesetztes `visible` darf als `null`
  gespeichert werden (semantisch identisch) — kein Regressionsbruch.
- Nicht mit **P174** (store-typedInput-Layout) und **P181** (Bool-Default-*Typ*)
  verwechseln: dies ist der **pro-Feld-Neutralwert** von Anzeige + Save-Sentinel.
