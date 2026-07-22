---
id: P229
title: "Legacy-Feld-Sweep: residuale *Path-Zwillinge, totes storeId/path, *Json-Carrier, pagination-Aliase entfernen + ui-textarea rows→lines — in 4 mechanischen Slices, E2E-Gate je Slice"
epic: aspects/editor
status: in_progress
dependencies: [P227]
verify: browser
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/editor/field-naming.spec.ts
---
# P229 — Legacy-Feld-Sweep + `rows`-Kollision (Redo-fest spezifiziert)

> Rationale: [ADR 0038](../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).
> **Erster Zug der Feld-Modell-Einfrierung vor 1.0** (dann P228 `parent→app`, dann
> P259 Id-Renames). Bewusst VOR P228: mechanisch risikoärmer, und baut die
> `field-naming.spec.ts`-Migrations-Harness auf, die P228/P259 wiederverwenden.

## ⚠️ Ausführungs-Auflagen (nicht verhandelbar)

1. **Haupt-Checkout, KEIN Worktree.** Der umsetzende Agent MUSS Playwright
   iterativ fahren können (Port 1882). Worktree-Agenten können das nicht — daran
   ist der P228-Erstversuch gestorben (35 rote Editor-E2E, revertet 2026-07-14).
2. **Ein Slice = ein Commit = ein E2E-Gate.** Nach jedem Slice (A–D unten):
   `pnpm build` → betroffene Editor-/Node-E2E **grün** → commit. Erst dann der
   nächste Slice. Ein roter Slice wird allein zurückgerollt, nie der ganze Zug.
3. **Test-Helpers/Fixtures im SELBEN Slice mitziehen.** Wenn ein Slice ein Feld
   entfernt, das `tests/helpers/flow-builder.ts`, Fixtures oder Specs noch setzen,
   werden diese **im selben Commit** angepasst — Helper-Drift war die Hauptquelle
   der 35 Roten im P228-Versuch.
4. **`check:roundtrip` ist das Clobber-Netz.** Es existiert seit P216/P217 (der
   P228-Versuch hatte es NICHT) und fängt open→save-Verluste. Nach jedem Slice grün.

## findings

Autoritative Zielliste = die **`check-fields`-Allowlist** (`scripts/check-fields.js`),
Stand 2026-07-20 — jede Zeile dort mit P229-Grund ist ein Ziel dieses Pakets:

- **(a) Residuale `<base>Path`-Zwillinge** (Binding ist kanonisch, ADR 0012):
  ui-button `disabledPath` · ui-table `rowsPath` · ui-input/select/checkbox/radio/
  switch/textarea/datepicker/slider `valuePath` · ui-alert `messagePath` ·
  ui-progress `valuePath` · ui-skeleton `visiblePath` · ui-badge `valuePath` ·
  ui-tabs `activeTabPath` · ui-tab `labelPath` · ui-accordion `openSectionPath` ·
  ui-accordion-section `labelPath` · ui-menu `itemsPath`+`activeRoutePath` ·
  ui-pagination `totalPath` · ui-stepper `activeStepPath` · ui-image `srcPath` ·
  ui-list `itemsPath`+`selectedIdPath` · ui-repeat `itemsPath`.
- **(b) Totes `storeId`/`path`-Paar** (pre-ADR-0027, abgelöst durch `writeTo`):
  ui-input, ui-select, ui-checkbox, ui-radio, ui-switch, ui-textarea,
  ui-datepicker, ui-slider (8 Knoten, je beide Felder).
- **(c) Legacy-JSON-Carrier:** `optionsJson` (ui-select, ui-radio), `itemsJson`
  (ui-breadcrumb).
- **(d) Pagination-Alias:** `currentPagePath` (ui-pagination; `totalPath` fällt
  unter (a)).
- **(e) `rows`-Kollision:** ui-textarea `rows` (Zeilen-HÖHE, Number) kollidiert
  semantisch mit ui-table `rows` (DATEN-Binding). Einziger echter Rename im Paket.

## acceptance

**Slice A — totes `storeId`/`path` (8 Input-Knoten).**
- Die `defaults`-Einträge `storeId` + `path` sind auf allen 8 Knoten entfernt; die
  bestehende Open-Time-Migration (`storeId`+`path` → `writeTo`, ADR 0027) bleibt
  und ist je Knoten per Roundtrip belegt: ein Alt-Flow mit `storeId`/`path` öffnet,
  zeigt das migrierte `writeTo`, speichert ohne die Alt-Felder (E2E, Muster
  `field-naming.spec.ts`).
