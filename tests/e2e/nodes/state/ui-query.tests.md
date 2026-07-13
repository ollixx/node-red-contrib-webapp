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

## Testziele (P175) — terminale data/error-Rückgabe (kein Loop) — umgesetzt

Bugfix: der `queryInputHandler` emittierte jede eingehende Nachricht am Out-Port
(`send(msg)` unbedingt, auch `data`/`error`). Das verursachte eine Endlosschleife
(`out → Datenquelle → Shaper → In-Port → out → …`).

Unit `packages/runtime/test/p175-query-terminal-data-no-loop.test.ts`:

- `data`-Rückgabe (passender `queryPath`): `send` wird **nicht** aufgerufen (0
  Out-Emits) — terminal. State + Snapshot-Push laufen weiterhin.
- `error`-Rückgabe (passender `queryPath`): `send` wird **nicht** aufgerufen —
  terminal. State + Snapshot-Push laufen weiterhin.
- Trigger ohne `data`/`error` (onEnter, `refresh:true`, `loading:true`): `send`
  wird **einmal** aufgerufen (Fetch-Auslöser erreicht die Datenquelle).
- Fachfremde Message (kein `msg.ui.query`): Pass-Through — `send` wird einmal
  aufgerufen, Nachricht unverändert.
- Nicht erkanntes `msg.ui.query` (nur `queryPath`, kein `data`/`error`/`refresh`):
  Pass-Through (1 Out-Emit).

E2E-Nachweis (Orchestrator-Lauf im Haupt-Checkout, `verify: browser`):

- `tests/e2e/nodes/state/ui-query-pipeline.spec.ts` bleibt grün — keine Regression
  im verdrahteten Datenpfad.
- `tests/e2e/nodes/state/ui-query-paging-loop.spec.ts` bleibt grün — `params`-Out-
  Port-Refresh feuert weiterhin; die Datenrückgabe schließt die Schleife nicht mehr.

## Testziele (P214) — impliziter per-Query Params-Store (ADR 0030) — umgesetzt

Jede `ui-query` besitzt implizit ihren per-client Params-Store unter
`ui.queries.<queryPath>.params` (kein extra Knoten). Adressierbar wie jeder Store
über die **Query-ID** — in `ui-store-action` (schreiben), `ui-store-read` (lesen)
und `store`-Value-Bindings (lesen). Das explizite `params`-Feld bleibt Override:
gesetzt ⇒ externer geteilter `ui-store`, leer ⇒ impliziter Store (neuer Default).

Unit `packages/runtime/test/p214-query-params-store.test.ts`:

- **Auflösung:** `resolveStoreReferenceById(<queryId>)` /
  `findQueryParamsStoreDefinitionById` liefern einen synthetischen Store mit
  `statePath = ui.queries.<queryPath>.params`; eine echte `ui-store`-ID löst
  unverändert auf den echten Store; unbekannte ID → `undefined`; eine Query ohne
  `queryPath` ist kein Ziel.
- **Schreiben:** `ui-store-action(store=<queryId>, set page=2)` schreibt
  `ui.queries.<path>.params.page` (Broadcast); `patch` mergt in `params` ohne die
  `data`-Hülle zu zerstören; per-client landet der Wert nur im Client-Slice.
- **Lesen:** `ui-store-read(store=<queryId>)` liefert den Params-Wert (Sub-Pfad
  und ganzer `params`-Block), per-client.
- **Reaktiver Refresh:** ein `ui-store-action`-Write auf die impliziten Params
  feuert den Out-Port-Refresh der Query mit den aktuellen Params;
  `triggerParamQueryRefresh` matcht die Query über ihre EIGENE ID (impliziter
  Ziel); `clientId` wird an die Refresh-Nachricht durchgereicht.
- **Override:** ist ein explizites `params`-Feld gesetzt, ist die Query-ID KEIN
  impliziter Refresh-Ziel; der externe Store treibt den Refresh weiter (P161).

Unit `packages/renderer/test/p214-query-params-store-binding.test.ts`:

- Ein `store`-Binding auf eine `ui-query`-ID (`store(<queryId>).page`) löst auf
  `ui.queries.<path>.params.page` auf (gemessen am gerenderten Text).
- Ein echtes `ui-store`-Binding bleibt unbeeinflusst (die Query-Params-Registrierung
  überschattet es nicht).

Unit `packages/editor/test/p214-stores-preset-query-params.test.ts`:

