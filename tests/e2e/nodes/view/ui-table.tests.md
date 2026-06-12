# Testkatalog: ui-table

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P158 (Field-Typing Welle 2).

## P158 — rows (strukturelle Array-Daten-Quelle) (ADR 0012)

> `rows` ist die kanonische STRUKTURELLE Array-**Daten-Quelle** (Store/Query/
> Reactive/JSON-Literal) — die Tabelle rendert ihre Zeilen SELBST (`rows` ist eine
> Datenquelle, KEIN Repeats-Fall). Auflösung über denselben strukturellen Pfad wie
> ui-select `options` (P133) / ui-menu `items` (P157), damit ein legitimer
> Array-Slice nicht vom Display-Scalar-Guard abgelehnt wird, geroutet über
> `bind.rows` (nicht den skalaren `bind.value`-Display-Pfad). Default-Editor-Typ
> `json` (statisches Array-Literal). Legacy `rowsPath` migriert zu
> `{kind:"state", path}` (P137-Shim). `columns` bleibt separat (Collections);
> `footer` bleibt Checkbox.

### E2E (`tests/e2e/nodes/composite/ui-table.spec.ts`)

| Test | Ziel |
|---|---|
| columns render as `<th>` header cells | Spaltenköpfe rendern |
| rows render as `<td>` cells with correct values | JSON-Literal-Array rendert die Zeilen |
| empty table shows 'No rows loaded.' message | Leere/ungebundene Daten-Quelle → Leer-Hinweis |
| store-array rows render the table rows reactively | Store-Array wird strukturell aufgelöst und gerendert |
| legacy rowsPath migrates to a state binding and renders rows | Alt-`rowsPath` lädt verlustfrei als state-Binding |
| row click → POST /event with event='rowSelect' and params.rowId | rowSelect-Event bleibt funktional |
| inject new rows → table updates after navigate | Input-Port-Push aktualisiert die Zeilen (SSE) |

### Editor-Panel (`tests/e2e/nodes/editor/view.spec.ts`)

| Test | Ziel |
|---|---|
| ui-table — columns required drives validity; rows typedInput present | `columns` Pflicht; `rowsBinding` typedInput vorhanden; `rows` optional |
| ui-table — legacy rowsPath migrates into the rows typedInput | Alt-`rowsPath` → state-Binding im typedInput |
| ui-table — configured event surfaces as the output port label | Event-Konfiguration setzt das Output-Port-Label |

### Customers-CRUD (Beispiel-Suite)

| Test | Ziel |
|---|---|
| tests/e2e/customers-crud* (Table-Render, SSE-Row-Updates, CRUD) | ui-table als Beispiel-Zentrum bleibt nach Rename+Migration grün |
