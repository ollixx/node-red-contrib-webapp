---
id: P249
node: ui-table
title: "Konformitäts-Pass ui-table (leicht) — `footer` + Sekundär-Events (rowAction/checkboxChange/cellSelect) ohne Verhaltens-E2E; Kern solide"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-20.** Leichter Pass; jedes verdächtige Feld **gemessen**, dann
aufgelöst. Der solide Render-/rowSelect-Kern unangetastet.

### Gemessen inert → entfernt (Orchestrator unabhängig gegen den Serializer geprüft)

- **`footer` (`z.boolean()`)**: der Table-Serializer-Zweig (`webapp-serializer.js`
  682–727) gibt ein `<table>` **ohne `<tfoot>`** zurück; die „footer-Region" bei
  ~1596 ist ein **generischer Layout-Regionsname**, kein Tabellen-Footer.
  `footer:true` erzeugte null DOM-Wirkung → aus Schema+Editor+Spec entfernt.
- **Sekundär-Events `rowAction`/`checkboxChange`/`cellSelect`**: der Table-Serializer
  emittiert **nur** `data-webapp-event="rowSelect"` (Z. 719). Kein DOM-Element sourct
  je rowAction/checkboxChange/cellSelect aus einer Tabelle (die generische
  CLICK_EVENTS-Liste + der `webapp.js`-Handler sind Infrastruktur ohne Table-Emitter).
  → aus dem `events`-Enum + Spec entfernt (kein dokumentiertes Event ohne Wirkung).
  **Der Server-Handler** (webapp.js) auf `rowSelect` verengt.

### Back-Compat (Legacy-Flows brechen nicht)

`SUPPORTED_TABLE_EVENTS = Set(["rowSelect"])` + `filterSupportedTableEvents()` filtert
die entfernten Werte aus Alt-Flow-Configs **vor** der Schema-Validierung → ein Flow
mit `events:["rowAction"]` validiert weiter (Wert wird still verworfen), kein
Deploy-Fehler.

### Belegt statt entfernt

- **`selectAction`** (`z.string().optional()`): neuer E2E beweist, dass ein
  konfiguriertes `selectAction` den rowSelect-Link mit `data-webapp-action` trägt.
- p13-e2e/unit + p83-unit auf den konformen Vertrag **angepasst** (nicht neu
  aufgebaut); die 7 soliden Render-/rowSelect-/Inject-E2E unberührt; Katalog
  `ui-table.tests.md` + gen-node-examples-Label nachgezogen.

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 801 passed, 0 failed, `--retries=0`, 15,2 min.** `pnpm build` grün; Unit
schema 503 / runtime 1370. `pnpm validate` + Tripwires grün.

### Recovery-Nebenbefund

Der Implementer-Agent wurde **mitten in der Verifikation** vom Watchdog gekillt —
aber er hatte (per Brief-Härtung) **vor** der Verifikation committet, sodass die
Arbeit vollständig auf `phase/P249` lag; Recovery = nur Merge. Der Orchestrator hat
die konsequenzenreiche Entfernung (Events aus dem Schema) **unabhängig gegen den
Serializer verifiziert** (nicht dem Agenten vertraut), bevor er merkte — die
Schlussfolgerung „inert" hielt.
