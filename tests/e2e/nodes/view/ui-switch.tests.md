# Testkatalog: ui-switch

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P125
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P125)

- `value` als kanonischer typedInput (literaler Default `boolean`); Store-/state-
  Binding zeigt Live-Wert; Umschalten schreibt weiterhin zurück.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- bindbares `disabled` (Boolean-Zustand) mit Store-Binding deaktiviert live.
