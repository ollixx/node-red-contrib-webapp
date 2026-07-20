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
| I01 | P252 `showInfo:true` → gemessene Info-Zeile `.webapp-pagination-info` „Seite X von Y" (kompaktes Seiten-Label bleibt unverändert). |
| I02 | P252 `showInfo` weggelassen → keine `.webapp-pagination-info`-Region (count 0). |
| M01 | Legacy `currentPagePath` migriert: aktive Seite aus dem Store. |
| M02 | Legacy `totalPath` migriert: Total-Label aus dem Store aufgelöst. |

### P252-Auflösung der vermuteten Inert-Felder
- **`showInfo`** — war vestigial (nie im Editor/mapConfig/Serializer). **Implementiert:**
  Editor-Checkbox → mapConfig → `props.showInfo` → Serializer emittiert
  `.webapp-pagination-info` „Seite X von Y" nur bei `true`. Tests I01/I02.
- **`variant`** (`numbered`/`simple`) — vestigial, keine distinkte Darstellung möglich.
  **Entfernt** aus Schema + Editor (war nie drin) + Spec. Back-compat: Zod verwirft
  unbekannte Schlüssel; mapConfig hat es nie erzeugt.
- **`totalItems`** — vestigial; `totalPages` (aus `total`) ist die alleinige
  Seitenzahl-Quelle. **Entfernt** aus Schema + Spec. Gleiche Back-compat.

## Unit-Tests (`p154-pagination-total-currentpage-typedinput.test.ts`)
- Kanonisches `currentPage`-Binding-Objekt → `page`.
- Kanonisches `total`-Binding-Objekt → `totalPages`.
- Literal-Bindings (Zahl) für beide.
- Legacy `currentPagePath`/`totalPath` → State-Binding (Migration).
- Kanonische Felder gewinnen über Legacy-Pfade.
- `pageSize` bleibt Config-Number → State-Binding aus dem Literal.
- Leere Config wirft nicht.
- P252: `showInfo:true` → boolean `showInfo`-Prop; weggelassen → kein `showInfo`-Key.

## Editor-Regression
- `minimal-coverage.spec.ts`: ui-pagination `fields:["name","mount"]`, `inputs:1`.
- `navigation-nodes.spec.ts`: `total`/`currentPage` typedInputs vorhanden;
  Legacy-Pfade migrieren in die typedInput-Werte.
