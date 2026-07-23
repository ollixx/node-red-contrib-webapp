---
id: P265
title: "User-Docs-Fundament (ADR 0042): docs/guide/-Skelett + Templates, Node-RED-i18n-Hilfe-Mechanik am Piloten bewiesen (en-US+de locales), Beispiel-Smoke-Harness, Guardrails check:help-erweitert + check:guide"
epic: aspects/docs
status: done
dependencies: []
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
---
# P265 — User-Docs-Fundament + i18n-Pilot

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Erster Zug des Doku-Programms: Struktur, Templates, die **bewiesene**
> i18n-Mechanik und die Guardrails — damit die fünf Node-Batches (P267–P271)
> mechanisch durchlaufen können. **Pilot-Knoten: `ui-divider`** (der bewährte
> Kalibrier-Knoten des Konformitäts-Programms, P230).

## findings

- Keine Nutzer-Doku (kein Intro/Getting-Started/Guides); Inline-Hilfen gemischt
  deutsch/englisch; keine `locales/` im Repo.
- Alle 44 Knoten einzeln in `package.json` `node-red.nodes` registriert
  (`nodes/<cat>/<node>.js`) ⇒ Node-REDs per-Node-locale-Mechanik
  (`nodes/<cat>/locales/<lang>/<node>.html`) ist anwendbar — **aber im Repo nie
  benutzt**; die exakte Mechanik (Datei-Lage, Fallback en-US↔de, Zusammenspiel
  mit vorhandenem inline `data-help-name`) ist am Piloten zu beweisen.
- `pnpm gen:node-examples` erzeugt bereits 1 Import-Beispiel je Knoten
  (`examples/<cat>/<node>.json`) — Basis für die Guide-Beispiele.
- `check:help` prüft heute Inline-Hilfen (+ Doku-Link); `check:links` prüft
  `docs/**`-Links.

## acceptance

- **`docs/guide/`-Skelett** (EN kanonisch + `de/`-Spiegel): `README.md`
  (Einstieg/Inhaltsverzeichnis), leere-aber-verlinkte Platzhalter NUR wo nötig —
  keine Stub-Flut; `introduction.md`/`getting-started.md` kommen mit P266.
- **Drei Templates** (im Guide-README oder `docs/guide/_templates/`, EN+DE):
  1. **Node-Referenz-Template** — Struktur: Purpose · When to use · Fields (alle,
     mit Varianten, user-level) · Inputs (msg-Verhalten!) · Outputs/Events ·
     Examples (1–3, Import-Anleitung) · Related.
  2. **Guide-Template** (Thema, Ziel, Schritt-für-Schritt, Beispiel-Flow).
  3. **Hilfe-Template (locales-HTML)** — Purpose (1–2 Sätze) · Key fields ·
     **Inputs-Abschnitt (Pflicht!)** · Outputs/Events · „Full docs"-Link auf den
     Guide-Doc. Länge gedeckelt (Hilfe = Zusammenfassung, kein Duplikat).
- **i18n-Mechanik am Piloten `ui-divider` bewiesen (Browser, gemessen):**
  `nodes/view/locales/en-US/ui-divider.html` + `locales/de/ui-divider.html`
  existieren nach den Templates; der Inline-`data-help-name`-Block ist entfernt;
  im Editor zeigt die Hilfe **englisch bei en-US** und **deutsch bei de**
  (Editor-Sprache umgeschaltet, per E2E/Editor-Test gemessen); der Doku-Link
  führt auf `docs/guide/nodes/ui-divider.md`. Die exakte Mechanik (Pfade,
  Fallback-Verhalten) ist im Guide-README als **verbindliche Anleitung für die
  Batches** dokumentiert.
- **Pilot-Guide-Doc** `docs/guide/nodes/ui-divider.md` (EN) + `de/`-Spiegel nach
  Template, inkl. **1 Import-Beispiel** (aus `examples/`/neu unter
  `examples/guide/`) mit Import-Anleitung.
- **Beispiel-Smoke-Harness:** ein Test, der **jedes** `examples/guide/**.json`
  deployt und den App-Render prüft (Muster `deployFlow` + Root-Content) — läuft
  für den Piloten; die Batches füllen ihn.
- **Guardrails:**
  - `check:help` erweitert: für jeden registrierten Knoten existieren en-US-
    **und** de-Hilfe (locales ODER übergangsweise inline — Übergangsmodus, bis
    die Batches durch sind, mit schrumpfender Restliste wie bewährt), beide mit
    Guide-Link.
  - **`check:guide` (neu, read-only, pure+unit-getestet):** jeder registrierte
    Knoten hat `docs/guide/nodes/<node>.md` + `de/`-Pendant + ≥1 Beispiel —
    mit Allowlist, die die Batches auf **leer** treiben.
