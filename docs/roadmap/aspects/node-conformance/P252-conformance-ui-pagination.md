---
id: P252
node: ui-pagination
title: "Konformitäts-Pass ui-pagination (leicht) — `showInfo`/`variant`/`totalItems` vermutlich inert (Serializer konsumiert sie nicht); page/total/currentPage exzellent"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-pagination.md
tests: tests/e2e/nodes/view/ui-pagination.tests.md
---
# P252 — Konformitäts-Pass ui-pagination (leicht)

> Audit 2026-07-17. **Sehr gut abgedeckt** — 16 outcome-E2E (view + composite):
> prev/next-Render, `total` literal/state, `currentPage` state/Zwei-Wege/SSE,
> next/prev-Events mit `params.page`, disabled-first/last, Legacy-`currentPagePath`/
> `totalPath`-Migration. Base-Fields, Katalog.

## findings

### A. `showInfo` / `variant` / `totalItems` vermutlich inert
Alle drei stehen im Schema:
- `showInfo: z.boolean()` — Info-Text „Seite X von Y" ein/aus,
- `variant: z.enum(["numbered","simple"])` — Darstellungsform,
- `totalItems: bindingSchema.optional()` — Gesamtanzahl Elemente.

**Gemessener Ist-Zustand:** grep nach `showInfo`/`totalItems`/`numbered`/`simple`
im Serializer + Renderer + webapp.js ist **leer** ⇒ keiner der drei wird konsumiert.
`pageSize` **wird** verwendet (mapConfig → stateBinding), `page`/`totalPages` sowieso.
**Zu verifizieren pro Feld:** beobachtbare Wirkung? Wo keine → inert: implementieren
(showInfo togglet Info-Text; variant erzeugt distinkte Darstellung; totalItems speist
die Seitenzahl-Berechnung) **oder** aus Schema+Editor+Spec entfernen.

### B. Solide (nicht neu aufbauen)
prev/next-Render, page/total-Label, currentPage (alle Arten + Zwei-Wege + SSE),
next/prev-Events, disabled-Randseiten, beide Legacy-Migrationen.

## acceptance
- **`showInfo` aufgelöst:** `showInfo:true` erzeugt einen **gemessenen** Info-Text,
  `false` nicht — oder Feld entfernt.
- **`variant` aufgelöst:** `numbered` vs `simple` erzeugt einen gemessenen DOM-
  Unterschied — oder Feld entfernt.
- **`totalItems` aufgelöst:** speist beobachtbar die Seitenzahl (z. B. `totalItems`
  + `pageSize` → `totalPages`) — oder entfernt, falls `totalPages` die alleinige Quelle ist.
- **Katalog** spiegelt die neuen/entfernten Tests.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — showInfo/variant/totalItems gemessen; die 16 bestehenden bleiben grün.

## spec
`docs/nodes/navigation/ui-pagination.md` — die drei Felder wahrheitsgemäß.

## tests
`tests/e2e/nodes/view/ui-pagination.spec.ts` (+ composite) + Katalog.

## notes for the implementer
- Feldnamen-Drift `currentPage`/`total` (Editor) → `page`/`totalPages` (Schema) via
  mapConfig ist gewollt (P154) — NICHT hier anfassen.
- `showInfo`/`variant`/`totalItems` sind derselbe Inert-Verdacht wie ui-menu
  displayType / ui-dialog modal — am Serializer prüfen.
