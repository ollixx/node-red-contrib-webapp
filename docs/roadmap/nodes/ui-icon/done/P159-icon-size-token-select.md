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
status: done
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

## Result

- **delivered:** Resolved the ui-icon `size` spec/code contradiction. Added
  `installIconSizeSelectBox()` to `resources/lib/editor-common.js` (mirrors `installSizeSelectBox`
  via the same `injectFieldGroup` primitive but with the icon token set `xs/sm/md/lg/xl`);
  `nodes/view/ui-icon.html` replaces the free-text size input with the injected SelectBox, default
  `md`. Schema `size` widened to `z.union([z.enum([…]), z.string()])` for back-compat. `color`
  untouched (P139 base-field rollout); the later dynamic ENUM-typedInput is P143. Spec updated.
- **stats:** 6 files, +126/−7 (+ a 1-line follow-up test fix). Develop verification: `pnpm build`
  exit 0, full Playwright suite **549 passed / 0 failed** (9.2m clean run); 938 unit green;
  check:roadmap + check:links + lint OK.
- **notes (migration):** a legacy free CSS size (`"24"`, `"1.5rem"`) is handled at three layers —
  schema union accepts it without a Zod error; the editor SelectBox detects a non-token value and
  prepends a `"<value> (bestehend)"` option so it round-trips (user can pick a real token, after
  which the legacy value drops on next save); the renderer emits `webapp-icon--<value>` as-is
  (no matching size CSS → harmless ambient size). No data lost, no node breaks.
- **notes (verify):** the authoritative full run first showed 4 reds in a degraded 1.2h
  environment — 3 were environmental (ui-alert/p12/p36, 6–43m durations, browser-closed/protocol
  errors) and cleared on the clean re-run; the 4th was a real **test-authoring bug** in P159's own
  migration-guard spec (called `.ok()` on `deployFlow`'s `Promise<void>` return) — fixed in
  `fix/P159-icon-test` to match the sibling tests' contract. Clean re-run 549/0.
- **cost:** session a6ff6bcc00e74066b (~8m) + fix a2742f344329b5d71 (~1m); plus orchestrator
  develop-E2E incl. the degraded-run diagnosis.
