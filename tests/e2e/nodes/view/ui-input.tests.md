# Testkatalog: ui-input

> Format gemäß `.ai/agents/node-testing.md`. Vollständig neu für P123 (ADR 0012).

## Rendering

| ID | Testziel |
|---|---|
| R01 | `sl-input` wird gerendert und ist sichtbar |
| R02 | `label`-Prop setzt das `label`-Attribut am `sl-input` |
| R03 | `inputType=email` setzt `type="email"` am `sl-input` |
| R04 | `inputType=number` setzt `type="number"` am `sl-input` |
| R05 | `placeholder` setzt das `placeholder`-Attribut |

## Value-Binding (P123 — voller kanonischer Satz)

| ID | Testziel |
|---|---|
| V01 | `value: { kind:"literal", value:"hello" }` — Initialwert im Feld sichtbar |
| V02 | `value: { kind:"state", path:"..." }` — Live-Wert aus dem Client-State |
| V03 | `valuePath`-Migration — Legacy-Config mit `valuePath` öffnet Feld mit dem korrekten Initialwert (runtime migriert automatisch) |

## Disabled-Binding (P123 — Boolean-Zustand-Satz)

| ID | Testziel |
|---|---|
| D01 | `disabled: { kind:"literal", value:true }` rendert `sl-input[disabled]` |
| D02 | `disabled: { kind:"literal", value:false }` rendert `sl-input` ohne `disabled` |
| D03 | `disabled`-Store-Binding deaktiviert Feld live, wenn Store-Wert truthy |

## Events — Output-Port

| ID | Testziel |
|---|---|
| E01 | `sl-change` → POST /event `{ event:"change", params:{ value } }` |
| E02 | `sl-submit` → POST /event `{ event:"submit", params:{ value } }` |

## writeTo Write-Back (P203 / ADR 0027 — echtes Two-Way ohne Verdrahtung)

| ID | Testziel |
|---|---|
| W01 | `value=store(x).name` UND `writeTo=store(x).name`, `writeTrigger=submit`: Tippen + Enter/Blur schreibt per-client in den Store; ein ZWEITER an `store(x).name` gebundener `ui-text` zeigt den neuen Wert live (SSE-Re-Render, Textinhalt gemessen), ohne function-Knoten |
| W02 | `writeTrigger=submit`: ein reines `change`-Event schreibt NICHT zurück (der Mirror-View bleibt auf dem Ausgangswert) |
| W03 | `writeTrigger=change`: jedes `change`-Event schreibt zurück und aktualisiert den gebundenen View live |
| M01 (editor) | Legacy `storeId`+`path` migriert beim Öffnen zu `writeTo={kind:"store", path:<storeId>, subPath:{kind:"literal", value:<path>}}`; Speichern lässt die Alt-Felder weg |
