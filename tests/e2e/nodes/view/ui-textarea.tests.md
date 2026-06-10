# Testkatalog: ui-textarea

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P128
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P128)

- `value` als kanonischer typedInput (literaler Default `string`); Store-/state-
  Binding zeigt Live-Wert; Tippen schreibt weiterhin zurück.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- bindbares `disabled` (Boolean-Zustand) mit Store-Binding deaktiviert live.
