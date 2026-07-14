---
id: P227
title: "Editor/Schema: Feld-Konsistenz-Guardrail (`pnpm check:fields`) + dokumentierte Feld-Namens-/Carrier-Konvention — stoppt weitere Drift"
epic: aspects/editor
status: in_progress
dependencies: []
verify: unit
spec: docs/nodes/concepts/editor.md
tests: scripts/check-fields.test.ts
---
# P227 — Feld-Konsistenz-Guardrail + Konvention

> Rationale: [ADR 0038](../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).
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
