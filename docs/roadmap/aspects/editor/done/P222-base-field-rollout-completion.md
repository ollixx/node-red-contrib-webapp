---
id: P222
title: "Editor: Base-Field-Rollout (ADR 0015) vervollständigen — visible/disabled/color/size fehlen auf ~26 der 33 View-Knoten; Applicability-Audit + Retrofit"
epic: aspects/editor
status: done
dependencies: []
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/base-fields.spec.ts
---
# P222 — Base-Field-Rollout vervollständigen

> Rationale: [ADR 0015](../../../../adr/0015-common-base-fields-and-editor-structure.md).
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

## Result

**Delivered.** Base-Field-Rollout (ADR 0015) vervollständigt — alle 26 fehlenden View-Knoten haben jetzt den „Allgemein"-Block (`visible`/`disabled`/`color` + `size` je nach Anwendbarkeit). Kein Runtime-Umbau.
- **Audit zuerst.** Autoritative Anwendbarkeits-Tabelle in `docs/nodes/concepts/editor.md` („Rollout-Status und Anwendbarkeits-Audit P139→P222"): `visible` überall applicable (die dokumentierte Fundament-Lücke); `disabled` N/A auf nicht-interaktiven Display-Knoten; `color` N/A wenn `variant`/`severity` die Farbe regelt oder keine Farbfläche existiert; `size` meist N/A/eigen. Die irreführende „every node offers…"-Aussage mit der Realität in Einklang gebracht.
- **Retrofit — 26 Knoten** rufen `installBaseFields`/`applyBaseFields` mit Carrier-Defaults: input (input/textarea/select/checkbox/radio/switch/slider/datepicker), display (button/text/avatar/icon/image/container/table), feedback (badge/progress/log/empty-state/toast), navigation (accordion/breadcrumb/menu/pagination/stepper/tabs).
- **Helper** `resources/lib/editor-common.js`: neue `omit`-Option — Knoten mit eigenem dediziertem Control für ein Base-Feld lassen es aus der „Allgemein"-Gruppe fallen statt auf der `#node-input-<field>`-Carrier-ID zu kollidieren (die 9 Form-Knoten behalten ihr inline `disabledBinding`; avatar/checkbox + die 5 `installSizeSelectBox`-Knoten behalten ihre Size-UI; icon behält sein Color-Feld; empty-state seinen Visible-Path).
- **Tripwires ohne wachsende Allowlist.** `check-specs.js`: `visible`/`disabled`/`color` in `COMMON_BOILERPLATE` (universelle Base-Felder, zentral in editor.md dokumentiert — wie Layout-Boilerplate) → keine 78 Per-Knoten-Felder-Zeilen; Carrier per Suffix-Regel auto-allowlisted. **`check:roundtrip` unberührt** (6 Knoten/7 Felder/5 allowlisted): Base-Feld-Carrier laufen über `installBaseFields`, nicht `installReferenceSelectors`/`editableList`, werden also gar nicht enumeriert — der Round-Trip ist trotzdem bewiesen (durch die Base-Fields-E2E-Matrix, nicht durch Stilllegen).

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/editor/base-fields.spec.ts` **54 passed** (3,4 min): datengetriebene `BASE_FIELD_MATRIX` (26 Zeilen = die Audit-Tabelle) — je Knoten: „Allgemein"-Gruppe injiziert, jedes Feld `active`/`na`(gegraut+Hint)/`omit` korrekt, und das Leit-Base-Feld round-trippt open→save (`visible` überall; `color` für empty-state). Plus die 28 bestehenden Base-Field-Tests (divider/list/alert/P181/P202) grün.

**Stats.** Unit unverändert grün (schema 497, editor 178, renderer 158, runtime 1240) — reine Editor-Änderung. `pnpm build`/`lint`/`check:specs` (42)/`check:roundtrip`/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P222` (worktree), ~28 min (19:13Z→19:41Z); erster Anlauf am Session-Rate-Limit gestorben (0 Commits, kein Verlust), nach Reset neu gestartet. Token-Zeile in `.ai/agent-runs.jsonl`. (Dieser Sub-Agent löste ebenfalls `git reset --hard develop` im Haupt-Checkout aus; der Schaden — dieselben 3 Katalog-Dateien — war zu dem Zeitpunkt bereits vom Orchestrator rekonstruiert + committed.)
