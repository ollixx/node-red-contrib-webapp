---
id: P268
title: "Node-Referenz-Batch input: Formular-Knoten (9): input, select, checkbox, radio, switch, textarea, datepicker, slider, button — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) + Editor-Label-i18n (data-i18n + Kataloge) je Knoten"
epic: aspects/docs
status: done
dependencies: [P265, P272]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P268 — Node-Referenz-Batch: input

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (9)

`ui-input, ui-select, ui-checkbox, ui-radio, ui-switch, ui-textarea, ui-datepicker, ui-slider, ui-button`

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

- **value/writeTo/writeTrigger** (ADR 0027) je Knoten konsistent erklären — auf den Formular-Guide (P266) stützen, Knoten-Doc zeigt nur die Knoten-Spezifika.
- **ui-textarea:** Feld heißt `lines` (P229-Rename) — Alt-`rows` nur als Migrations-Notiz.
- **ui-button:** Events/color/visible-Verhalten aus P236-Ergebnis.

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

**Done 2026-07-24.** Der input-Batch ist durch — **9 Formular-Knoten migriert**, je
ein Commit (EN+DE, Drift-Regel).

### Geliefert (9 Knoten-Commits + Cross-Links + Guardrail)

`e13ad37` ui-input · `7a40c87` ui-textarea · `4409f96` ui-select · `ed89a57`
ui-radio · `67d8bdb` ui-checkbox · `b1c80c7` ui-switch · `9842d96` ui-slider ·
`d94149a` ui-datepicker · `6302d9e` ui-button · `e8c9d4a` Cross-Links ·
`58af5a6` check-help-Transitionslisten.

Je Knoten Guide-Doc EN+DE, locales-Hilfe (Inline entfernt), Label-i18n-Kataloge,
smoke-verifizierte Beispiele. Batch-Besonderheiten: value/writeTo/writeTrigger
(ADR 0027) konsistent auf den P266-Formular-Guide gestützt; ui-textarea `lines`
(P229, `rows` nur Migrationsnotiz); ui-button reales P236-Verhalten inkl. der
bekannten `visible`-Render-Gate-Lücke (dokumentiert, nicht versprochen).

### Guardrail-Fortschritt

`check:guide`/`check:help`/label: **21 von 44** migriert, Allowlists 32 → **23**.
Smoke-Harness 21 → **30** Beispiele.

### Verifikation (Orchestrator — Agent starb am Session-Limit VOR seinem Voll-Lauf)

Alle 9 Knoten waren committet (Einheiten-Disziplin → verlustfrei); der Orchestrator
übernahm nur das Gate + reapte die geleakte 1883-node-red. **Voll-Suite 936 passed,
0 failed, `--retries=0`, 17,2 min** (Normal-Laufzeit). Build + `check:links` (196 md)
+ alle Tripwires grün.
