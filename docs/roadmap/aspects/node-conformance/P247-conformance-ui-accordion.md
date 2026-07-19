---
id: P247
node: ui-accordion
title: "Konformitäts-Pass ui-accordion(+section) — `multiple` ist inert (Single-Open nicht durchgesetzt), events nur unit-getestet, section ohne Katalog; Render/openSection solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-accordion.md
tests: tests/e2e/nodes/view/ui-accordion.tests.md
---
# P247 — Konformitäts-Pass ui-accordion (+ ui-accordion-section)

> Audit 2026-07-17 (node-conformance). ui-accordion ist im Kern **solide** — 7
> outcome-E2E (Render zweier Sektionen, `openSection` literal/state/SSE,
> Default-erste-offen, Legacy-`sections`-JSON-Migration), Base-Fields korrekt via
> `installBaseFields`, Hilfe + Doku-Link korrekt, Katalog vorhanden. Ein inertes
> Feld und zwei kleinere Lücken.

## findings

### A. `multiple` ist inert — Single-Open nicht durchgesetzt
`mapConfig` (webapp.js) trägt `multiple` durch (`multiple: config.multiple === true …`),
aber **niemand liest es**: der Serializer (`resources/lib/webapp-serializer.js:1201–1227`)
rendert **ein `<sl-details>` pro Kind** mit `open`-Attribut aus `openSection` und
referenziert `multiple` nie; Renderer und Client-Bundle ebenfalls nicht. `sl-details`
sind **nativ unabhängig** — ohne `multiple`-Behandlung sind **immer alle** Sektionen
einzeln auf-/zuklappbar. Die Accordion-typische **Single-Open-Semantik**
(`multiple:false` ⇒ Öffnen einer Sektion schließt die anderen) ist **nicht
implementiert**. `multiple` ist damit ein dokumentierter Schalter ohne Wirkung.
Ungetestet.

### B. `events` (sectionOpen/sectionClose) nur unit-getestet
Belegt in `packages/runtime/test/p85-navigation-nodes-behaviour.test.ts` +
`tests/e2e/nodes/editor/navigation-nodes.spec.ts` (Editor-Persist), aber **kein
Verhaltens-E2E** feuert die Events und misst das Output-Envelope.

### C. ui-accordion-section: kein Katalog, Kind-Knoten-Status ungeklärt
`ui-accordion-section` hat **kein** `.tests.md` und keine eigenen E2E — es ist ein
**Kind-Knoten** (kein eigenständiger Render; `label`-Binding + `icon`, via die
Accordion-Tests R01/R02 abgedeckt). Wie `ui-tab` zu `ui-tabs` braucht es entweder
einen schlanken Katalog **oder** eine dokumentierte Ausnahme (wie die
Component-Knoten). Base-Fields fehlen in seinen `defaults` (name/parent/mount/label/
icon) — für einen reinen Sektionskopf ist das zu bestätigen (N/A?).

### D. Was solide ist (nicht neu aufbauen)
Render (2 Sektionen → 2 `sl-details`), `openSection` (literal/state/SSE-Re-Render),
Default-erste-Sektion-offen, Legacy-`sections`-JSON-Migration, Base-Fields,
Kind-Eindeutigkeits-Validierung (`validateUiAccordionChildrenUnique`, ADR 0018).

## acceptance

- **`multiple` aufgelöst** (Owner-Entscheid, s. u.) — nach dem Paket stimmen Spec
  und Verhalten überein:
  - *implementieren:* `multiple:false` erzwingt Single-Open (Öffnen einer Sektion
    schließt die übrigen — client- oder server-koordiniert), `multiple:true` erlaubt
    Mehrfach-Offen; **gemessener** E2E für beide Richtungen.
  - *dokumentieren/entfernen:* die Spec sagt, dass Sektionen heute **immer
    unabhängig** (multi-open) sind, und `multiple` ist als Zukunft markiert **oder**
    aus Schema+Editor+Spec entfernt.
- **`events`-Verhaltens-E2E:** `sectionOpen`/`sectionClose` feuern beim Auf-/Zuklappen
  mit korrektem `msg.ui`-Envelope (gemessen).
- **ui-accordion-section:** Katalog `ui-accordion-section.tests.md` angelegt **oder**
  dokumentierte Kind-Knoten-Ausnahme (mit Verweis auf die Eltern-Abdeckung); die
  Base-Field-N/A-Entscheidung ist in der Section-Spec vermerkt.
- **Katalog** `ui-accordion.tests.md` spiegelt die neuen Tests.
- **E2E grün**; `check:specs`/`check:fields`/`check:help`/`check:roundtrip`/
  `check:links` + `pnpm validate` grün.

## verify

`browser` — Single-Open/Multi-Open (falls implementiert) + events per gemessenem
DOM/Envelope; die 7 bestehenden Tests bleiben grün.

## spec

`docs/nodes/navigation/ui-accordion.md` (+ `ui-accordion-section.md`) —
`multiple`-Wahrheit, events-Verhalten, Kind-Knoten-/Base-Field-N/A.

## tests

`tests/e2e/nodes/view/ui-accordion.spec.ts` + Katalog; ggf.
`ui-accordion-section.tests.md`.

## notes for the implementer

- **`multiple`-Muster** = dasselbe Inert-Feld wie ui-menu `displayType` / ui-dialog
  `modal` (P244/P245): mapConfig trägt durch, Serializer ignoriert. Empfehlung:
  Single-Open ist ein echtes Feature (Koordination nötig) — im Zweifel dokumentieren.
- **Spiegel `ui-tabs`** — dort ist dieselbe openSection/multiple/events-Struktur
  (`activeTab`); die tabs-Behandlung ist die Referenz (ui-tabs ist noch offen — ggf.
  gemeinsam entscheiden).
- Kind-Knoten-Muster: siehe `ui-tab`/`ui-tabs` (auch noch offen).

## Owner-Entscheid (vor Umsetzung zu bestätigen)

1. **`multiple`:** Single-Open-Semantik **implementieren** oder als „Sektionen sind
   heute immer unabhängig" **dokumentieren/entfernen**?
