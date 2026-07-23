---
id: P272
title: "Editor-Label-i18n: Mechanik am Piloten bewiesen (data-i18n + locales-JSON, en-US+de) + die GETEILTEN editor-common-Strings übersetzt (Base-Field-Hinweise, Picker, SelectBox-Optionen)"
epic: aspects/docs
status: pending
dependencies: [P265]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
---
# P272 — Editor-Label-i18n: Mechanik + geteilte Strings

> Rationale: **[ADR 0042](../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**
> §3 (Owner-Erweiterung 2026-07-22: Feldnamen im Editor gehören mit übersetzt).
> Analog zu P265 (Hilfe-Mechanik): **erst die Label-Mechanik beweisen, dann
> rollen** — die per-Knoten-Labels übernehmen danach die Batches P267–P271 in
> denselben Dateien, die sie ohnehin anfassen.

## findings

- **Editor-Labels sind heute sprachgemischt** wie die Hilfen: ui-dialog „Titel"/
  „Schließbar"/„Modal", ui-action „Zielpfad"/„Ziel-Route" (deutsch) vs. ui-log
  „Min Severity"/„Max Entries"/„Start collapsed" (englisch). Keine i18n-Kataloge
  im Repo.
- Node-RED-Mechanik (zu beweisen): `data-i18n`-Attribute im Editor-HTML +
  Message-Kataloge `nodes/<cat>/locales/<lang>/<node>.json`; Editor-Sprache wählt
  den Katalog. Zusammenspiel mit dem zentralen `registerNodeType`-Wrapper
  (`editor-common.js`) und der webapp.js-Zentral-Registrierung ist ungeklärt —
  Pilot-Pflicht.
- **Geteilte Strings leben in `resources/lib/editor-common.js`** (einzige
  kanonische Kopie) und erscheinen auf ~allen Knoten: Base-Field-Zeilen
  (visible/disabled/color/size) inkl. **N/A-Hinweise** („Ein Log hat keinen
  interaktiven Zustand.", „Dieser Knoten hat keine Größen-Stufen." …),
  Picker-Buttons („Icon wählen…"), Layout-/Referenz-Selektoren, geteilte
  SelectBox-Optionstexte. Für diese braucht es einen **gemeinsamen Namespace/
  Katalog** — die Mechanik dafür (welcher Node-Set trägt den Katalog, wie greift
  editor-common darauf zu) ist Kern dieses Pakets.
- Risiko-Check: Labels berühren KEINE Persistenz (`defaults` unverändert) —
  Roundtrip-Risiko gering; aber einzelne Editor-E2E asserten sichtbare
  Label-Texte — die betroffenen Specs müssen auf ids/`data-i18n`-Keys oder die
  en-US-Texte normiert werden.

## acceptance

- **Mechanik am Piloten `ui-divider` bewiesen (Browser, gemessen):** Formzeilen-
  Labels des Piloten via `data-i18n`; Kataloge `nodes/view/locales/en-US/ui-divider.json`
  + `locales/de/ui-divider.json`; im Editor erscheinen die Labels **englisch bei
  en-US** und **deutsch bei de** (Sprachumschaltung gemessen). Die exakte Mechanik
  (Key-Konvention, Katalog-Lage, Fallback, Zusammenspiel mit
  `common.registerNodeType`) steht als **verbindliche Anleitung** im Guide-README
  (Erweiterung des P265-Kapitels).
- **Geteilte editor-common-Strings übersetzt:** Base-Field-Labels + **alle
  N/A-Hinweis-Texte**, Picker-Buttons, Layout-/Referenz-Selektor-Beschriftungen
  und geteilte SelectBox-Optionen laufen über den gemeinsamen Katalog (en-US + de);
  gemessen an mind. **zwei** Knoten unterschiedlicher Kategorien (z. B. ui-menu
  Base-Fields, ui-icon Picker-Button) in beiden Sprachen.
- **Key-Konvention dokumentiert** (z. B. `<node>.label.<field>`, gemeinsamer
  Namespace für editor-common) — damit die Batches mechanisch folgen können.
- **Keine Persistenz-Regression:** `check:roundtrip` grün (Labels ändern keine
  `defaults`); die Label-assertenden Editor-E2E sind auf en-US-Texte bzw.
  strukturelle Selektoren normiert und grün.
- **Guardrail:** `check:help`-Familie um einen Label-Katalog-Check erweitert
  (jeder Knoten mit `data-i18n`-Labels hat en-US- UND de-Katalog; Allowlist =
  alle außer Pilot, die Batches treiben sie leer).
- `pnpm validate` + volle Editor-E2E grün.

## verify

`browser` — Pilot-Labels + zwei geteilte-String-Stellen je in beiden Sprachen im
echten Editor gemessen; Roundtrip + Editor-Suite grün.

## spec

`docs/guide/README.md` (i18n-Anleitung, um Labels erweitert).

## tests

Editor-E2E Sprachumschaltung (Pilot + shared-Strings-Stichprobe);
Katalog-Guardrail-Unit.

## notes for the implementer

- **Reihenfolge:** Mechanik-Beweis am Piloten VOR dem editor-common-Umbau; der
  gemeinsame Namespace ist der heikle Teil (webapp.js-Zentral-Registrierung) —
  reale Mechanik dokumentieren, nicht raten.
- `resources/lib/editor-common.js` ist die **einzige kanonische Kopie**
  (CLAUDE.md) — keine Zweitkopien für Kataloge anlegen.
- Die per-Knoten-Labels sind **NICHT** Scope (das machen P267–P271 in ihren
  Dateien); hier nur Pilot + geteilte Strings + Anleitung + Guardrail.
- Deutsch im selben Paket (ADR 0042 §3).
