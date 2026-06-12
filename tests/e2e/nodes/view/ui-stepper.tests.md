# Testkatalog: ui-stepper

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P156 (Field-Typing Welle 2).

Spec: `tests/e2e/nodes/composite/ui-stepper.spec.ts`
Unit: `packages/runtime/test/p156-stepper-activestep-typedinput.test.ts`
Editor-Regression: `tests/e2e/nodes/editor/navigation-nodes.spec.ts`,
`tests/e2e/nodes/editor/minimal-coverage.spec.ts`

## Zielmodell (P156, ADR 0012)
- `activeStepPath` → **`activeStep`**: kanonischer Wert-typedInput, **zweiseitig** —
  liest den aktiven Schritt (Step-Index) aus Store/State (`bind.value`, vom Renderer
  aufgelöst → markiert den passenden Schritt aktiv) UND der Schrittwechsel emittiert
  das `change`-Event mit dem gewählten Step-Index, das im Flow in denselben Store
  zurückgeschrieben wird (Roundtrip). Default-Typ `string`.
- Das bestehende Step-Change-Event am Out-Port bleibt unverändert.
- **Scope nur der aktive Schritt** — die `steps`-Liste (Step-Definition) und
  dynamische Slots sind ausdrücklich nicht Teil dieser Phase (separate
  Collections-Arbeit). `orientation` bleibt Enum-Select.
- Migration: `activeStepPath` (nackter State-Pfad) → `{kind:"state", path}`.
- Identisches Muster wie ui-tabs `activeTab` (P155) und ui-pagination
  `currentPage` (P154).

## E2E-Tests (`ui-stepper.spec.ts`)
| ID | Ziel |
|---|---|
| P45 | Schritte gerendert als `button.webapp-step` mit Labels; Default-Schritt (Index 0) aktiv; konfigurierter `activeStep` markiert; Klick → `change`/`params.value`. |
| A03 | `activeStep` **zweiseitig**: Step-Klick → change-Event → verdrahteter Store-`set` → SSE-Re-Render aktiviert den gewählten Schritt. |
| A04 | Externe Store-Änderung → SSE-Re-Render aktiviert den Schritt. |
| E01 | `change`: Step-Klick emittiert `change` mit `params.value` (Step-Index). |
| M01 | Legacy `activeStepPath` migriert: aktiver Schritt aus dem Store. |

## Unit-Tests (`p156-stepper-activestep-typedinput.test.ts`)
- Kanonisches `activeStep`-Binding-Objekt (state/store/literal) → `activeStep`.
- Legacy `activeStepPath` → State-Binding (Migration).
- Kanonisches `activeStep` gewinnt über Legacy-Pfad.
- Ohne `activeStep`/`activeStepPath` bleibt `activeStep` `undefined`.
- `stepChange`-Event bleibt neben dem `activeStep`-Binding erhalten.
- Read-Resolution (Compile→Render→Serialize): Literal/State/Legacy-Pfad markieren
  den richtigen Schritt-Index aktiv.

## Editor-Regression
- `minimal-coverage.spec.ts`: ui-stepper `fields:["name","mount"]`, `inputs:1`.
- `navigation-nodes.spec.ts`: `activeStepBinding`-typedInput-Feld vorhanden;
  1 Output-Port.
