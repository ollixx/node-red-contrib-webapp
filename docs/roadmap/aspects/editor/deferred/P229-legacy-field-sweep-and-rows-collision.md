---
id: P229
title: "Editor/Schema: Legacy-Feld-Sweep (residuale *Path-Zwillinge, *Json, totes storeId/path, pagination-Aliase) + rows-Namenskollision auflösen"
epic: aspects/editor
status: deferred
deferred_reason: "Knotenübergreifende Alt-Feld-Entfernung mit Migrations-/Back-compat-Fenster; erst nach P227 (Guardrail) und bewusst als eigener Zug."
dependencies: [P227]
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/field-naming.spec.ts
---
# P229 — Legacy-Feld-Sweep + `rows`-Kollision

> Rationale: [ADR 0038](../../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).

## findings

Aus dem Audit 2026-07-14 (Belege in ADR 0038):
- **`*Path`-Legacy-Zwilling uneinheitlich stehen geblieben:** `visiblePath` nur
  ui-empty-state/ui-skeleton (die anderen 29 nicht), `disabledPath` nur ui-button,
  `labelPath` nur 2/14, `valuePath` 10/11 usw. Das Binding (ADR 0012) ist kanonisch.
- **Totes `storeId`/`path`** auf 8 Input-Knoten (Code: „dead storeId/path pair",
  abgelöst durch `writeTo`, ADR 0027) — nur noch Open-Time-Migration.
- **`itemsJson` (ui-breadcrumb), `optionsJson` (ui-radio/ui-select)** — Legacy-JSON-
  Fallbacks, nur auf manchen Knoten.
- **pagination-Aliase `page`/`currentPagePath`** neben dem kanonischen `currentPage`.
- **`rows` überladen:** ui-textarea `rows` (Zeilenzahl/Höhe, Number) kollidiert mit
  ui-table `rows` (Daten-Binding).

## acceptance

- **Residuale `<base>Path`-Defaults entfernt** — auf **allen** Knoten, sodass genau
  das Carrier-Muster `<base>` + `<base>Binding` gilt. Open-Time-Migration
  (`<base>Path`→state-Binding) bleibt als Brücke; das `defaults`-Feld verschwindet.
- **Totes `storeId`/`path` aus den 8 Input-`defaults` entfernt**; die `writeTo`-
  Migration beim Öffnen bleibt (Alt-Flows migrieren weiter).
- **`itemsJson`/`optionsJson` + `page`/`currentPagePath` entfernt** (kanonisch:
  `items`/`options`-Binding bzw. `currentPage`); Open-Time-Migration bleibt.
- **`rows`-Kollision aufgelöst:** ui-textarea-Höhenfeld umbenannt (z.B. `lines`);
  `rows` bedeutet danach ausschließlich „Daten-Zeilen" (ui-table). Back-compat:
  Alt-`rows` an ui-textarea wird zu `lines` migriert.
- **Back-compat-Beweis:** je entferntem/umbenanntem Feld lädt ein pre-Sweep-Flow
  unverändert und migriert beim Speichern (E2E).
- **`check:fields` (P227) grün** für die Legacy-Regeln, Allowlist-Einträge entfernt;
  **`check:specs` grün** (Specs in denselben Änderungen aktualisiert).

## verify

`browser` — pre-Sweep-Flows (mit `*Path`/`*Json`/`storeId`/`rows`) laden + rendern
unverändert; nach Save sind nur die kanonischen Felder gesetzt (Playwright).

## spec

`docs/nodes/concepts/editor.md` (+ betroffene Node-Specs: ui-textarea, ui-table,
ui-radio, ui-select, ui-breadcrumb, ui-pagination, die Input-Knoten).

## tests

`tests/e2e/nodes/editor/field-naming.spec.ts` — Legacy-Load + Migration je Feld;
ui-textarea `rows`→`lines` Round-Trip.

## notes for the implementer

- Nur **Editor-defaults + Specs** entfernen, **Migrations-Leser behalten** (webapp.js
  `legacyStoreWriteTo`, die `<base>Path`→binding-Migration im jeweiligen
  `oneditprepare`). Kein Bruch für Alt-Flows.
- `rows`→`lines` ist der einzige echte Rename hier; der Rest ist reine Entfernung
  des Legacy-`defaults`-Eintrags.
