---
id: P173
node: ui-list
epic: nodes/ui-list
title: "ui-list: Single-Select — selectable + selectedId (zweiseitig) + Selected-Zustand + itemSelect-Event"
findings:
  - "Owner-Review (2026-06-13): itemSelect setzt einen 'Auswahl-Modus' voraus, den es nirgends gibt (kein selectable/selectionMode), und liefert dieselbe Payload wie itemClick → ununterscheidbar. Multi-Select steht zugleich als offener Punkt."
  - "Owner-Entscheidung (2026-06-13): minimales Single-Select jetzt — Feld selectable + selectedId-Binding (zweiseitig, Store) + visueller Selected-Zustand; itemSelect feuert bei Auswahlwechsel. Multi-Select bleibt offener Punkt."
acceptance:
  - "selectable (Checkbox, Default false) schaltet Single-Select ein: Klick auf eine Zeile markiert sie sichtbar als ausgewählt; bei false kein Auswahl-Zustand."
  - "selectedId (zweiseitiges Binding, analog activeTab): liest die ausgewählte id aus dem gebundenen Store/State und schreibt sie beim Auswahlwechsel zurück; ungültige/leere id → keine Zeile markiert."
  - "itemSelect-Event feuert NUR bei selectable UND Auswahlwechsel; params {rowId,row} + clientId/sourceId/appId. Ohne selectable wirkungslos."
  - "Roundtrip (browser): externe Store-Änderung markiert die passende Zeile (SSE-Re-Render); Klick auf eine andere Zeile aktualisiert den Store über selectedId."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: [P171]
status: done
---
# P173 — ui-list: Single-Select

> Löst den Review-Widerspruch W1 (itemSelect ohne Auswahl-Modell). Setzt auf
> **P171** auf (items/Item-Schema müssen stehen, damit `id` als Auswahl-Anker
> trägt). Multi-Select bleibt bewusst ausgeklammert (offener Punkt der Spec).

## Umfang

1. **`selectable`** (Boolean-Checkbox, Default `false`) — schaltet Single-Select.
2. **`selectedId`** — zweiseitiges Binding auf die `id` der ausgewählten Zeile
   (analog `activeTab` bei ui-tabs, P155): liest aus Store/State, schreibt beim
   Wechsel zurück. Nur relevant bei `selectable`.
3. **Selected-Zustand** im Renderer: die Zeile mit `id == selectedId` wird
   sichtbar markiert; ungültige id → keine Markierung.
4. **`itemSelect`-Event:** feuert bei Auswahlwechsel (nur bei `selectable`);
   `params {rowId,row}` + Standardfelder.

## acceptance / verify

- `verify: browser` — Roundtrip + Selected-Zustand im laufenden Frontend beweisen;
  E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Keine** id am Item → Auswahl per Array-Index als Fallback-`rowId`; eine stabile
  `id` ist für verlässliche Auswahl dringend empfohlen (Doku-Hinweis).
- Multi-Select (Set-Binding statt `selectedId`) ist **nicht** hier — offener Punkt.

## Result

- **delivered:** Minimal single-select for ui-list, resolving review contradiction W1. **`selectable`**
  (boolean checkbox, default false) gates single-select; **`selectedId`** is a TWO-WAY binding on the
  selected row's `id` (mirrors ui-tabs `activeTab`/P155: reads from the bound store/state via
  `bind.selectedId`, writes back on selection change). The serializer marks the row with
  `id == selectedId` as selected (`aria-selected` + `webapp-list-item--selected`, selectable-only;
  empty/invalid id → none; no-id item → array-index fallback rowId) and emits `data-webapp-selectable`;
  the client fires **`itemSelect`** ONLY when `selectable` AND the selection changes (`params {rowId,row}`
  + clientId/sourceId/appId) — distinct from P171's `itemClick` (any row click). Multi-select stays an
  open spec point. Schema gained `selectable` + `selectedId` on ui-list; touched schema/webapp.js/
  editor/ui-list.html/webapp-client.js/webapp-serializer.js + spec + catalogue.
- **stats:** 10 files (+552/−9); +9 runtime unit (`p173-list-single-select-behaviour.test.ts`) + 6 E2E
  (S01–S06). Unit green (runtime 992 / renderer 103 / editor 117). Develop verification: `pnpm build`
  exit 0; **52/52 green** — ui-list single-select S01–S06 (selectable off→no selection; selectedId
  state binding marks row; external store→SSE re-mark; two-way roundtrip click→itemSelect→store→selected;
  itemSelect only-in-selectable-on-change; selectable-off→itemClick-only) + base-fields + minimal-coverage
  regression. check:roadmap + check:links + lint OK.
- **notes:** **Orchestrator recovery:** the implementing sub-agent died from a transient API/socket
  error after ~33m with the work uncommitted in its worktree (editor/client/serializer/E2E/runtime-test
  done) but **missing the two schema fields** (`selectable`/`selectedId`) and the docs, and never
  committed. A recovery agent (directed at that worktree) added the schema fields, verified the dead
  agent's renderer/serializer/client plumbing was coherent (the generic `bind` loop already resolved
  `selectedId`), updated the spec + catalogue, re-validated, ran E2E, and committed (7cba9fe). Reused the
  ui-tabs two-way pattern — no new mechanism.
- **cost:** dead session acab290d8a5069cb4 (~33m, died) + recovery session aa83198932ff42e4d (~7m); +
  orchestrator develop browser proof.
