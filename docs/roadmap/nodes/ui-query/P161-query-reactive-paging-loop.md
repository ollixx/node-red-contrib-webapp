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
status: pending
---
# P161 — Query-reaktives Paging

> Setzt auf **P154** (ui-pagination-Felder bindbar) + **P160** (Lifecycle-Lese-
> Konvention) auf und folgt dem **Trigger-Modell aus
> [ADR 0016](../../../adr/0016-ui-query-trigger-model-visible-no-auto-fire.md)**:
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
