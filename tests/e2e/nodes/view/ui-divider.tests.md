# Testkatalog: ui-divider

> Format gemäß `.ai/agents/node-testing.md`. Aktualisiert im Konformitäts-Pass
> P230 (node-conformance). Editor-Base-Field-Coverage liegt in
> `tests/e2e/nodes/editor/base-fields.spec.ts` (nicht dupliziert).

## Feature-Tests (`ui-divider.spec.ts`)

| Test | Testziel |
|---|---|
| horizontal → `<sl-divider>` ohne `vertical` | Orientation horizontal gerendert |
| vertical → `<sl-divider vertical>` | Orientation vertical gerendert |
| Literal-Label mittig im Divider | `label`-Literal wird angezeigt |
| Store-gebundenes Label → aufgelöster Live-Wert (P150) | `label`-Binding wird vom Renderer aufgelöst und gerendert |
| kein Input-/Output-Port (statisches Blatt) | ui-divider ist ein statischer Leaf-Knoten (P76) |

## Base-Fields color/visible (entblockt durch P231, grün)

Vormals `test.fixme` — die Base-Fields fehlten im Schema (Zod strippte sie). **P231** deklariert sie im Schema + sourcet sie generisch in den Deploy-Pfad; die Tests sind ent-fixmed und **grün** (gemessen):

| Test | Testziel |
|---|---|
| gebundenes `color` → `sl-divider style="--color:…"` | Base-Field color emittiert die Shoelace-`--color`-Property |
| `--color` am gerenderten Element (computed style) | color wirkt auf die Linie (gemessen) |
| `visible` an Store=false → nicht gerendert | Render-Gate blendet aus (ADR 0037) |
| `visible` an Store=true → gerendert | Render-Gate zeigt an |

## Locale-Hilfe (P265, i18n-Pilot — `tests/e2e/nodes/editor/help-i18n-locales.spec.ts`)

ui-divider ist der Pilot der ADR-0042-User-Doku: die Hilfe lebt in
`nodes/view/locales/en-US/ui-divider.html` + `locales/de/ui-divider.html`
(kein Inline-`data-help-name`-Block mehr); der Doku-Link zeigt auf den
User-Guide (`docs/guide/nodes/ui-divider.md`).

| Test | Testziel |
|---|---|
| Default (en-US-Browser) → englische Hilfe | en-US-Locale-Datei wird ausgeliefert |
| editor-language=en-US → englische Hilfe | explizite Editor-Sprache en-US |
| editor-language=de → deutsche Hilfe + de-Guide-Link | de-Locale-Datei wird ausgeliefert (Sprachumschaltung gemessen) |
| editor-language=de-DE → deutsche Hilfe | Sprachpräfix-Fallback de-DE→de |
| editor-language=fr → englische Hilfe | defaultLang-Fallback →en-US |
| Guide-Link-`<a>` gerendert (en + de) | Info-Sidebar rendert funktionierenden Guide-Doc-Anker |

## Hinweise

- Platzierung (order/row/col) ist generisches Layout-Boilerplate — abgedeckt von der
  Layout-Suite, nicht pro Knoten (node-testing.md: Suite schlank halten).