- `check:links`/`check:roadmap` + `pnpm validate` grün.

## verify

`browser` — die Pilot-Hilfe in beiden Sprachen im echten Editor gemessen
(Sprachumschaltung), Beispiel-Import deployt + rendert; Guardrails grün
(Allowlist = alle Knoten außer Pilot).

## spec

`docs/guide/README.md` (neu — trägt Struktur, Templates-Verweis, i18n-Anleitung).

## tests

Editor-E2E für die Locale-Hilfe des Piloten; `check:guide`-Unit; Smoke-Harness.

## notes for the implementer

- **Erst die Mechanik beweisen, dann dokumentieren** — falls Node-RED die
  locales-Hilfe anders auflöst als erwartet (z. B. Registrierungs-Eigenheiten
  durch das webapp.js-Zentral-Setup), gehört die REALE Mechanik in die Anleitung;
  nicht raten (Inert-Versprechen-Regel des Konformitäts-Programms).
- Editor-Label-i18n (`data-i18n` auf Formzeilen) ist **explizit NICHT Scope**
  (ADR 0042 §3).
- Deutsch ist Übersetzung im selben Paket — nie EN ohne DE mergen (Drift-Regel).

## Result

**Done 2026-07-23.** Das Fundament steht und die i18n-Mechanik ist **bewiesen,
nicht angenommen** — die fünf Batches (P267–P271) können mechanisch durchlaufen.

### Die BEWIESENE Mechanik (gemessen gegen node-red 4.0.5, im Guide-README als verbindliche Batch-Anleitung)

- Hilfe-Dateien: `nodes/<cat>/locales/<lang>/<node>.html`, neben dem registrierten
  `.js` (`@node-red/registry` loadNodeHelp: `path.dirname(node.template) +
  /locales/<lang>/<basename>`).
- Der Editor lädt `GET /nodes` mit `Accept-Language:
  localStorage["editor-language"] || Browser-Sprache` — die Editor-Spracheinstellung
  (User Settings → View → Language) treibt die Locale-Hilfe.
- Fallback-Kette: exakte Sprache (`de-DE`) → Präfix (`de`) → `i18n.defaultLang`
  (`en-US`).
- Der Inline-`data-help-name`-Block ist beim Piloten ENTFERNT; die Sidebar-Hilfe
  kommt ausschließlich aus den Locale-Dateien.

**Gemessen (6 E2E, `help-i18n-locales.spec.ts`):** EN unter Default + explizitem
en-US; DE unter `de` UND `de-DE` (Präfix-Fallback); `fr` → en-US-Fallback;
Doku-Link führt auf `docs/guide/nodes/ui-divider.md`.

### Die 8 Einheiten (je sofort committet)

`3d7c914` Mechanik-Beweis · `ee8d0ce` Guide-Skelett (EN-README mit TOC + Anleitung,
de/-Spiegel) · `41a38b2` drei Autoren-Templates (Node-Referenz / Themen-Guide /
Hilfe-HTML mit Pflicht-Inputs-Abschnitt + Längendeckel; EN+DE je Datei) ·
`396a853` Pilot-Guide-Doc ui-divider (EN+de) + hand-autoriertes Import-Beispiel
`examples/guide/ui-divider.json` · `9dafdaa` Smoke-Harness (deployt jedes
`examples/guide/**.json`, prüft gerenderten Root-Content je ui-app) · `236ad9c`
Guardrails: `check:help` erweitert (L0–L6, TRANSITION_INLINE-Restliste) + NEUES
`check:guide` (EN+DE-Guide-Doc + auflösbares Beispiel je Knoten, Allowlist = alle
außer Pilot; pure + unit-getestet) — beide in validate/test:specs verdrahtet ·
`a6984cb` check:links-Politur · `3963809` ui-select-Poll-Fix (s. u.).

### Verifikation

**Voll-Suite (Worktree-Gate): 898 passed / 1 failed** — die eine Rote war
`ui-select.spec.ts:106` (initial value 'de'): **kein P265-Bezug** (das 'de' war
Zufall — Select-Optionswert, nicht Locale), sondern eine vorbestehende Test-Race:
one-shot `el.value`-Read vor der Shoelace-Upgrade-Initialisierung. Diagnostiziert
(isoliert 18/18 grün, 190-ms-Sofort-Mismatch), per `expect.poll` gefixt (gleiche
Fix-Klasse wie E01: nie framework-initialisierten Zustand one-shot lesen).
**Orchestrator-Merge-Gate:** Build grün; `check:guide` „1 abgedeckt, 43 auf der
schrumpfenden Allowlist"; `check:help` „1 locale-migriert, 43 transitional inline";
`check:links` 135 md; P265-Specs im Haupt-Checkout **31 passed, `--retries=0`**.
Deutsch nie ohne Englisch im selben Commit (Drift-Regel eingehalten).
