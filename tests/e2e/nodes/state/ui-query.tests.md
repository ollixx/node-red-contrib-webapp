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

## Testziele (P161) — reaktiver Paging-Loop — umgesetzt

Der `params`-Store-getriggerte Out-Port-Refresh + `totalCount`-Ablage (ADR 0016
§3). Vorher fehlend: der Refresh trug die aktuellen Params nicht mit und setzte
den Lifecycle nicht auf `loading`; `totalCount`/`pageCount` wurden nicht
gespeichert/exponiert.

E2E `tests/e2e/nodes/state/ui-query-paging-loop.spec.ts`:

- Voller Loop: `params`-Store `{page,pageSize}` + `ui-query` (`params`=Store) +
  verdrahtete Mock-DB (liefert Seite + `totalCount`) + `ui-table`
  (`rows = query:list.data`) + `ui-pagination` (`total = query:list.totalCount`,
  `currentPage = store(params).page`).
- Initial lädt Seite 1; „Next Page" (Store `page=2`) → Query feuert Out-Port-
  Refresh mit `params.page=2` → Mock-DB liefert Seite 2 → Tabelle aktualisiert
  sich; **kein Loop** (Seite-1-Zeile verschwindet).
- `totalCount` erreicht die Pagination.

Unit:

- `packages/runtime/test/p161-query-reactive-paging.test.ts` — `applyQueryMessage`
  speichert `totalCount`/`pageCount` (data-only-Push behält letzten Wert);
  `buildQuerySources` exponiert sie; `triggerParamQueryRefresh` feuert am
  Out-Port mit Params, setzt Lifecycle `loading` (ohne Daten zu verändern),
  zielt per-client, ignoriert fremde Stores, und debounced mit `debounceMs`.
- `packages/renderer/test/p161-query-paging-meta.test.ts` —
  `query:<path>.totalCount` / `.pageCount` aus dem Lifecycle; kein Shadowing für
  unbekannte Query-Pfade.
