---
id: P219
title: "Rendering: pro-Feld `onMissing`-Selektor (Foundation) — Werte `marker` (Default, heutiges '?') + `ignore` (leer); Schema + Renderer + Editor"
epic: aspects/rendering
status: done
dependencies: [P131]
verify: browser
spec: docs/nodes/concepts/reactive-expressions.md
tests: tests/e2e/nodes/editor/reactive-expression.spec.ts
---
# P219 — `onMissing`-Selektor (Foundation): `marker` + `ignore`

> Rationale: [ADR 0034](../../../../adr/0034-per-field-missing-binding-behavior-selector.md).
> Foundation-Paket: das pro-Feld-Verhalten + die zwei nicht-visuellen Werte. Die
> reicheren Verhalten (`errorPort`, `throw`/Catch, Fallback-Slot, P105-Affordance)
> sind Folgepakete (P220 ff.).

## findings

Owner (2026-07-13, verbatim):

> „Für das ‚fehlende Binding' problem: Vielleicht bieten wir an, dass der user
> wählen kann, was passiert. Default-Ausgabe für ‚nicht gefunden', also das jetzige
> ‚?' (das könnte ein Slot sein); error out-port; error werfen und per catch
> abfangen; ignorieren."

Owner-Entscheid (2026-07-13): **pro Feld wählbar**, **Default bleibt das heutige
`?`**. Dieses Paket liefert den Selektor + die zwei nicht-visuellen Werte
(`marker`, `ignore`); `errorPort`/`throw` und die Slot-/Affordance-Formen folgen.

## acceptance

- **Schema.** Der kanonische Value-Field-/Binding-Vertrag (packages/schema) bekommt
  ein optionales `onMissing`-Enum mit mindestens `marker | ignore` (erweiterbar um
  `errorPort | throw` in P220). Fehlt das Feld → `marker` (Default). Ungültige Werte
  werden abgelehnt (Zod).
- **Renderer.** Am Invalid-Value-Punkt in `resolveBinding`/`resolveStoreBinding`
  (dort wo heute `REACTIVE_INVALID`/`STORE_SUBPATH_INVALID` → `"?"` entsteht) wird
  auf `onMissing` verzweigt: `marker` → heutiges `"?"` (+ bestehender einmaliger
  Report, unverändert); `ignore` → **leer** (`""`), **kein** Report. `ignore`
  liefert dasselbe „leer statt ?" wie ADR 0032 für den transienten Objekt-Fall,
  jetzt für jedes Feld wählbar.
- **Default unverändert.** Ohne gesetztes `onMissing` verhält sich jedes Feld exakt
  wie heute (`marker`/`"?"`), inkl. der bestehenden Reports — bestehende Specs/Tests
  bleiben grün.
- **Editor.** Das bindbare Feld zeigt den `onMissing`-Selektor (Default `marker`)
  in der Feld-Zeile; Auswahl wird gespeichert und round-trippt (open→save, ADR 0031).
- **Browser-Beweis.** Ein Feld mit `onMissing:ignore` und unauflösbarem Binding
  rendert im laufenden App **leer**; dasselbe Feld mit `marker` rendert `"?"`.
- **Katalog/Spec.** `reactive-expressions.md` (+ betroffene Node-Specs) dokumentieren
  das `onMissing`-Feld: Werte, Default, gerenderte Wirkung; Test-Katalog gepflegt.

## verify

`browser` — beide Werte am laufenden App bewiesen (`ignore` → leer, `marker` → `?`),
plus Editor-Selektor sichtbar + round-trip.

## spec

`docs/nodes/concepts/reactive-expressions.md` (+ die konkrete Feld-Doku im
value-rendering-Konzept) — das `onMissing`-Feld mit Werten/Default/Wirkung.

## tests

`tests/e2e/nodes/editor/reactive-expression.spec.ts` (+ ein Renderer-Unit-Test in
packages/renderer) — Selektor-Auswahl + `ignore`/`marker`-Renderwirkung.

## notes for the implementer

- Anknüpfpunkt Renderer: die zwei Stellen, die `REACTIVE_INVALID`/
  `STORE_SUBPATH_INVALID` zurückgeben (packages/renderer/src/renderer.ts) — dort
  `onMissing` des aktuellen Bindings lesen und verzweigen. `currentNodeId` ist seit
  ADR 0032 verfügbar (für spätere `errorPort`/`throw`).
- **NICHT** in diesem Paket: `errorPort`, `throw`/Catch, Fallback-Slot,
  P105-Affordance — die sind P220/P105 (deferred).

## Result

**Delivered.** Pro-Feld `onMissing`-Selektor (Foundation) mit `marker` (Default = heutiges `"?"`) + `ignore` (leer). Default-Verhalten byte-unverändert.
- **Schema** `packages/schema/src/contracts.ts`: `ON_MISSING_BEHAVIORS = ["marker","ignore"]` + `OnMissingBehavior`; optionales `onMissing: enum(...).optional()` auf **beiden** `bindingSchema` + `leafBindingSchema` (`.optional()` statt `.default()` → bestehende Fixtures validieren unverändert; fehlt → `marker`; ungültig → Zod-Reject; Enum als benannte Konstante → P220 erweitert um `errorPort`/`throw` ohne Vertragsbruch). `index.ts` Exports.
- **Renderer** `packages/renderer/src/renderer.ts`: am Reactive-Fail-Punkt UND in `resolveStoreBinding` (alle drei `STORE_SUBPATH_INVALID`-Returns: Depth-Guard, Whole-Object, Scalar-Miss) verzweigt auf `binding.onMissing`: `ignore` → `""` ohne Report; `marker`/absent → `"?"` + bestehender einmaliger Report unverändert. Baut auf ADR 0032 (`currentNodeId`, transient-empty) ohne es rückgängig zu machen.
- **Editor** `resources/lib/editor-common.js`: wiederverwendbare `readOnMissing`/`applyOnMissing`-Helfer; `nodes/view/ui-text.html`: Plain-`<select id="node-input-onMissing">` (marker/ignore), in `oneditprepare`/`oneditsave` verdrahtet — `marker` wird NICHT geschrieben, nur `ignore` (Flows bleiben byte-identisch). **Plain-Select, kein Hidden-Carrier → keine ADR-0031-Harness nötig; `check:roundtrip` unberührt.**
- **Doku** `docs/nodes/concepts/reactive-expressions.md` + `value-rendering.md` (§`onMissing`); `ui-text.tests.md`.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/editor/onmissing.spec.ts` **3 passed** (6.8s): Selektor vorhanden, Default `marker`, round-trippt `ignore` (open→save→reopen, `marker` fällt aus dem Binding); **Browser-Beweis** dasselbe unauflösbare Whole-Object-Store-Binding rendert `"?"` unter `marker` und **leer** (`""`) unter `ignore`.

**Stats.** Unit grün: schema 497 (+5), renderer 158 (+6). Default-unverändert-Garantie geprüft: gesamte Suite grün inkl. P131/ADR-0032. `pnpm build`/`lint`/`check:specs` (42)/`check:roundtrip`/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P219` (worktree), ~15 min (17:22:08Z→17:37:12Z); Token-Zeile in `.ai/agent-runs.jsonl`.
