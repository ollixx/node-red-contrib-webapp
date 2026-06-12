---
id: P161
node: ui-query
epic: nodes/ui-query
title: "Query-Reaktives Paging: params-Store-getriggerter Refresh (Out-Port) + totalCount/pageCount im Lifecycle; ui-pagination bindet total←query, currentPage↔params-Store"
findings:
  - "Wie kann ich ein ui-pagination direkt an eine query binden? Die Felder da sind alle statisch. -> Aufbohren nötig?"
  - "Loop (Owner 2026-06-11): Store für Params → Query bindet auf die Params, lädt Daten von der DB (welcher Event triggert das?) → Paging-Knoten bindet auf den Store → 'Next Page' ändert page im Store, Query reagiert, löst Refresh aus und lädt neue Daten."
verify: browser
spec: docs/nodes/state/ui-query.md
tests: tests/e2e/nodes/state/ui-query.tests.md
dependencies: [P154, P160]
status: done
---
# P161 — Query-reaktives Paging

> Setzt auf **P154** (ui-pagination-Felder bindbar) + **P160** (Lifecycle-Lese-
> Konvention) auf und folgt dem **Trigger-Modell aus
> [ADR 0016](../../../../adr/0016-ui-query-trigger-model-visible-no-auto-fire.md)**:
> jeder Fetch hängt an einer **sichtbaren** Ursache. Dieses Paket deckt nur den
> **Refresh** ab — die Query beobachtet ihre **deklarierte `params`-Referenz** und
> **emittiert bei Änderung einen Refresh am Out-Port**; der verdrahtete Fetch lädt
> und schickt Daten + `totalCount` zurück.
>
> **Nicht hier:** der **Initial-/Arrival-Load**. Der läuft per **`route onEnter →
> ui-query`-Wire** (ADR 0016 §2), **nicht** per Auto-on-Arrival — kein
> autonomes Selbst-Feuern der Query bei Client-Ankunft.

## Zielmodell — der reaktive Loop

0. **Initial-Load** (ADR 0016 §2): `route onEnter → ui-query`-Wire feuert den
   ersten Fetch — per-client (`onEnter` trägt die `clientId`). **Kein**
   Auto-on-Arrival. Dieser Schritt ist Voraussetzung, aber nicht Gegenstand
   dieses Pakets.
1. **`params`-Store** hält `{ page, pageSize, sort?, search? }`.
2. **ui-query** referenziert den params-Store (`params`-Feld, **deklarierte
   sichtbare Referenz** — ADR 0016 §3) und **beobachtet** ihn. Bei Änderung
   **emittiert die Query eine Refresh-`msg.ui.query`** am
   **Out-Port** (mit den aktuellen Params im `msg`, z. B. `msg.ui.query.params`),
   und setzt den Lifecycle auf `loading`.
   - **Implementieren/verifizieren:** ob die Query den params-Store heute schon
     beobachtet + am Out-Port feuert, ist offen (tooling-bedingt nicht geprüft).
     Falls nicht vorhanden → bauen. Reuse `triggerParamQueryRefresh` falls real.
3. **Wired Fetch (Autor):** Out-Port → DB/HTTP/function lädt die Seite anhand der
   Params → zurück an den In-Port: `msg.ui.query = { queryPath, data, totalCount }`.
4. **ui-query** legt `data` **und `totalCount`/`pageCount`** unter
   `ui.queries.<queryPath>` ab (Lifecycle `data` + Paging-Metadaten), pusht an
   die Clients.
5. **ui-pagination:** `total` ← `query:<path>.totalCount` (lesend);
   `currentPage` ↔ **params-Store** (`store`-Binding auf `page`, zweiseitig).
6. **„Next Page"** schreibt `page+1` in den params-Store → Schritt 2 feuert →
   neue Daten. **Kein Loop** (die Datenrückgabe verändert die Params nicht).

## Aufbohr-Punkte konkret

- **ui-query Out-Port-Refresh** bei params-Store-Änderung (mit Params im msg);
  Lifecycle → `loading` während des Ladens.
