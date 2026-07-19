---
id: P255
node: ui-container
title: "Konformitäts-Pass ui-container (leicht) — kein Katalog, `events` (onShow/onHide) ungetestet + Inert-Verdacht; Varianten/Layout solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/display/ui-container.md
tests: tests/e2e/nodes/composite/ui-container.tests.md
---
# P255 — Konformitäts-Pass ui-container (leicht)

> Audit 2026-07-17. Kern **solide** — 10 outcome-E2E (sl-card-Wrapper, Kind-Mount,
> mehrere Kinder, grid-Layout, **alle 5 Varianten** card/panel/section/transparent/
> span inkl. span-inline), Base-Fields (`installBaseFields`).

## findings

### A. Kein Test-Katalog (Dimension 5)
Kein `tests/e2e/nodes/composite/ui-container.tests.md`.

### B. `events` (onShow/onHide) ungetestet + Inert-Verdacht
Schema `events: z.array(z.enum(["onShow","onHide"]))`. Kein E2E feuert sie; grep
nach `onShow`/`onHide` im Serializer/Renderer/webapp.js ist **leer** ⇒ zu
verifizieren, ob die Events real emittiert werden. Wo nein → implementieren **oder**
aus Schema+Spec entfernen.

### C. Solide (nicht neu aufbauen)
Alle 5 Varianten (surface roles), Layout-Preset (grid), Kind-Mounting, span-inline.

## acceptance
- **`events` aufgelöst:** onShow/onHide feuern beim Ein-/Ausblenden mit korrektem
  `msg.ui`-Envelope (gemessen) — oder aus Schema+Spec entfernt.
- **Katalog** `ui-container.tests.md` angelegt.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — onShow/onHide gemessen; die 10 bestehenden bleiben grün.

## spec
`docs/nodes/display/ui-container.md` — events-Wahrheit.

## tests
`tests/e2e/nodes/composite/ui-container.spec.ts` + neuer Katalog.
