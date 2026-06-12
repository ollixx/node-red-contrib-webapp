# Testkatalog: ui-query

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P160.

## Testziele (P160) — umgesetzt

Pipeline-Lücke bestätigt und gefixt (vorher rot, nachher grün): der Snapshot
erhielt `queries` leer (`buildAppSnapshot` gab `queries: {}` durch) und der
`queryInputHandler` persistierte den Push nie.

E2E `tests/e2e/nodes/state/ui-query-pipeline.spec.ts`:

- Verdrahteter Datenfluss: `msg.ui.query.data` → `ui.queries.<queryPath>` → eine
  gebundene `ui-table` (`rows = query:customers.list`) zeigt die Daten.
- Zweiter Push aktualisiert die View live (SSE, ohne Reload).
- `error`-Push an einer `query:customers.list.error`-gebundenen `ui-text` zeigt
  sich.

Unit:

- `packages/renderer/test/p160-query-lifecycle.test.ts` — `query:<path>` = Daten;
  `.loading`/`.error`/`.updatedAt` = Lebenszyklus; kein Shadowing für unbekannte
  Query-Pfade.
- `packages/runtime/test/p160-query-live-state.test.ts` — `applyQueryMessage`
  (data/error/refresh) + `buildQuerySources` (Daten-Tree + Lifecycle-Map).