- **Paging-Metadaten im Lifecycle:** `totalCount` (und optional `pageCount`)
  neben `data` unter `ui.queries.<path>` ablegen; per `query:<path>.totalCount`
  bindbar (schließt den offenen Spec-Punkt „Wie Paging im Ladezustand
  abgebildet wird").
- **ui-pagination-Muster:** `total` ← Query-Metadaten, `currentPage` ↔ params-
  Store dokumentieren (Felder sind nach P154 bindbar).
- **Debounce (Sub-Entscheidung):** Default **sofort**; optionales `debounceMs`-
  Feld am ui-query, damit „search"-Tippen nicht jede Taste eine Query auslöst.

## acceptance (observierbar, browser)

- Ein vollständiger Paging-Flow: ein params-Store `{page,pageSize}`, eine
  ui-query mit `params`=Store + verdrahtetem Fetch (Mock-DB liefert Seite +
  totalCount), eine ui-table (`rows = query:list.data`) und eine ui-pagination
  (`total = query:list.totalCount`, `currentPage = store(params).page`):
  - Initial lädt Seite 1; Tabelle zeigt die Zeilen; Pagination zeigt das totale
    Seiten-/Element-Maß aus `totalCount`.
  - **„Next Page"** klickt → `page` im Store wird 2 → Query feuert Refresh am
    Out-Port → Mock-DB liefert Seite 2 → Tabelle aktualisiert sich; kein Loop.
  - Während des Ladens ist `query:list.loading` true (an einem ui-text/Spinner
    sichtbar).
- (Falls Out-Port-Refresh/totalCount heute fehlen: vorher rot, nachher grün.)

## spec / tests

- spec: `docs/nodes/state/ui-query.md` — den reaktiven Paging-Loop + die
  Paging-Metadaten (`totalCount`/`pageCount`) dokumentieren (löst den offenen
  Spec-Punkt); `docs/nodes/navigation/ui-pagination.md` — das Bindungs-Muster
  (total←query, currentPage↔params-Store).
- tests: `tests/e2e/nodes/state/ui-query.tests.md` um den End-to-End-Paging-Flow
  erweitern; Runtime-Unit für Out-Port-Refresh bei params-Änderung +
  totalCount-Ablage.

## Risiken / Hinweise

- Der **Trigger** ist die Query (Out-Port), **nicht** ein separater ui-action-
  Knoten — `refreshAction` bleibt nur der **manuelle** Zusatz-Trigger.
- ui-query bleibt eigenständig (Owner-Entscheid P160); kein Merge in ui-store.

## Result

- **delivered:** The reactive paging loop (ADR 0016 trigger model — no auto-on-arrival). (1)
  **ui-query out-port refresh on params change** — extended the existing `triggerParamQueryRefresh`
  (it previously sent only a bare `{queryPath, refresh:true}`) to carry the params store's current
  value as `msg.ui.query.params`, flip the observing query's lifecycle to `loading` + push a
  snapshot (per-client/broadcast), and carry `clientId`. (2) **Paging metadata in lifecycle** —
  `applyQueryMessage` stores `totalCount`/`pageCount` alongside `data` (data-only push keeps last
  known); `buildQuerySources` + the renderer `QUERY_LIFECYCLE_FIELDS` expose `query:<path>.totalCount`
  / `.pageCount` via the P160 lifecycle convention (not forked). (3) **Optional `debounceMs`** on
  ui-query (default immediate; coalesces to the latest params). (4) ui-pagination binding pattern
  documented (`total ← query:<path>.pageCount` read; `currentPage ↔ params-store .page` two-way,
  P154) — no node change, fields already bindable. Specs `ui-query.md` + `ui-pagination.md` updated.
  Touched `nodes/state/ui-query.html`, `packages/schema/src/node-definitions.ts`, `nodes/webapp.js`,
  `packages/runtime/*`, `packages/renderer/src/renderer.ts`.
- **stats:** 11 files (+637/−29); new `packages/runtime/test/p161-query-reactive-paging.test.ts`
  (+8: totalCount storage, out-port refresh w/ params, loading-not-data, per-client, foreign-store
  ignore, debounce), `packages/renderer/test/p161-query-paging-meta.test.ts` (+2), and E2E
  `tests/e2e/nodes/state/ui-query-paging-loop.spec.ts`. `pnpm build` exit 0; unit **1393 green**
  (runtime 952 / renderer 71 / editor 96 / schema 274). Targeted E2E green: paging-loop 1/1 +
  ui-query-pipeline + ui-pagination **11/11**.
- **notes:** **Orchestrator follow-up fix (`fix/P161-paging-loop`, test-only — product unchanged):**
  the implementing agent wrote the paging-loop spec test-first but never RAN it; it had three wiring
  bugs — (a) bound `rows = query:list.data` instead of the bare data path `query:list` (only reserved
  suffixes `.loading`/`.error`/`.totalCount`/`.pageCount` resolve via the lifecycle map; `.data` →
  undefined → "No rows loaded"), (b) bound pagination `total` to item-count (42) instead of `pageCount`
  (5), (c) the mock-DB re-fetched its own echoed result → infinite loop; fixed to drop messages already
  carrying `msg.ui.query.data` per ADR 0016 ("the data return must not re-trigger the fetch"). The
  P161 product runtime was correct throughout. **Verify limitation:** the host E2E environment hung
  hard on full-suite runs tonight (a run wedged with a 25-min-static log at test 86/551, after earlier
  1.9h/1.2h degraded runs); after killing the wedged Node-RED, P161 was verified via the targeted
  ui-query/pagination suite + the full unit suite — the change is test-only with no product delta from
  the unit-green merge, and the pre-P161 full-suite baseline was green at 549/550. A full-suite
  confirmation is advisable once the host E2E environment is healthy.
- **cost:** session a3553e0dc7b0c4675 (~40m) + fix session adf69e1874f4cfeb3 (~9m); plus orchestrator
  verify/recovery incl. the hung-run kill.
