# Testkatalog: ui-tabs

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P155 (Field-Typing Welle 2).

Spec: `tests/e2e/nodes/view/ui-tabs.spec.ts`
Unit: `packages/runtime/test/p155-tabs-activetab-typedinput.test.ts`
Editor-Regression: `tests/e2e/nodes/editor/navigation-nodes.spec.ts`,
`tests/e2e/nodes/editor/minimal-coverage.spec.ts`

## Zielmodell (P155, ADR 0012)
- `activeTabPath` → **`activeTab`**: kanonischer Wert-typedInput, **zweiseitig** —
  liest den aktiven Tab (Tab-`id`) aus Store/State (`bind.value`, vom Renderer
  aufgelöst → markiert den passenden `sl-tab` aktiv) UND der Tab-Wechsel emittiert
  das `change`-Event mit der gewählten Tab-ID, das im Flow in denselben Store
  zurückgeschrieben wird (Roundtrip). Default-Typ `string`.
- Das bestehende Tab-Change-Event am Out-Port bleibt unverändert.
- **Scope nur der aktive Tab** — die `tabs`-Liste (Tab-Definition) und dynamische
  Slots sind ausdrücklich nicht Teil dieses Phase (separate Collections-Arbeit).
- Migration: `activeTabPath` (nackter State-Pfad) → `{kind:"state", path}`.

## E2E-Tests (`ui-tabs.spec.ts`)
| ID | Ziel |
|---|---|
| R01 | Zwei Tabs gerendert als `sl-tab`/`sl-tab-panel`-Paare. |
| A01 | `activeTab` Literal-Binding markiert den passenden `sl-tab` aktiv. |
| A02 | `activeTab` State-Binding löst den aktiven Tab aus dem Store auf. |
| A03 | `activeTab` **zweiseitig**: Tab-Klick → change-Event → verdrahteter Store-`set` → SSE-Re-Render aktiviert den gewählten Tab. |
| A04 | Externe Store-Änderung → SSE-Re-Render aktiviert den Tab. |
| E01 | `change`: `sl-tab-show` emittiert `change` mit `params.value` (Tab-ID). |
| M01 | Legacy `activeTabPath` migriert: aktiver Tab aus dem Store. |

## Unit-Tests (`p155-tabs-activetab-typedinput.test.ts`)
- Kanonisches `activeTab`-Binding-Objekt (state/store/literal) → `activeTab`.
- Legacy `activeTabPath` → State-Binding (Migration).
- Kanonisches `activeTab` gewinnt über Legacy-Pfad.
- Ohne `activeTab`/`activeTabPath` bleibt `activeTab` `undefined`.
- `tabChange`-Event bleibt neben dem `activeTab`-Binding erhalten.
- Read-Resolution (Compile→Render→Serialize): Literal/State/Legacy-Pfad markieren
  den richtigen `sl-tab` aktiv.

## Editor-Regression
- `minimal-coverage.spec.ts`: ui-tabs `fields:["name","mount"]`, `inputs:1`.
- `navigation-nodes.spec.ts`: `tabs`-Feld vorhanden; 1 Output-Port.
