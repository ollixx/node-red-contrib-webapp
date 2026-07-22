---
id: P228
title: "parent → app: das Besitz-Feld auf allen 42 Nicht-App-Knoten umbenennen (back-compat) — Haupt-Checkout, E2E-iteriert; Redo des reverteten Versuchs, NUR diese eine Welle"
epic: aspects/editor
status: pending
dependencies: [P229]
verify: browser
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/editor/field-naming.spec.ts
---
# P228 — `parent` → `app` (Redo, eng geschnitten)

> Rationale: [ADR 0038](../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md)
> Finding 1: `parent` hält faktisch die **besitzende App-id** (auf View- wie
> Logik-Knoten), nicht einen Slot-Parent — der Slot ist `mount`. **Dieses Paket
> macht NUR die `parent→app`-Welle.** Die `*Id`-Renames (`layoutId`/`routeId`/
> `definitionId`) sind bewusst ausgegliedert → **P259**. Der Erstversuch (beide
> Wellen in einem 100-Dateien-Merge) endete mit 35 roten Editor-E2E + einem
> migrate-on-save-Bug und wurde revertet (2026-07-14, `7ac0486`).

## ⚠️ Ausführungs-Auflagen (nicht verhandelbar)

1. **Haupt-Checkout, KEIN Worktree** — Playwright muss während der Umsetzung
   iterativ laufen (Port 1882). Der Erstversuch scheiterte, weil der Worktree-Agent
   blind gegenüber E2E arbeitete.
2. **Stufen-Commits mit E2E-Gate** (Reihenfolge unten in *acceptance*): Runtime-
   Leser zuerst (akzeptiert beide Namen) → Helpers/Fixtures → Editor schreibt
   kanonisch → Generatoren/Beispiele. Nach JEDER Stufe: Build + betroffene Suite
   grün + Commit.
3. **Der Attempt-Branch `phase/P228` ist die Karte, nicht die Vorlage.** Vor dem
   Start lesen: `git show phase/P228 --stat` (100 Dateien) und insbesondere den
   Fehlermodus — **migrate-on-save ließ `app` leer** (Clobber-Klasse ADR 0031).
   Heute fängt `check:roundtrip` (P216/P217, existierte damals NICHT) genau das —
   nach jeder Stufe grün halten.
4. **Helpers/Fixtures gehören zur Rename-Stufe.** `tests/helpers/flow-builder.ts`
   setzt `parent` überall; Fixtures (`tests/e2e/fixtures/*.flow.json`) tragen
   `parent`. Diese Drift war die Hauptquelle der 35 Roten.

## findings

- **42 Knoten** tragen `parent` in den Editor-`defaults` (gezählt 2026-07-20).
  Semantik überall: besitzende `ui-app` (App-Scope, P205-Validierung), NICHT der
  Render-Slot (`mount`).
- **Laufzeit-Leser von `parent`** (alle müssen `app` mit `parent`-Fallback lesen):
  - `packages/runtime/src/node-set.ts` — `resolveMount` + der Navigate-Map-Filter
  - `nodes/webapp.js` — alle `config.parent || undefined`, `mount: config.mount || config.parent`,
    `findAppIdForNode`, `APP_SCOPED_PARENT_TYPES`/P205-Validierung
  - `packages/editor/src/nodes.ts` — Definitions-Ebene
  - `packages/schema` — `identifiedNodeSchema`/`mountableNodeSchema` (`parent`-Feld)
- **Editor-Schreiber:** `installParentAppSelector()` (editor-common.js) bedient
  `#node-input-parent` auf allen Referenz-Knoten; Formzeilen-Label ist bereits „App".
- **`check:fields` flaggt `parent` NICHT** (kein `*Id`-Suffix) — der Done-Beweis
  läuft daher über Schema/Spec/Tests, nicht über die Allowlist.

## acceptance

