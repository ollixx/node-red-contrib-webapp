---
id: P206
title: "writeTrigger-Wert `none`: automatischen Write-Back abschalten (manuell verdrahten) — enum none|change|submit, Default submit; über alle 8 Input-Knoten"
epic: aspects/editor
findings:
  - "Owner (2026-07-09): 'wir sollten noch einen write trigger NONE haben, wenn man das manuell machen will.'"
  - "Kontext (P203/P204, ADR 0027): writeTrigger ist heute enum ['change','submit'] (packages/schema/src/contracts.ts:324, Default 'submit'). Die Runtime applyInputWriteBack (nodes/webapp.js) mappt jeden Wert ≠ 'change' auf 'submit' → ein hypothetisches 'none' würde FÄLSCHLICH bei submit schreiben. Das writeTrigger-Select steht pro Knoten in 8 HTML-Templates (input/select/checkbox/switch/textarea/slider/radio/datepicker) mit nur submit|change."
acceptance:
  - "Schema (packages/schema): WRITE_TRIGGERS wird ['none','change','submit'] (Default bleibt 'submit'). writeTriggerSchema akzeptiert 'none'. Unit-Test: 'none' zulässig; Default unverändert 'submit'."
  - "Runtime (nodes/webapp.js applyInputWriteBack): bei def.writeTrigger === 'none' KEIN Write-Back — früher Return, BEVOR das submit-Fallback-Mapping greift. Kein Store-/Flow-/Global-Schreiben, keine Store-Op. (Für Nicht-Text-Kontrollen, die sonst 'submit'→'change' umdeuten, gilt 'none' ebenfalls als 'nie schreiben'.)"
  - "Events bleiben: mit writeTrigger='none' feuern die `change`/`submit`-Output-Events des Knotens WEITER (additiv, unverändert) — der Nutzer verdrahtet die Persistenz selbst (change→function→ui-store). Per E2E an ui-input belegt: writeTrigger='none' + gesetztes writeTo ⇒ ein zweiter an den Store gebundener View ändert sich NICHT automatisch, aber ein change-Event mit dem neuen Wert wird emittiert."
  - "writeTo optional bei 'none': ein Input mit writeTrigger='none' und leerem writeTo ist gültig (kein Validierungs-/Render-Fehler) — der leere Write-Target ist dann bewusst."
  - "Editor: das writeTrigger-Select in ALLEN 8 Input-Node-HTMLs erhält `<option value=\"none\">none</option>` (Reihenfolge z. B. submit/change/none); die geteilte Seed/Save-Logik (installWriteToField in resources/lib/editor-common.js) übernimmt 'none' verlustfrei (öffnen→speichern→Wert bleibt 'none')."
  - "Doku: docs/nodes/input/ui-input.md (+ die übrigen Input-Node-Docs) beschreiben writeTrigger none|change|submit inkl. der 'none = manuell verdrahten'-Semantik; die Node-Test-Kataloge listen den none-Test."
verify: browser
spec: docs/nodes/input/ui-input.md
tests: tests/e2e/nodes/view/ui-input.tests.md
dependencies: [P203, P204]
status: done
---
# P206 — writeTrigger `none` (Auto-Write-Back abschaltbar)

> Entscheidung & Begründung: [ADR 0027](../../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)
> (Amendment „writeTrigger=none"). Erweitert den in P203/P204 gebauten Vertrag um
> einen expliziten Opt-out.

## Kern

`writeTrigger` bekommt den Wert **`none`** (enum `none|change|submit`, Default
`submit`). `none` = die Runtime schreibt **nichts** zurück; die `change`/`submit`-
Output-Events feuern weiter → der Flow-Autor persistiert selbst
(`change → function → ui-store`). `writeTo` darf bei `none` leer sein.

## Kritischer Punkt

Das heutige Runtime-Mapping `writeTrigger === "change" ? "change" : "submit"`
(nodes/webapp.js applyInputWriteBack) **subsumiert alles Nicht-`change` unter
`submit`**. `none` MUSS davor mit einem frühen Return abgefangen werden, sonst
schreibt es bei submit. Genau diese Falle (aus P181/P202 bekannt: „ein neuer
enum-Wert fällt in den Default-Zweig") explizit vermeiden.

## acceptance / verify

- `verify: browser` — an ui-input beweisen (Orchestrator, Haupt-Checkout,
  [[orchestrator-must-verify-e2e-in-main-checkout]]): writeTrigger='none' ⇒ zweiter
  gebundener View ändert sich NICHT automatisch, aber ein `change`-Event feuert
  (per Messung/Request-Beobachtung), rot→grün.
- Schema/Runtime per Unit; Editor-Select per E2E an mehreren Knoten.

## Risiken / Hinweise

- **8 Node-HTMLs** tragen das Select inline — den `none`-Options-Eintrag in allen
  ergänzen, nicht nur ui-input.
- Nicht mit `change` verwechseln: `change` schreibt bei jeder Eingabe, `none`
  schreibt nie (Events bleiben in beiden Fällen).

## Result

- **delivered:** `writeTrigger` gains a third value **`none`** (opt out of auto write-back — wire
  persistence manually), across all 8 input controls (ADR 0027 amendment). Schema
  (`contracts.ts`): `WRITE_TRIGGERS = ['none','change','submit']`, default stays `'submit'`;
  `writeTriggerSchema` accepts `'none'`; `writeTo` was already `.optional()` so a `none` input with an
  empty `writeTo` validates. **Runtime critical fix** (`nodes/webapp.js` `applyInputWriteBack`): an
  **early return on `def.writeTrigger === 'none'` BEFORE** the `=== "change" ? "change" : "submit"`
  fallback (the P181/P202 default-branch trap), AND the `dispatchClientEvent` gate short-circuited
  (`noWriteBack` → `triggers=false`) so the non-text `change` branch can't re-introduce a write — so
  `none` = "never write" for BOTH text and non-text controls. The `change`/`submit` OUTPUT events fire
  unchanged (additive). Editor: `<option value="none">none</option>` added to all 8 node HTMLs;
  `installWriteToField`/`saveWriteToField` round-trip `'none'` losslessly. Docs (ui-input + 7 siblings)
  describe `none|change|submit` incl. "none = wire it manually".
- **stats:** 23 files. Develop verification: build 0; full unit green (**schema 452 / runtime 1099**);
  **ui-input W04 measured green** — with `writeTo` set + `writeTrigger='none'`, after change the SECOND
  bound `ui-text` stays `"untouched"` (asserted content unchanged after a settle) while the node's
  `change` output event fires carrying the new value; W01–W03 + select/checkbox/slider write-backs
  unregressed by the gate change (60/60 in the targeted batch). Full suite **664 passed** (only the
  pre-existing accordion + flaky ui-tabs race, both chipped). check:specs/links/roadmap + lint green.
- **notes:** Explicitly avoided the "new enum value falls into the default branch" trap the package
  called out (from P181/P202) — the fix is TWO guards (the write-back early return + the dispatch gate),
  not just one. With P203/P204/P206, the `writeTrigger` contract is complete (`none|change|submit`)
  across every input control.
- **cost:** session agent-af36b513b7b104884, ~14m.
