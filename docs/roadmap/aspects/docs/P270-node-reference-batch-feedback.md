---
id: P270
title: "Node-Referenz-Batch feedback: Feedback-Knoten (7): alert, toast, progress, skeleton, badge, empty-state, log — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) je Knoten"
epic: aspects/docs
status: pending
dependencies: [P265]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P270 — Node-Referenz-Batch: feedback

> Rationale: **[ADR 0042](../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (7)

`ui-alert, ui-toast, ui-progress, ui-skeleton, ui-badge, ui-empty-state, ui-log`

## acceptance (je Knoten, nach den P265-Templates)

- **Guide-Doc** `docs/guide/nodes/<node>.md` (EN) + `docs/guide/de/nodes/<node>.md`:
  Purpose · When to use · **alle Felder mit Varianten** (user-level; Wahrheit aus
  dem Contract-Doc `docs/nodes/**`, das check:specs-verifiziert ist) · Inputs
  (msg-Verhalten wie im Konformitäts-Programm gemessen) · Outputs/Events ·
  **1–3 Import-Beispiele** (`examples/guide/…`, Import-Anleitung) · Related.
- **locales-Hilfe** `nodes/<cat>/locales/en-US/<node>.html` + `locales/de/<node>.html`
  nach Hilfe-Template (Purpose · Key fields · **Inputs-Pflichtabschnitt** ·
  Outputs · Guide-Link); der Inline-`data-help-name`-Block ist entfernt.
- **Beispiele smoke-verifiziert** (Harness deployt + prüft Render).
- **Guardrail-Fortschritt:** die `check:guide`- und `check:help`-Allowlist-
  Einträge dieser Knoten sind entfernt (schrumpfend Richtung leer).
- `check:links` + `pnpm validate` grün; Stichprobe im Editor: Hilfe erscheint in
  beiden Sprachen (Sprachumschaltung, mind. 2 Knoten des Batches gemessen).

## Batch-spezifische Hinweise

- **ui-empty-state:** aktuellen Stand ehrlich dokumentieren + Hinweis auf geplantes Redesign (P152 deferred) — kein Versprechen.
- **ui-log:** forwardErrorsToClient-Voraussetzung prominent (P246-Ergebnis).
- **ui-skeleton:** die realen displayType-Formen aus dem P241-Ergebnis.

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
