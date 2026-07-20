---
id: P252
node: ui-pagination
title: "Konformitäts-Pass ui-pagination (leicht) — `showInfo`/`variant`/`totalItems` vermutlich inert (Serializer konsumiert sie nicht); page/total/currentPage exzellent"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-20.** Leichter Pass; drei Inert-Verdachtsfelder gemessen, je nach
Befund implementiert oder entfernt. Alle drei lebten **nur** im Zod-Schema — kein
Editor-Control, keine mapConfig-Emission, kein Serializer/Renderer-Konsum.

### `showInfo` → IMPLEMENTIERT (billig, ehrlich)

Der Serializer rendert immer das kompakte `.webapp-pagination-page`-Label („X / Y");
`showInfo` togglete nichts. Fix: Editor-Checkbox → mapConfig-Boolean → `props.showInfo`
→ Serializer emittiert eine **separate** `<div class="webapp-pagination-info">Seite X
von Y</div>`-Region **nur wenn true**. Gemessen: I01 `showInfo:true` → `.webapp-
pagination-info` sichtbar, Text „Seite 2 von 5"; I02 omittiert → count 0.

### `variant` (numbered/simple) → ENTFERNT

Kein billiger ehrlicher DOM-Unterschied möglich — „numbered" bräuchte einen echten
Seitenzahl-Renderer (substanziell), „simple" ist der Ist-Zustand. Aus Schema + Spec +
Theming entfernt (war nie im Editor).

### `totalItems` → ENTFERNT

`totalPages` (aus dem `total`-Binding) ist die **alleinige** autoritative Quelle der
Seitenzahl; `totalItems + pageSize → totalPages` war nie implementiert (die Spec-
„Offene Punkte" gab das selbst zu). Redundant → aus Schema + Spec entfernt.

**Back-Compat:** mapConfig produzierte `variant`/`totalItems` nie, und non-strict Zod
strippt unbekannte Keys → Alt-Flows deployen unverändert; kein Filter nötig.

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 807 passed / 1 failed, `--retries=0`, 15,7 min.** Die eine Rote ist erneut
`ui-tabs.spec.ts:226` **E01** (30 s Timeout) — die **bereits diagnostizierte,
gechipte** (`task_c1239d9c`) intermittente Brittleness (Shoelace-Upgrade-Emit-
Abhängigkeit), **kein P252-Bezug** (Pagination ≠ Tabs; E01 isoliert grün; 2. Auftreten
in ~6 Voll-Läufen → ~1-in-3-Intermittenz, unabhängig vom getesteten Paket). P252-Code
verifiziert sauber (view 11/11 inkl. I01/I02, composite 7/7). Schema+Serializer+webapp.js
geändert → Voll-Suite gerechtfertigt. `pnpm build` + `pnpm validate` + Tripwires grün.
Agent committete VOR der Verifikation, stoppte alle Prozesse (Port 1882 frei).