- `check:fields`: alle 16 `storeId`/`path`-Allowlist-Einträge entfernt, Check grün.

**Slice B — residuale `<base>Path`-Zwillinge (alle oben gelisteten Knoten).**
- Jeder gelistete `<base>Path`-`defaults`-Eintrag ist entfernt; die Open-Time-
  Migration (`<base>Path` → state-Binding auf `<base>`) bleibt im jeweiligen
  `oneditprepare`. Beweis pro Feld-Typ (mind. je ein Vertreter für value/label/
  items/active*): Alt-Flow lädt + rendert unverändert, Save schreibt nur das
  kanonische Feld (E2E).
- **Bestehende Legacy-Migrations-E2E bleiben grün** (z. B. „legacy valuePath
  migrated", „legacy itemsPath migrates" — sie testen die RUNTIME-Migration, die
  bleibt; nur der Editor-`defaults`-Eintrag fällt).
- `check:fields`: alle `<base>Path`-Einträge entfernt, Check grün.

**Slice C — `*Json`-Carrier + `currentPagePath`.**
- `optionsJson` (select/radio), `itemsJson` (breadcrumb), `currentPagePath`
  (pagination) aus den `defaults` entfernt; Open-Time-Migrationen bleiben; je ein
  Migrations-E2E. `check:fields`-Einträge entfernt, grün.

**Slice D — `rows` → `lines` (ui-textarea).**
- Editor-Feld + Schema-Feld heißen `lines`; ein Alt-Flow mit `rows` an ui-textarea
  migriert beim Öffnen zu `lines` und rendert die gleiche Höhe (E2E, gemessen:
  `rows`-Attribut am `sl-textarea`); Save schreibt nur `lines`. ui-table `rows`
  ist danach die einzige `rows`-Bedeutung. Spec ui-textarea + ui-table angepasst.

**Gesamt:**
- `check:fields`-Allowlist enthält **keinen** P229-Eintrag mehr.
- `check:roundtrip`/`check:specs`/`check:help`/`check:links` + `pnpm validate` grün;
  **volle E2E-Suite grün im Haupt-Checkout** am Ende.
- Specs der betroffenen Knoten: Legacy-Feld-Zeilen entfernt bzw. als
  „nur-Migration, nicht mehr im Editor" vermerkt; `field-conventions.md`
  dokumentiert das Carrier-Muster als abgeschlossen.

## verify

`browser` — je Slice: betroffene Editor-/Node-E2E + `check:roundtrip` grün vor dem
nächsten Slice; am Ende volle Suite. Migrations-Beweise gemessen (Alt-Flow lädt,
rendert, migriert on-save), nicht angenommen.

## spec

`docs/nodes/concepts/field-conventions.md` (Carrier-Regel „genau ein Muster"),
`docs/nodes/concepts/editor.md`, betroffene Node-Specs (insb. ui-textarea, ui-table).

## tests

`tests/e2e/nodes/editor/field-naming.spec.ts` — **auf `phase/P228` existiert eine
150-Zeilen-Harness dieses Namens** (`git show phase/P228:tests/e2e/nodes/editor/field-naming.spec.ts`);
als Startpunkt minen (nicht blind übernehmen — sie testet auch die P228-Renames,
die hier NICHT Scope sind). Je Slice die Migrations-Fälle ergänzen.

## notes for the implementer

- **Nur `defaults` + Specs räumen, Migrations-LESER behalten** (webapp.js
  `legacyStoreWriteTo`, die `<base>Path`→Binding-Migrationen in `oneditprepare`,
  mapConfig-Fallback-Ketten wie `getBinding(config.value, config.valuePath ? …)`).
  Alt-Flows dürfen NIE brechen — die Entfernung betrifft nur, was der Editor
  NEU schreibt.
- **Reihenfolge A→B→C→D einhalten** (A ist der klarste Fall, D der einzige Rename).
- `.node-red-dev/flows.json` ist owner-only — NICHT anfassen; falls dort Alt-Felder
  liegen, migrieren sie beim nächsten Owner-Open automatisch.
- `examples/**` sind generiert: falls ein Generator ein Legacy-Feld emittiert,
  Generator fixen + `pnpm gen:example`/`gen:node-examples` — nie Hand-Edit.
