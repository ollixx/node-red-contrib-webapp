# Testkatalog: ui-pagination

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P154 (Field-Typing Welle 2).

Spec: `tests/e2e/nodes/view/ui-pagination.spec.ts`
Unit: `packages/runtime/test/p154-pagination-total-currentpage-typedinput.test.ts`
Editor-Regression: `tests/e2e/nodes/editor/navigation-nodes.spec.ts`,
`tests/e2e/nodes/editor/minimal-coverage.spec.ts`

## Zielmodell (P154, ADR 0012)
- `totalPath` → **`total`**: kanonischer Wert-typedInput, **lesende Quelle**
  (Default `number`) → Gesamt-Seitenzahl. Wird über `bind.totalPages` vom
  Renderer aufgelöst.
- `currentPagePath` → **`currentPage`**: kanonischer Wert-typedInput,
  **zweiseitig** — liest die Live-Seite aus Store/State (`bind.value`) UND der
  Seitenwechsel emittiert das `change`-Event mit der neuen Seite, das im Flow in
  denselben Store zurückgeschrieben wird (Roundtrip).
- `pageSize` bleibt Config-Number.
- Migration: `totalPath`/`currentPagePath` (nackte State-Pfade) → `{kind:"state", path}`.

## E2E-Tests (`ui-pagination.spec.ts`)
| ID | Ziel |
|---|---|
| R01 | Prev/Next-Buttons + Seiten-Label gerendert. |
| T01 | `total` Literal-Binding → "/ total"-Label. |
| T02 | `total` State-Binding → Seitenzahl aus dem Store aufgelöst (lesend). |
| C01 | `currentPage` State-Binding setzt die initiale aktive Seite. |
| C02 | `currentPage` **zweiseitig**: Klick → change-Event → verdrahteter Store-`set` → SSE-Re-Render verschiebt die aktive Seite. |
| C03 | Externe Store-Änderung → SSE-Re-Render setzt die aktive Seite. |
| E01 | `pageChange`: Klick emittiert `change` mit `params.page`. |
| M01 | Legacy `currentPagePath` migriert: aktive Seite aus dem Store. |
| M02 | Legacy `totalPath` migriert: Total-Label aus dem Store aufgelöst. |

## Unit-Tests (`p154-pagination-total-currentpage-typedinput.test.ts`)
- Kanonisches `currentPage`-Binding-Objekt → `page`.
- Kanonisches `total`-Binding-Objekt → `totalPages`.
- Literal-Bindings (Zahl) für beide.
- Legacy `currentPagePath`/`totalPath` → State-Binding (Migration).
- Kanonische Felder gewinnen über Legacy-Pfade.
- `pageSize` bleibt Config-Number → State-Binding aus dem Literal.
- Leere Config wirft nicht.

## Editor-Regression
- `minimal-coverage.spec.ts`: ui-pagination `fields:["name","mount"]`, `inputs:1`.
- `navigation-nodes.spec.ts`: `total`/`currentPage` typedInputs vorhanden;
  Legacy-Pfade migrieren in die typedInput-Werte.
