# Testkatalog: ui-radio

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P127
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P127)

- `value` als kanonischer typedInput (Anzeige/Initial); Store-/state-Binding
  zeigt Live-Wert; Auswahl schreibt weiterhin zurück.
- `valuePath`→state-Binding-Migration (Legacy-Config).
- bindbares `disabled` (Boolean-Zustand) mit Store-Binding deaktiviert live.
