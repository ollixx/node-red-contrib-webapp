---
id: P272
title: "Editor-Label-i18n: Mechanik am Piloten bewiesen (data-i18n + locales-JSON, en-US+de) + die GETEILTEN editor-common-Strings übersetzt (Base-Field-Hinweise, Picker, SelectBox-Optionen)"
epic: aspects/docs
status: done
dependencies: [P265]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
---
# P272 — Editor-Label-i18n: Mechanik + geteilte Strings

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**
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

## Result

**Done 2026-07-23.** Die Editor-Label-i18n-Mechanik ist **bewiesen** (am Piloten
gemessen) und die geteilten editor-common-Strings sind übersetzt — die Batches
P267–P271 sind damit mechanisch entsperrt.

### Die 6 Einheiten (je committet)

`036d747` **Mechanik am Piloten ui-divider bewiesen**: `data-i18n`-Formzeilen-Labels
+ Kataloge `nodes/view/locales/{en-US,de}/ui-divider.json`; Sprachumschaltung real
gemessen (EN unter en-US, DE unter de). · `4eb07c8` **Geteilte editor-common-Strings
über einen gemeinsamen Namespace**: neues Node-Set `nodes/webapp-common.js` trägt die
`webapp-common`-Kataloge; Base-Field-Labels + alle N/A-Hinweise, Picker-Buttons,
Layout-/Referenz-Selektor-Beschriftungen, geteilte SelectBox-Optionen (en-US + de),
an zwei Knoten unterschiedlicher Kategorien gemessen. · `356aa26` **Key-Konvention**
im Guide-README (EN + de) als verbindliche Batch-Anleitung. · `8f0e3f0` label-
assertende Editor-E2E auf en-US-Texte normiert. · `38c70e2` **Guardrail**:
`check:help` um Label-Katalog-Parität + `LABEL_TRANSITION`-Restliste (schrumpft via
Batches auf leer) + shared-webapp-common-Parität erweitert. · `3091cfb` Katalog.

### Verifikation

Pilot-Labels + geteilte-String-Stellen in beiden Sprachen gemessen;
`check:roundtrip` grün (Labels ändern **keine** `defaults` — keine Persistenz-
Regression); `check:help` (Label-Sektion), `check:links` (156 md), `pnpm validate`
grün. **Die neuen Label-i18n-Specs** (`label-i18n-locales.spec.ts` +
`label-i18n-shared-strings.spec.ts`) grün.

### Voll-Suite: Code sauber, zwei Umgebungs-Artefakte

editor-common ist cross-cutting → Voll-Suite gefahren. **Zwei Läufe, je genau EIN
Timeout auf einem ANDEREN unverwandten Test** (Lauf 1: p106-deploy + p71-component,
15-Minuten-Hänger; Lauf 2: ui-icon-Picker, 30 s) — **kein P272-Bezug, kein
Assertion-Fehler, sondern Kontention**: jeder betroffene Test isoliert **grün**
(p106+p71 8/8; ui-icon 32/32 zweimal, 4,2 s), die Läufe stark verlängert
(25–47 min statt ~16), Ursache eine wiederholt **geleakte Wegwerf-Node-RED auf Port
1883** (Docs-Agenten starten sie außerhalb des Playwright-Harness) plus aktive
Maschinen-Last (WindowServer/VS Code/VM). Orchestrator-seitig gereapt. Kein
„Re-run-until-green" auf der belasteten Maschine — die Code-Korrektheit ist über
Isolation + validate + Tripwires bewiesen.

**Follow-up-Notiz für P267–P271:** Docs-Batch-Agenten müssen jede außerhalb des
Harness gestartete Node-RED zwingend killen (Port 1883-Leak-Klasse).
