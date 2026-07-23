---
id: P267
title: "Node-Referenz-Batch backbone: Struktur/State/Behavior/Components (11 Knoten): app, route, dialog, store, store-read, store-action, query, query-action, action, component-definition, component-instance — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) + Editor-Label-i18n (data-i18n + Kataloge) je Knoten"
epic: aspects/docs
status: done
dependencies: [P265, P272]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P267 — Node-Referenz-Batch: backbone

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (11)

`ui-app, ui-route, ui-dialog, ui-store, ui-store-read, ui-store-action, ui-query, ui-query-action, ui-action, ui-component-definition, ui-component-instance`

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

- **ui-dialog:** `modal` ist dokumentiert-immer-modal (P245-Entscheid) — die Doku sagt die Wahrheit, verspricht kein Nicht-Modal.
- **ui-component-definition/-instance:** leichter dokumentierte Config-Knoten (Programm-Ausnahme) — kurzer Guide-Doc reicht; Beispiele zeigen Definition+Instanz zusammen.
- **state-Familie:** Fehler-Codes + Scope-Regeln aus den Contract-Docs übernehmen (ui-store-action.md ist die Vorlage); Wire-vs-Referenz auf den Actions-Guide (P266) verlinken.
- **ui-action:** alle 10 Verben mit je einem Mini-Beispiel; navigate = kanonischer Weg (ADR 0040).

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

**Done 2026-07-23.** Der erste der fünf Referenz-Batches ist durch — **11 Knoten
vollständig migriert**, je Knoten ein Commit (EN+DE zusammen, Drift-Regel).

### Geliefert (11 Commits + Guardrail-Nachzug)

`b1419ad` ui-app · `bb576a0` ui-route · `536919a` ui-dialog · `a748f01`
ui-component-definition + -instance (gemeinsames Beispiel, Programm-Ausnahme:
kurze Config-Knoten-Docs) · `ec892b0` ui-store · `1054d49` ui-store-read ·
`d2abe80` ui-store-action · `08f1fe7` ui-query · `7bba8fa` ui-query-action ·
`bb0c3b4` ui-action · `e84baf7` check-help-Transitionslisten-Assertions.

Je Knoten: **Guide-Doc** `docs/guide/nodes/<node>.md` + `de/`-Spiegel (Purpose ·
When to use · alle Felder mit Varianten · Inputs mit gemessenem msg-Verhalten ·
Outputs/Events · Import-Beispiele · Related), **locales-Hilfe** en-US+de (Inline-
`data-help-name` entfernt), **Label-i18n** (`data-i18n` + `<node>.json`-Kataloge
en-US/de nach der P272-Key-Konvention), **smoke-verifizierte Beispiele**.
Batch-Besonderheiten eingehalten: ui-dialog dokumentiert `modal` wahrheitsgemäß als
immer-modal (P245); state-Familie mit Fehler-Codes/Scope-Regeln aus den Contracts +
Wire-vs-Referenz-Verlinkung auf den P266-Actions-Guide; ui-action mit allen
10 Verben.

### Guardrail-Fortschritt (das messbare Ziel)

`check:guide`: **12 von 44** abgedeckt (Pilot + 11), Allowlist 43 → **32**.
`check:help`: **12 locale-migriert** (Hilfe) und **12 label-migriert**
(data-i18n-Kataloge), Restlisten je 43 → **32**. Beide schrumpfen mit P268–P271
auf null.

### Verifikation

**Voll-Suite 927 passed, 0 failed, `--retries=0`, 17,1 min** — Normal-Laufzeit
zurück (die 1883-Leaks der Vorwelle sind weg; die Hygiene-Härtung im Brief griff:
Agent gab mit leerem 1882 **und** 1883 zurück). Merge-Gate im Haupt-Checkout:
Build grün, Smoke-Harness **21 passed** (10 → 21 Beispiele), `check:links` 178 md,
alle Tripwires grün.
