# Testkatalog: ui-progress

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P137
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P137)

- `value` als kanonischer typedInput (Umbenennung von `valuePath`); literaler
  number-Wert setzt den Fortschritt; Store-/state-Binding zeigt Live-Wert.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- `label` als Wert-Satz-typedInput.