- Das `stores`-Picker-Preset listet je Query ein Params-Ziel, beschriftet
  „Query &lt;Name&gt; · Params" und mit der Query-ID als Wert; echte Stores bleiben
  vorhanden; App-Scoping filtert die Query-Ziele wie echte Stores.

E2E `tests/e2e/nodes/state/ui-query-implicit-params-store.spec.ts` (`verify:
browser`, Orchestrator-Lauf im Haupt-Checkout):

- Paged `ui-table` an `query:entities`, KEIN manuell angelegter/verdrahteter
  params-Store im Flow (Guard: kein `ui-store`-Knoten vorhanden). Ein
  `ui-store-action(store=<queryId>, set page)` schreibt die impliziten Params;
  die Query re-fetcht mit `params.page=2` und die Tabelle wechselt Alice → Bob.
  Gemessen an den gerenderten Zeilen; kein Loop (Seite 1 verschwindet).

## Testziele (P214, Teil 2) — Params bei JEDEM Out-Port-Refresh — umgesetzt

Owner-Nachtrag zur P214-Acceptance: löst **irgendetwas** einen Refresh-Emit der
Query aus (Params-Store-Änderung P161, `onEnter`, schlichte Refresh-Message durch
`queryInputHandler`, `ui-query-action`-Refresh), hängt die Query die AKTUELLEN
Params (aus ihrem aufgelösten Params-Store — implizit ODER explizit — für den
`clientId`) an `msg.ui.query.params`. Schließt die Lücke, dass ein schlichter
Refresh die Datenquelle bisher OHNE Params erreichte — **gilt auch für den
expliziten Params-Store**.

Unit `packages/runtime/test/p214-params-on-every-refresh.test.ts`:

- `resolveCurrentQueryParams`: liest den impliziten Slice
  `ui.queries.<path>.params` (implizit) bzw. den expliziten Store-Slice (bei
  gesetztem `params`), per-client bzw. broadcast; `undefined`, wenn keine Params
  existieren (Schlüssel bleibt weg).
- `queryInputHandler`: eine schlichte Refresh-Message ohne Params trägt am
  Out-Port die aktuellen impliziten Params; ein `onEnter` (ohne `msg.ui.query`)
  bekommt eine Query-Hülle mit aktuellen Params; der **explizite** Params-Store
  wird ebenso angehängt (Lücke geschlossen); vom Aufrufer mitgegebene Params
  werden NICHT überschrieben; eine fachfremde Message geht **unverändert** (gleiche
  Objekt-Referenz) durch; ohne Params bleibt der `params`-Schlüssel weg;
  per-client trägt der Refresh die Params DIESES Clients.
- `ui-query-action`-Refresh (reference + wire): ohne Payload trägt der Refresh die
  aktuellen impliziten Params; ein expliziter Payload gewinnt weiterhin; ohne
  gespeicherte Params UND ohne Payload bleibt der `params`-Schlüssel weg
  (P212-Vertrag gewahrt).

**P175 bleibt grün:** die Anreicherung ist orthogonal zur Terminal-Regel — der
`data`/`error`-Absorptionspfad wird nie berührt, und die fachfremde
Durchreich-Message bleibt byte-identisch (`toBe(msg)`).

E2E `tests/e2e/nodes/state/ui-query-implicit-params-store.spec.ts` (2. Test):

- Nach `set page=2` (impliziter Store) → Tabelle zeigt Bob (Seite 2). Ein
  **schlichter Refresh** (`msg.ui.query={queryPath,refresh:true}`, KEINE eigenen
  Params) über den In-Port → die Query hängt die aktuellen Params (`page=2`) an →
  die Mock-DB liefert erneut Seite 2 → die Tabelle bleibt Bob (nicht Alice).
  Gemessen an den gerenderten Zeilen. Ohne Anreicherung (Vor-P214-Lücke) würde die
  DB auf Seite 1 zurückfallen (Alice).

## P218 (ADR 0033) — refresh forwards a clean trigger (no stale payload)

Ein von `ui-query` konsumierter `refresh` wird als SAUBERER Fetch-Trigger
weitergereicht: `msg.ui.query` (`queryPath/refresh/params`) bleibt für den Fetch,
aber die stale `msg.payload` des Triggers wird VERWORFEN, damit sie nicht
nachgelagert als Query-DATEN (`replace`) doppelt-konsumiert wird.
Unit: `packages/runtime/test/p218-consumed-envelope-cleanup.test.ts`;
E2E-Repro: `tests/e2e/nodes/state/ui-query-refresh-replace-cleanup.spec.ts`.
