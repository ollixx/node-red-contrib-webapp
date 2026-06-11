# Testkatalog: ui-divider

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P150
> (ADR 0012 — Field-Typing) und dort zu befüllen.

## Geplante Testziele (P150)

- `label` als kanonischer Wert-typedInput; Literal zeigt den Text; Store-/state-
  Binding zeigt den Live-Wert.

## Editor: Basis-Felder (P139, ADR 0015 — Referenzknoten)

Abgedeckt durch `tests/e2e/nodes/editor/base-fields.spec.ts` (Editor-only) und
`packages/editor/test/p139-base-fields.test.ts` (pure Anwendbarkeits-/Hint-Logik):

- Gruppe „Allgemein" wird injiziert (idempotent), mit Überschrift.
- `visible` (anwendbar): Boolean-Zustand-typedInput, by default sichtbar.
- `disabled` (N/A): Zeile sichtbar, Control disabled, Hinweis sichtbar + als
  `title`-Tooltip.
- `color` (anwendbar, non-variant): aktiver Wert-typedInput; Literal-Farbe
  roundtrippt als Binding-Objekt durch Speichern/Wieder-Öffnen.
- `size` (N/A, „Erweitert"): Abschnitt default eingeklappt, auf-/zuklappbar;
  Feld disabled mit Hinweis.
- variant→color-Ausschluss: `resolveBaseFieldApplicability({ variant: true })`
  liefert `color` N/A mit Variant-Hinweis (im Editor-Runtime evaluiert).
