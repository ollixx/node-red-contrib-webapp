---
id: P249
node: ui-table
title: "Konformitäts-Pass ui-table (leicht) — `footer` + Sekundär-Events (rowAction/checkboxChange/cellSelect) ohne Verhaltens-E2E; Kern solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/display/ui-table.md
tests: tests/e2e/nodes/view/ui-table.tests.md
---
# P249 — Konformitäts-Pass ui-table (leicht)

> Audit 2026-07-17. Kern **solide** — 7 outcome-E2E (Spalten→`th`, Zeilen→`td`,
> leere Tabelle, Store-Rows reaktiv, Legacy-`rowsPath`-Migration, `rowSelect`-POST,
> Inject-Update), Base-Fields korrekt, Katalog vorhanden, Doku-Link korrekt.

## findings

### A. `footer` ohne Verhaltens-E2E
Schema `footer: z.boolean()`. Der Serializer kennt eine `footer`-Region
(`webapp-serializer.js:1578`), aber **kein E2E** prüft, dass `footer:true` einen
beobachtbaren Tabellen-Footer erzeugt (und `footer:false` keinen). Die
`p13-table-enhancements.spec.ts`-Tests (3) sind reine **Editor-/Registrierungs**-
Asserts („events + footer defaults", „editor HTML contains … footer checkbox") —
kein Render-Outcome.

### B. Sekundär-Events nur unit-belegt
`events: ["rowSelect","rowAction","checkboxChange","cellSelect"]`. E2E deckt nur
**`rowSelect`**. `rowAction` (Handler in webapp.js:2647 vorhanden),
`checkboxChange`, `cellSelect` haben **nur Unit-Coverage**
(`p13-table-enhancements.test.ts`, `p83-display-nodes-behaviour.test.ts`) — kein
gemessenes Verhaltens-E2E (Klick/Change → Envelope).

### C. `selectAction` ungetestet
`selectAction: z.string().optional()` — die Action, die ein rowSelect auslöst; nicht
per E2E belegt.

### D. Solide (nicht neu aufbauen)
columns/rows-Render, leere Tabelle, Store-Rows reaktiv, Legacy-Migration,
rowSelect-POST inkl. `params.row`-Anreicherung (webapp.js:2647), Inject-Update.

## acceptance

- **`footer`-Verhaltens-E2E:** `footer:true` erzeugt einen **gemessenen** Footer
  (z. B. `<tfoot>`/Footer-Region im DOM), `footer:false` keinen.
- **Sekundär-Events als Verhaltens-E2E:** je ein gemessener Test für `rowAction`,
  `checkboxChange`, `cellSelect` (Interaktion → korrektes `msg.ui`-Envelope) — oder,
  falls ein Event nicht real implementiert ist, aus Schema+Spec entfernt (kein
  dokumentiertes Event ohne Wirkung).
- **`selectAction`** per Test belegt (rowSelect trägt die konfigurierte Action).
- **Katalog** `ui-table.tests.md` spiegelt die neuen Tests.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — footer + die drei Sekundär-Events + selectAction gemessen; die 7
bestehenden bleiben grün.

## spec
`docs/nodes/display/ui-table.md` — footer-Render-Wirkung, alle vier Events mit
beobachtbarem Effekt, selectAction.

## tests
`tests/e2e/nodes/view/ui-table.spec.ts` (+ ggf. p13-Enhancements zu echten
Render-Tests aufwerten) + Katalog.

## notes for the implementer
- Zuerst prüfen, ob checkboxChange/cellSelect real feuern (Handler/Serializer) —
  wenn nicht, ist das Entfernen die Konformität, nicht das Testen.
- `rowSelect`/`rowAction`-`params.row`-Anreicherung sitzt in webapp.js:2647.
