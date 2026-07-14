---
id: P228
title: "Editor/Schema/Runtime: Referenz-Feld-Namen normalisieren — parent→app, layoutId→layout, routeId→route, definitionId→definition (back-compat Migration)"
epic: aspects/editor
status: deferred
deferred_reason: "Große, knotenübergreifende Umbenennung mit Flow-Migrationen; erst nach P227 (Guardrail + Konvention) und bewusst als eigener, gut getesteter Zug."
dependencies: [P227]
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/field-naming.spec.ts
---
# P228 — Referenz-Feld-Namen normalisieren

> Rationale: [ADR 0038](../../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).

## findings

Aus dem Audit 2026-07-14 (Belege in ADR 0038): Referenz-Felder sind uneinheitlich
benannt — `parent` hält faktisch die **App-id** (nicht einen Slot-Parent);
`layout` (ui-app/ui-breadcrumb) vs `layoutId` (route/dialog/container) referenzieren
**beide** ein Layout; `routeId`, `definitionId` tragen `Id`, `store`/`mount` nicht.

## acceptance

- **`parent` → `app`** auf allen Nicht-App-Knoten: Feld heißt `app` (besitzende App),
  `mount` bleibt der Render-Slot. Schema, Editor-`defaults`, mapConfig, Specs und die
  „entweder mount oder app"-Validierung entsprechend.
- **Bare-Name für Referenzen:** `layoutId`→`layout`, `routeId`→`route`,
  `definitionId`→`definition`. (`selectedId` bleibt — es ist ein *Wert*, keine
  Knoten-Referenz.)
- **Back-compat.** Alt-Flows mit `parent`/`layoutId`/`routeId`/`definitionId` laden
  weiter: der Runtime liest das Legacy-Feld (bestehender `mount || parent`-Fallback
  bzw. neue Migration), der Editor schreibt beim Öffnen/Speichern das kanonische Feld.
  Ein E2E beweist: ein pre-Rename-Flow rendert unverändert und migriert beim Speichern.
- **`check:fields` (P227) für diese Regel grün**, Allowlist-Einträge dieser Felder
  entfernt.
- **`check:specs` grün** — Spec-Feld-Tabellen in denselben Änderungen aktualisiert.
- **Browser-Beweis:** die betroffenen Knoten (app-scoped Referenzen, Layout-Refs)
  funktionieren im laufenden Editor + App unverändert; Round-Trip open→save (ADR 0031).

## verify

`browser` — pre-Rename-Flow lädt/rendert unverändert; nach Save steht das kanonische
Feld; Editor-Picker + Rendering ok (Playwright).

## spec

`docs/nodes/concepts/editor.md` (+ die betroffenen Node-Specs).

## tests

`tests/e2e/nodes/editor/field-naming.spec.ts` — Legacy-Load + Migration-on-save je
umbenanntem Feld.

## notes for the implementer

- `parent`-Leser: `resolveMount` (`node-set.ts`), `mount || parent` in webapp.js,
  `findAppIdForNode`, P205-Validierung, APP_SCOPED_PARENT_TYPES. Alle auf `app`
  (mit Legacy-`parent`-Fallback) heben.
- Migrationsmuster wie bei ADR 0027 (`storeId`/`path`→`writeTo`): beim `oneditprepare`
  Legacy→kanonisch, beim `oneditsave` nur kanonisch schreiben, Legacy-Default leeren.
- Groß — darf in Batches (parent→app zuerst, dann die Layout/Route/Definition-Refs).
