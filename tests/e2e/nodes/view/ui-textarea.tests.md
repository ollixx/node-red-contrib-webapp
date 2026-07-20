# Testkatalog: ui-textarea

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P128
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P128)

- `value` als kanonischer typedInput (literaler Default `string`); Store-/state-
  Binding zeigt Live-Wert; Tippen schreibt weiterhin zurück.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- bindbares `disabled` (Boolean-Zustand) mit Store-Binding deaktiviert live.

## writeTo Write-Back (P204 / ADR 0027 — gemessen, keine Verdrahtung)

Eine Textarea ist text-artig: Submit-Geste = **Blur** (Enter fügt Zeilenumbruch ein).

| ID | Beschreibung |
|---|---|
| W01 | `writeTrigger=submit`: ein reines `change`-Event schreibt NICHT (Mirror bleibt `seed`); erst **Blur** (`focusout`) persistiert per-client → ZWEITER an `store(x).notes` gebundener `ui-text` zeigt `committed` live (SSE, Textinhalt gemessen), ohne function-Knoten. |
| W02 | `writeTrigger=change`: jedes `change`-Event schreibt zurück und aktualisiert den gebundenen View live (`init`→`live-typing`). |

## P253 — label / placeholder Binding-Auflösung (Muster 4, ADR 0012)

Unit (`packages/runtime/test/p253-textarea-label-placeholder-binding.test.ts`):

| Test | Ziel |
|---|---|
| state-gebundenes `label` → `sl-textarea[label]` = aufgelöster Wert | `state`-Bindung auf `label` wird renderer→serializer aufgelöst UND als `label`-Attribut gerendert. Schließt den P237-Guardrail-Fund (Doku war „Textfeld"). |
| state-gebundener `placeholder` → `sl-textarea[placeholder]` = aufgelöster Wert | Beweist den P253-Serializer-Fix: der `sl-textarea`-Block emittierte das `placeholder`-Attribut vorher NICHT; jetzt wird die aufgelöste Bindung gemessen als `placeholder="<aufgelöst>"` gerendert (rot, wenn Fix oder Auflösung bricht). |
| Pfad-Strings leaken nicht ins Markup | Die rohen Binding-Pfade (`form.lbl`/`form.ph`) erscheinen nicht im Markup; kein `[object Object]`. |
