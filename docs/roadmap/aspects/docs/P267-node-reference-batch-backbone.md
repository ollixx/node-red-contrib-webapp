---
id: P267
title: "Node-Referenz-Batch backbone: Struktur/State/Behavior/Components (11 Knoten): app, route, dialog, store, store-read, store-action, query, query-action, action, component-definition, component-instance — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) je Knoten"
epic: aspects/docs
status: pending
dependencies: [P265]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P267 — Node-Referenz-Batch: backbone

> Rationale: **[ADR 0042](../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
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
