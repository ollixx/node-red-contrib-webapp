---
id: P227
title: "Editor/Schema: Feld-Konsistenz-Guardrail (`pnpm check:fields`) + dokumentierte Feld-Namens-/Carrier-Konvention — stoppt weitere Drift"
epic: aspects/editor
status: done
dependencies: []
verify: unit
spec: docs/nodes/concepts/editor.md
tests: scripts/check-fields.test.ts
---
# P227 — Feld-Konsistenz-Guardrail + Konvention

> Rationale: [ADR 0038](../../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).
> Foundation-Paket: macht den Zielzustand explizit + verhindert neue Drift, BEVOR
> die eigentlichen Umbenennungen (P228) und der Legacy-Sweep (P229) laufen.

## findings

Cross-Node-Audit 2026-07-14 (45 Knoten × 128 Felder, verifiziert 127/128 konsumiert)
deckte auf, dass die Felder knotenübergreifend inkonsistent sind, ohne dass etwas
das prüft: `check:specs` erzwingt nur defaults↔spec **pro Knoten**, nicht die
**knotenübergreifende Kohärenz**. Konkrete Befunde (Belege in ADR 0038): `parent`
= App (irreführend benannt); totes `storeId`/`path` auf 8 Input-Knoten; `rows`
überladen; `store`/`storeId`- und `layout`/`layoutId`-Namensdopplung; `*Path`-Legacy
uneinheitlich stehen geblieben.

## acceptance

- **Konvention dokumentiert.** `docs/nodes/concepts/editor.md` (oder ein neues
  `field-conventions.md`) hält die Feld-Namens-/Carrier-Regeln aus ADR 0038 fest:
  Referenz-Felder tragen den **bloßen** Konzeptnamen (`store`/`layout`/`route`,
  nicht `*Id`); `app` = besitzende App, `mount` = Render-Slot; genau **ein**
  Carrier-Muster (`<base>` + `<base>Binding`, **kein** `<base>Path`-Default).
- **Tripwire `pnpm check:fields`.** `scripts/check-fields.js` (read-only, in
  `pnpm validate` eingehängt) prüft knotenübergreifend:
  (a) hat ein Knoten `<base>Binding`, darf **kein** `<base>Path`-Default existieren;
  (b) keine Wiedereinführung eines als entfernt markierten Legacy-Felds
  (`*Json`, dead `storeId`/`path`, `page`/`currentPagePath`);
  (c) Referenz-Felder folgen der Bare-Name-Regel (Verstoß = `layoutId`/`routeId`/…).
  Verstöße scheitern mit Knoten+Feld-Meldung.
- **Kuratierte Allowlist.** Die heutigen Verstöße (bis P228/P229 sie beheben)
  stehen mit je einer Ein-Zeilen-Begründung in einer Allowlist, sodass `pnpm
  validate` **grün** bleibt; die Liste schrumpft mit P228/P229 auf leer.
- **Unit-Test.** `scripts/check-fields.test.ts`: Verstoß je Regel → rot; konformer
  Knoten → grün; allowlisted → grün. Läuft unter `pnpm test`.
- **Audit-Referenz.** Die Matrix + Befundliste (Session 2026-07-14) wird als
  Referenz im Konventions-Doc verlinkt/abgelegt.

## verify

`unit` — der Tripwire ist ein Node-Skript, bewiesen durch `check-fields.test.ts`
(Regel-für-Regel pass/fail/allowlist) + ein sauberer `pnpm validate`-Lauf.

## spec

`docs/nodes/concepts/editor.md` — die Feld-Konvention; der Tripwire-Vertrag lebt im
Skript-Header + Unit-Test.

## tests

`scripts/check-fields.test.ts`.

## notes for the implementer

- Muster: `scripts/check-specs.js`/`check-roundtrip.js` (kuratierte-Allowlist-Idiom).
- Datenquelle wie im Audit: die `defaults`-Blöcke der `nodes/**/*.html` (Kommentar-
  robust parsen). Der Generator/Parser aus der Audit-Session kann als Basis dienen.
- Dieses Paket **entfernt/renamt nichts** — es dokumentiert + erzwingt nur. Die
  Umsetzung ist P228 (Renames) + P229 (Legacy-Sweep).

## Result

**Delivered.** Cross-Node-Feld-Konsistenz-Guardrail (ADR 0038) — dokumentiert die Konvention + erzwingt sie read-only; **renamt/entfernt nichts** (das sind P228/P229).
- **Tripwire** `scripts/check-fields.js` (read-only, non-zero Exit mit Knoten+Feld-Meldung; pure `fieldViolations`/`analyzeNodes`-Kern über In-Memory-defaults, Muster von check-specs/check-roundtrip). Drei Regeln: **(a)** hat ein Knoten `<base>Binding`, darf kein `<base>Path`-Zwilling existieren; **(b)** kein wiedereingeführtes Legacy-Feld (`*Json`; totes `storeId`+`path`-Paar; `page`/`currentPagePath`-Aliase); **(c)** Referenz-Felder tragen den bloßen Namen (jedes `*Id` außer Keep-Liste `uiId`/`selectedId` ist ein Verstoß, schlägt bare-Name vor).
- **Unit-Test** `scripts/check-fields.test.ts` (13 Tests: Regel-für-Regel pass/fail + Allowlist + real-tree grün).
- **Doku** `docs/nodes/concepts/field-conventions.md` (ADR-0038-Regeln + Tripwire-Vertrag + Audit-Referenz), aus `editor.md` „Siehe auch" verlinkt.
- **`package.json`**: `check:fields` Script, in `validate` + `test:specs` eingehängt.

**Seeded Allowlist — 53 (Knoten, Feld)-Verstöße** (aus der Ist-Enumeration, nicht geraten), die P228/P229 auf leer treiben: (c) 7 `*Id`-Renames (`ui-route.layoutId`, `ui-dialog.layoutId`/`routeId`, `ui-container.layoutId`, `ui-component-instance.definitionId`, `ui-action.routeId`, `ui-navigation.routeId`); (a) 27 residuale `<base>Path`-Zwillinge; (b) `optionsJson`×2 + `itemsJson` + totes `storeId`+`path` auf 8 Input-Knoten.

**Verify (unit).** `pnpm check:fields` grün (45 Knoten, 53 allowlisted), `scripts/check-fields.test.ts` 13/13, `pnpm validate` end-to-end grün (build+lint+5 Tripwires+alle Tests). Damit ist die ADR-0038-Grundlage gelegt; P228 (Renames) + P229 (Legacy-Sweep) treiben die Allowlist auf leer.

**Cost.** Sub-Agent `phase/P227` (worktree), ~8 min (12:10:06Z→12:17:53Z); Token-Zeile in `.ai/agent-runs.jsonl`.