**Stufe 1 — Runtime liest beide Namen (rein additiv, nichts bricht).**
- Alle o. g. Laufzeit-Leser akzeptieren `app` **mit `parent`-Fallback**
  (`config.app || config.parent`); Schema akzeptiert beide (Übergangs-Union).
  Volle Unit- + E2E-Suite **unverändert grün** (kein Flow wurde angefasst).

**Stufe 2 — Test-Infrastruktur kanonisch.**
- `tests/helpers/flow-builder.ts` emittiert `app`; alle Fixtures
  (`tests/e2e/fixtures/*.flow.json`) auf `app` umgestellt. Volle E2E grün
  (beweist zugleich den Fallback-Pfad NICHT mehr nötig zu haben — aber er bleibt
  für externe Alt-Flows).

**Stufe 3 — Editor schreibt kanonisch, migriert on-open.**
- `installParentAppSelector` bedient `#node-input-app`; `defaults` aller 42 Knoten
  tragen `app` (Required-Flags unverändert); **on-open-Migration:** ein Alt-Knoten
  mit `parent` öffnet mit befülltem App-Picker und speichert `app` (Alt-Feld wird
  beim Save geleert) — **der Erstversuch-Bug** („app nicht befüllt") ist durch einen
  expliziten Roundtrip-E2E je Knoten-Kategorie belegt (structure/view/state/behavior,
  je 1 Vertreter) + `check:roundtrip` grün über alle Knoten.
- Die P205-Validierung („braucht App-parent") meldet weiterhin korrekt — Meldungstexte
  auf „App" umgestellt.

**Stufe 4 — Generatoren + Doku.**
- `scripts/gen-example.js` + `scripts/gen-node-examples.js` emittieren `app`;
  `examples/**` regeneriert (nur Feldname ändert sich — keine Positions-
  Normalisierung, CLAUDE.md-Regel). `.node-red-e2e/` baut sich daraus neu.
- Specs: `field-conventions.md` + `editor.md` + Node-Spec-Feldtabellen nennen das
  Feld `app` („besitzende App"; `mount` = Slot); ADR-0038-Verweis. `check:specs` grün.

**Gesamt-Beweis:**
- Ein **pre-Rename-Flow** (Fixture mit `parent`) lädt, rendert unverändert und
  migriert beim Öffnen/Speichern zu `app` (E2E in `field-naming.spec.ts`).
- Volle E2E-Suite + `pnpm validate` + alle Tripwires grün im Haupt-Checkout.
- Kein Vorkommen von `parent:`-Emission mehr in Editor/Generatoren (Migrations-
  LESER bleiben).

## verify

`browser` — je Stufe volle bzw. betroffene Suite; die vier Kategorie-Roundtrips
gemessen; pre-Rename-Fixture-Beweis. Nichts wird als „wird schon gehen" gemerged —
das war der Erstversuch.

## spec

`docs/nodes/concepts/field-conventions.md`, `docs/nodes/concepts/editor.md`,
Feldtabellen der 42 Node-Specs (mechanisch: `parent`-Zeile → `app`).

## tests

`tests/e2e/nodes/editor/field-naming.spec.ts` (aus P229 übernommen/erweitert;
Harness-Vorlage auf `phase/P228` minen) + die vier Kategorie-Roundtrips.

## notes for the implementer

- **Reihenfolge der Stufen ist der Punkt** — der Erstversuch hat Editor-Schreiben
  und Runtime-Lesen gleichzeitig gedreht und die Helpers vergessen. Stufe 1 ist
  risikofrei; ab Stufe 2 trägt die Suite selbst den Beweis.
- `parent` als NAME bleibt im Repo existent (Node-REDs eigenes `z`-Konzept u. a.) —
  gezielt die Referenz-Feld-Vorkommen ändern, kein blindes Suchen-Ersetzen.
- `.node-red-dev/flows.json` NICHT anfassen (owner-only; migriert beim Owner-Open).
- Nach Abschluss: `check-fields.js` Regel (c) um `parent`-Verbot ergänzen
  (neuer Knoten darf kein `parent`-Referenzfeld mehr einführen) — der Guardrail
  friert die Welle ein.
