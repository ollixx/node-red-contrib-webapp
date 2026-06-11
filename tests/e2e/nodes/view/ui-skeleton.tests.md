# Testkatalog: ui-skeleton

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P138
> (ADR 0012 — Binding-Ubiquität) und dort zu befüllen.

## Geplante Testziele (P138)

- `visible` als Standard-Boolean-Zustand-typedInput (kein `visiblePath`-Sonderweg);
  Store-Binding blendet das Skeleton live ein/aus.
- `visiblePath`→state-Binding-Migration (Legacy-Config).
- `lines` ist disabled (mit Hinweis), wenn der `displayType` keine Linien rendert.
