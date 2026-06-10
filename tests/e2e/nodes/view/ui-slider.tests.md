# Testkatalog: ui-slider

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P126
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P126)

- `value` als kanonischer typedInput (literaler Default `number`); Store-/state-
  Binding zeigt Live-Wert; Schieben schreibt weiterhin zurück.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- bindbares `disabled` (Boolean-Zustand) mit Store-Binding deaktiviert live.
