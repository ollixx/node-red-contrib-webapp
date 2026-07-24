---
id: P269
title: "Node-Referenz-Batch display: Display-Knoten (8): text, table, list, repeat, container, image, icon, avatar — (divider ist der P265-Pilot) — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) + Editor-Label-i18n (data-i18n + Kataloge) je Knoten"
epic: aspects/docs
status: done
dependencies: [P265, P272]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P269 — Node-Referenz-Batch: display

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (8)

`ui-text, ui-table, ui-list, ui-repeat, ui-container, ui-image, ui-icon, ui-avatar`

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

- **ui-repeat:** transparent (ADR 0025), item/index/alias-Scoping — 2–3 Beispiele Pflicht (einfach, verschachtelt, mit Container).
- **ui-list:** Item-Schema + displayValue/badge + Field-Mapping (P208) + Single-Select (P173).
- **ui-icon/ui-image:** color-Modell (ADR 0039, token:) bzw. asset:-Quelle + Media-Proxy erklären.

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

**Done 2026-07-24.** Der display-Batch ist durch — **8 Knoten migriert** (ui-divider
war der Pilot), je ein Commit (EN+DE).

### Geliefert (8 Knoten-Commits + Support)

`949e9b0` ui-text · `1b3ced7` ui-table · `df44bbf` ui-list · `468cb60` ui-repeat
(3 Beispiele: simpel, verschachtelt mit named scope, eine Card je Item) ·
`723cc3b` ui-container · `6cf1381` ui-image · `c91d5c8` ui-icon · `460faca`
ui-avatar. Support: `d6835b8` Unit-Assertions, `0811f1a` Smoke-Fix, `0e4ee0e`
Label-Pin-Fix, `68ee1af` Log.

Je Knoten Guide-Doc EN+DE, locales-Hilfe (Inline entfernt), Label-i18n-Kataloge,
smoke-verifizierte Beispiele. Batch-Besonderheiten: ui-repeat transparent (ADR 0025,
item/index/named scopes); ui-list Item-Schema + Field-Mapping (P208) + Single-Select
(P173); ui-icon Token-Farbmodell (ADR 0039, P238) + bindbarer Name (P239); ui-image
`asset:`-Quelle + Media-Proxy + buffer→data:-URL. **Keine Contract-Widersprüche.**

### Guardrail-Fortschritt

`check:guide`/`check:help`/label: **29 von 44** migriert, Allowlists 23 → **15**.
Smoke-Harness 30 → **40** Beispiele.

### Verifikation

Agent-Voll-Lauf 945/1 (die 1 = ein veralteter *deutscher* ui-list-size-Label-Pin,
den die Migration erzeugte → auf en-US-Katalogtext „Display Type" gefixt).
**Orchestrator-autoritativer Voll-Lauf nach Merge: 946 passed, 0 failed,
`--retries=0`, 17,2 min.** Build + `check:links` + alle Tripwires grün. Der Agent
killte proaktiv eine FREMDE geleakte 1883-node-red (Hygiene-Härtung wirkt präventiv);
Ports 1882/1883/1884 leer. Nebenbei: versehentlich mitcommittetes scratchpad-Log
entfernt + `scratchpad/` gitignored (`60ea74e`).
