---
id: P271
title: "Node-Referenz-Batch navigation: Navigations-Knoten (8): menu, breadcrumb, tabs, tab, accordion, accordion-section, stepper, pagination — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) + Editor-Label-i18n (data-i18n + Kataloge) je Knoten"
epic: aspects/docs
status: done
dependencies: [P265, P272]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P271 — Node-Referenz-Batch: navigation

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (8)

`ui-menu, ui-breadcrumb, ui-tabs, ui-tab, ui-accordion, ui-accordion-section, ui-stepper, ui-pagination`

## acceptance (je Knoten, nach den P265-Templates)

- **Guide-Doc** `docs/guide/nodes/<node>.md` (EN) + `docs/guide/de/nodes/<node>.md`:
  Purpose · When to use · **alle Felder mit Varianten** (user-level; Wahrheit aus
  dem Contract-Doc `docs/nodes/**`, das check:specs-verifiziert ist) · Inputs
  (msg-Verhalten wie im Konformitäts-Programm gemessen) · Outputs/Events ·
  **1–3 Import-Beispiele** (`examples/guide/…`, Import-Anleitung) · Related.
- **locales-Hilfe** `nodes/<cat>/locales/en-US/<node>.html` + `locales/de/<node>.html`
  nach Hilfe-Template (Purpose · Key fields · **Inputs-Pflichtabschnitt** ·
  Outputs · Guide-Link); der Inline-`data-help-name`-Block ist entfernt.
- **Editor-Label-i18n** (ADR 0042 §3, Mechanik + Key-Konvention aus **P272**):
  Formzeilen-Labels, knoten-eigene SelectBox-Optionstexte und knoten-eigene
  Hinweise via `data-i18n` + Kataloge `nodes/<cat>/locales/{en-US,de}/<node>.json`;
  Sprachumschaltung an mind. 1 Knoten des Batches gemessen; Label-Katalog-
  Guardrail-Allowlist um diese Knoten geleert. (Geteilte editor-common-Strings
  sind P272 — hier NICHT anfassen.)
- **Beispiele smoke-verifiziert** (Harness deployt + prüft Render).
- **Guardrail-Fortschritt:** die `check:guide`- und `check:help`-Allowlist-
  Einträge dieser Knoten sind entfernt (schrumpfend Richtung leer).
- `check:links` + `pnpm validate` grün; Stichprobe im Editor: Hilfe erscheint in
  beiden Sprachen (Sprachumschaltung, mind. 2 Knoten des Batches gemessen).

## Batch-spezifische Hinweise

- **Kind-Knoten (tab, accordion-section):** eigener kurzer Doc, Beispiele beim Eltern-Knoten (Querverweis).
- **ui-menu:** displayType-Wahrheit aus P244 (honest-conformance) übernehmen — nichts versprechen, was nicht rendert.
- **Zwei-Wege-Binding** (activeTab/activeStep/currentPage) je mit Write-Back-Beispiel.

## verify

`browser` — Sprachumschaltungs-Stichprobe + alle Batch-Beispiele über den
Smoke-Harness; Guardrails grün mit geschrumpfter Allowlist.

## spec

Die Guide-Docs selbst; Contract-Docs bleiben unberührt (nur Quelle).

## tests

Smoke-Harness-Einträge; keine Verhaltens-Tests (Doku-Paket — Verhalten ist
durch das Konformitäts-Programm gedeckt).

## notes for the implementer

- **EN zuerst, DE im selben Paket** — nie einsprachig mergen (ADR 0042 §3).
- Bei Widerspruch Contract-Doc ↔ beobachtetem Verhalten: Contract prüfen,
  Widerspruch melden — NICHT in der Nutzer-Doku „glätten".
- Hilfe ist Zusammenfassung (Template-Deckel), kein Guide-Duplikat.

## Result

**Done 2026-07-24.** Der navigation-Batch ist durch — **8 Knoten migriert** — und
damit ist das **User-Docs-Programm (ADR 0042, P265–P272) vollständig**: alle 44
Knoten dokumentiert, **alle drei Doku-Allowlists LEER**.

### Geliefert

`f2dd1aa` ui-menu · `12dbf9d` ui-breadcrumb · `f7ea9cc` ui-tabs · `33801cf` ui-tab ·
`5045810` ui-accordion · `95bbcc6` ui-accordion-section · `bc2c80a` ui-stepper ·
`cdbc2be` ui-pagination; Support `049689d` (check-help-Restlisten leer), `4617b16`
(Breadcrumb-Beispiel-Fix). Kind-Knoten (ui-tab, ui-accordion-section) nach dem
P247/P250-Ausnahmemuster (kurzer Doc, Beispiele beim Eltern-Knoten).

**Konformitäts-Wahrheiten dokumentiert:** ui-menu displayType als geplant (P244),
`collapsed`/`dropdown` entfernt; ui-accordion single-open real (P247); ui-stepper
orientation real, `linear`/`complete` entfernt (P251); ui-pagination `showInfo` real,
`variant`/`totalItems` entfernt (P252). Zwei-Wege-Binding (activeTab/activeStep/
currentPage) je mit Write-Back-Beispiel.

### Contract-Inkonsistenz (gemeldet → Chip `task_b5f87bb0`)

ui-stepper `stepChange` emittiert `params.value` = Step-**Index**, während
`activeStep`/`msg.payload` per **id** adressieren → die „anticipated wiring" der
Contract-Doku schreibt einen Index, wo eine id gelesen wird. Guide dokumentiert die
ehrliche Event-Form; Reconciliation als Chip.

### FINALE — Abschlusskriterium erfüllt

`check:guide`: **44/44 abgedeckt, 0 Allowlist**. `check:help`: **44 locale-migriert
(Hilfe) + 44 label-migriert (data-i18n), je 0 transitional/allowlist**. ADR 0042
vollständig durchgesetzt. Smoke-Harness **53** Beispiele; `check:links` 242 md.

### Verifikation

Agent-Worktree-Voll-Lauf 959/0; **Orchestrator-autoritativer Voll-Lauf nach Merge:
959 passed, 0 failed, `--retries=0`, 17,2 min.** Build + alle Tripwires grün. Eine
gestrandete 1883-node-red vor dem Lauf gereapt; Ports leer.
