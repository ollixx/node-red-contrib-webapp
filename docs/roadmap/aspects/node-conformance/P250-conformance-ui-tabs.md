---
id: P250
node: ui-tabs
title: "Konformitäts-Pass ui-tabs(+tab) (leicht) — `variant` (line/contained/pills) ungetestet, tab-Kind ohne Katalog; activeTab/Render exzellent"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
---
# P250 — Konformitäts-Pass ui-tabs (+ ui-tab)

> Audit 2026-07-17. **Exzellent abgedeckt** — 9 outcome-E2E (Render sl-tab/-panel,
> `activeTab` literal/state/Zwei-Wege-Write-Back/SSE, Default-erste-aktiv,
> tabChange-Event, Legacy-tabs-JSON-Migration), Base-Fields, Katalog, Kind-
> Eindeutigkeit (ADR 0018).

## findings

### A. `variant` (line/contained/pills) ungetestet
`variant: z.enum(["line","contained","pills"])` ist eine **Nicht-Farb-Appearance**
(nicht color/severity). Es gibt eine `mapVariant`-Infrastruktur
(`webapp-serializer.js:287`), aber **kein Test** prüft, dass die drei Werte einen
beobachtbaren Unterschied am `sl-tab-group` erzeugen. **Zu verifizieren:** rendert
`variant` observabel (Attribut/Klasse)? Falls nein → inert (implementieren oder
entfernen); falls ja → Test ergänzen. (Berührt P240 variant-vs-color: `variant`
ist hier korrekt eine Appearance, keine Farbe.)

### B. ui-tab: Kind-Knoten ohne Katalog
`ui-tab` (label-Binding + icon) hat **kein** `.tests.md` und keine eigenen E2E —
Kind-Knoten, via ui-tabs R01/R02 abgedeckt. Wie ui-accordion-section: schlanker
Katalog **oder** dokumentierte Kind-Knoten-Ausnahme; Base-Field-N/A vermerken.

### C. Solide (nicht neu aufbauen)
Render, activeTab (alle Binding-Arten + Zwei-Wege + SSE), Default-Aktiv,
tabChange-Event, Legacy-Migration, Base-Fields.

## acceptance
- **`variant` aufgelöst:** jeder Wert erzeugt einen **gemessenen** DOM-Unterschied
  (Attribut/Klasse am sl-tab-group) + Test — oder Feld als inert dokumentiert/entfernt.
- **ui-tab:** Katalog angelegt **oder** dokumentierte Kind-Knoten-Ausnahme.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — variant-Unterschied gemessen; die 9 bestehenden bleiben grün.

## spec
`docs/nodes/navigation/ui-tabs.md` (+ ui-tab.md) — variant-Render-Wirkung, Kind-Knoten.

## tests
`tests/e2e/nodes/view/ui-tabs.spec.ts` + Katalog; ggf. ui-tab.tests.md.

## notes for the implementer
- Gemeinsames Muster mit ui-accordion (P247: multiple) und den Kind-Knoten
  ui-tab/ui-accordion-section — konsistent entscheiden.
