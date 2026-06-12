---
id: P159
node: ui-icon
epic: nodes/ui-icon
title: "ui-icon: size auf Größen-Token-Select (xs..xl) angleichen (Spec/Code-Widerspruch); color via P139"
findings:
  - "Field-Typing-Audit (2026-06-11): ui-icon size ist im HTML ein freies Textfeld, in der Spec aber ein xs..xl-Select — Widerspruch."
  - "Owner: an die Size-Token-Konvention angleichen (xs..xl); später wird das ein ENUM als Teil eines TypedInputs (P143)."
verify: browser
spec: docs/nodes/display/ui-icon.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
dependencies: []
status: in_progress
---
# P159 — ui-icon: size → Größen-Token-Select

> Field-Typing-Audit-Folge. Behebt einen **Spec/Code-Widerspruch**. `color`
> gehört zum Basis-Feld `color` (ADR 0015) → läuft über **[[P139]]**, nicht hier.
> Die spätere Dynamisierung (size als ENUM-typedInput) ist **[[P143]]**.

## Befund (heute)
- `size`: HTML = freies Textfeld („e.g. 24 or 1.5rem"); Spec = SelectBox
  `xs/sm/md/lg/xl`. Widerspruch.
- `color`: freies Textfeld (CSS-Wert) — das ist das **allgemeine Basis-`color`**
  (ADR 0015), wird über den P139-Rollout getypt, **nicht** in diesem Paket.

## Zielmodell
- `size` → **Größen-Token-SelectBox** `xs/sm/md/lg/xl` (wie button/input via
  `installSizeSelectBox`), Spec-konform. Default `md`.
- **Migration:** bestehende freie CSS-Größen (z. B. `24`, `1.5rem`) → auf den
  nächstliegenden Token mappen bzw. als `<wert> (bestehend)` halten, damit
  Alt-Konfigurationen nicht brechen; im Result dokumentieren.
- (Dynamik kommt später als ENUM-typedInput, P143 — hier nur das Select.)

## acceptance (observierbar, browser)
- `size` ist eine xs..xl-SelectBox (Default md); ein Alt-Knoten mit freier Größe
  bricht nicht (gemappt bzw. `(bestehend)`); Render unverändert für die Token.
- Bestehende ui-icon-E2E grün.

## spec / tests
- spec: `docs/nodes/display/ui-icon.md` — `size` als SelectBox bestätigen,
  Migration der freien Werte dokumentieren; `color` → Verweis auf P139.
- tests: `tests/e2e/nodes/view/ui-icon.tests.md` (neu): size-Select rendert je
  Token; Migration eines freien Alt-Werts.
