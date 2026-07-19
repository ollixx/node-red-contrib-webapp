---
id: P247
node: ui-accordion
title: "Konformitäts-Pass ui-accordion(+section) — `multiple` ist inert (Single-Open nicht durchgesetzt), events nur unit-getestet, section ohne Katalog; Render/openSection solide"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-19.** Owner-Entscheid **implementieren** umgesetzt: `multiple:false`
(Default) erzwingt jetzt echtes Single-Open.

### Single-Open verdrahtet (Serializer-Flag + gescopeter Client-Listener)

- **Serializer** (`webapp-serializer.js`): der `.webapp-accordion`-Wrapper emittiert
  `data-webapp-source=<id>` + `data-webapp-accordion-multiple="true|false"`
  (`props.multiple === true`; Default false = Single-Open, konsistent mit der Spec
  „Im Einzel-Modus ist genau die openSection offen").
- **Client** (`webapp-client.js`, +67 Z.): delegierte `sl-show`/`sl-hide`-Listener.
  Expand → `sectionOpen`, Collapse → `sectionClose` (beide `params.sectionId` =
  `data-webapp-part`). Bei `multiple!="true"` schließt ein Expand die offenen
  Geschwister **nur innerhalb dieses einen Accordions** (`closest(".webapp-accordion
  [data-webapp-source]")`-gescopet); ui-log-`<sl-details>` u. a. sind per
  `data-webapp-part`-Guard ausgenommen. Server-Default-Open (`openSection`) unverändert.

### Gemessene Tests (11 grün im Node-Spec, retries=0)

- **S01** `multiple:false` (Default): Öffnen von Sektion 2 → 2 offen, 1 verliert `open`.
- **S02** `multiple:true`: Öffnen von Sektion 2 → beide offen (keine Koordination).
- **E01/E02** echte Expand/Collapse-Geste → POST `/event`
  `{sectionOpen|sectionClose, params.sectionId}`.
- Die 7 bestehenden R01/R02/O01–O03/D01/M01 blieben grün.

### ui-accordion-section (Kind-Knoten)

Dokumentierte **Kind-Knoten-Ausnahme** (ui-tab-Präzedenz): kein eigener Katalog;
`ui-accordion-section.md` verweist auf die Eltern-Abdeckung (R01/R02 + P169-Unit/
Schema) und hält **Base-Fields = N/A** fest (reiner Sektionskopf, kein eigenes
Chrome, nicht eigenständig interaktiv).

### Ein autoritativer Regressions-Fund (behoben) — der Wert der Voll-Suite

Der autoritative Voll-Lauf war **794 passed / 1 failed** (`--retries=0`). Die eine
Interaktion: `ui-action-verbs.spec.ts:160` (P53) — der ui-action-`open`-Verb
offenbart eine Accordion-Sektion programmatisch. Dessen alte Assertion („Sektion A
bleibt offen — Disclosure ist additiv") kodierte das **Vor-P247-Multi-Open-Verhalten
aus Versehen** und **widersprach der Accordion-Spec selbst** (`multiple:false`
Default = nur openSection offen). Single-Open gilt konsistent auch für
programmatische Disclosure → Öffnen von B schließt A. Assertion an den dokumentierten
Vertrag angeglichen (kein erfundenes Verhalten; „additive disclosure" war **kein**
dokumentierter ui-action-Vertrag). Betroffene Specs danach **16 passed**. Alle
übrigen 793 waren im selben Voll-Lauf grün; der Fix ist rein Test-Assertion und kann
keine anderen Tests beeinflussen.

### Verifikation

`pnpm validate` + alle Tripwires grün (Agent-seitig zu Ende gelaufen); autoritativer
Voll-Lauf 794/1 → nach dem Test-Fix grün. Der Implementer-Agent committete VOR der
Verifikation und stoppte alle Prozesse (Port 1882 frei) — Brief-Härtung greift.

### NUL-Byte-Grep-Falle (wiederholt)

`webapp-client.js` ist `file`-detektiert als binär → plain `grep` findet den neuen
Listener **nicht** (stиller Leerbefund); `grep -a`/`git grep` zeigt ihn (Z. 852+).
Die vorgeschlagene `grep -rlP '\x00'`-Tripwire über `resources/lib/` ist weiter offen.
