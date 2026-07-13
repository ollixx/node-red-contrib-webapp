---
id: P222
title: "Editor: Base-Field-Rollout (ADR 0015) vervollständigen — visible/disabled/color/size fehlen auf ~26 der 33 View-Knoten; Applicability-Audit + Retrofit"
epic: aspects/editor
status: pending
dependencies: []
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/base-fields.spec.ts
---
# P222 — Base-Field-Rollout vervollständigen

> Rationale: [ADR 0015](../../../adr/0015-common-base-fields-and-editor-structure.md).
> Owner-Befund 2026-07-13 (bei der ui-alert-Analyse): der Base-Field-Rollout ist
> weit unvollständig.

## findings

- ADR 0015 / `resources/lib/editor-common.js:334` erklärt: „Every node offers the
  four common base fields visible/disabled/color/size". **Tatsächlich** rufen nur
  **7 von 33** View-Knoten `installBaseFields`/`applyBaseFields` auf
  (ui-accordion-section, ui-divider, ui-list, ui-repeat, ui-skeleton, ui-tab und —
  neu, 2026-07-13 — ui-alert). Die übrigen **~26** Knoten (u.a. ui-text, ui-button,
  ui-input, ui-badge, ui-select, ui-checkbox, ui-switch, ui-radio, ui-textarea,
  ui-slider, ui-datepicker, ui-image, ui-icon, ui-progress, ui-container, ui-menu,
  ui-breadcrumb, ui-pagination, ui-stepper, ui-avatar, ui-table, ui-tabs,
  ui-accordion, ui-toast, ui-empty-state, ui-log …) haben **kein** `visible`-,
  `disabled`-, `color`- oder `size`-Feld im Editor.
- Konkrete Folge (Owner-Report): ui-alert war „unbrauchbar", weil die deklarative
  Sichtbarkeit (`visible`) laut Doku das Fundament ist, es aber gar kein Feld gab.
  Dieselbe Lücke besteht auf ~26 weiteren Knoten.
- Der Runtime-Pfad ist bereits vorbereitet: `mapConfig` in `webapp.js` mappt ein
  gesetztes `component.visible` generisch auf `visibleIf` (P172) — es fehlt nur die
  **Editor-Seite** (der `installBaseFields`-Aufruf + Carrier-Defaults pro Knoten).

## acceptance

- **Applicability-Audit (zuerst).** Eine autoritative Tabelle: pro View-Knoten,
  welche der vier Base-Fields **applicable** vs. **N/A** sind (mit Begründung/Hint),
  analog den bestehenden Configs (z.B. ui-divider: color applicable, disabled/size
  N/A; ui-alert: visible applicable, color N/A weil severity). Variant-Knoten →
  `color` N/A (severity/variant regelt Farbe); nicht-interaktive Knoten → `disabled`
  N/A; usw. Die Tabelle wird in `docs/nodes/concepts/editor.md` (oder einem
  referenzierten Doc) festgehalten.
- **Retrofit.** Jeder Knoten, der laut Audit mindestens ein applicable Base-Field
  hat, ruft `common.installBaseFields(BASE_FIELDS)` in `oneditprepare` und
  `common.applyBaseFields(BASE_FIELDS)` in `oneditsave` auf und deklariert die
  nötigen Carrier-Defaults (`visibleBinding`/`disabledBinding`/`colorBinding`), exakt
  dem etablierten Muster (ui-divider/ui-list/ui-alert) folgend. `check:specs` bleibt
  grün (Carrier sind allowlisted).
- **Editor-Beweis pro Knoten.** Für jeden retrofitteten Knoten: der „Allgemein"-
  Block erscheint; applicable Felder sind aktive typedInputs, N/A-Felder sind
  gegraut mit Hint; ein `visible`-Binding round-trippt open→save (ADR 0031). Als
  parametrisierte Erweiterung von `base-fields.spec.ts` (nicht 26× handkopiert —
  eine daten­getriebene Matrix über die Applicability-Tabelle).
- **Doku.** `editor.md` beschreibt die Base-Fields als universelles Konzept mit der
  Applicability-Tabelle; irreführende „every node offers…"-Aussagen werden mit der
  Realität in Einklang gebracht.

## verify

`browser` — der „Allgemein"-Block + visible-Round-Trip an den retrofitteten Knoten
im laufenden Editor (Playwright), datengetrieben über die Applicability-Matrix.

## spec

`docs/nodes/concepts/editor.md` — die Base-Field-Applicability-Tabelle + das
universelle Konzept.

## tests

`tests/e2e/nodes/editor/base-fields.spec.ts` — zu einer datengetriebenen Matrix über
alle Knoten ausgebaut (Gruppe injiziert, applicable/N/A korrekt, visible-Round-Trip).

## notes for the implementer

- Muster-Referenz: `nodes/view/ui-divider.html` (Base-Field-Referenzknoten),
  `ui-list.html`, `ui-alert.html`. Applicability-Config-Shape:
  `{ visible, disabled, color, size, variant, advanced, hints }`.
- **Groß** (~26 Knoten): darf in Batches pro Kategorie (input / display / feedback /
  navigation) aufgeteilt werden; das Audit (die Tabelle) ist der gemeinsame erste
  Schritt und muss zuerst stehen, damit die Batches ohne Interpretation umsetzbar
  sind. Jeder Batch ist erst `done`, wenn seine Knoten den Editor-Beweis bestehen.
- Kein Runtime-Umbau nötig (visible→visibleIf-Mapping existiert, P172).
