---
id: P266
title: "Introduction + Getting Started + die 8 Themen-Guides (EN + DE) — inkl. Import-Beispiel-Flows je Guide; absorbiert das alte P121-Thema „Wire vs. Referenz\""
epic: aspects/docs
status: pending
dependencies: [P265]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P266 — Introduction, Getting Started, Themen-Guides

> Rationale: **[ADR 0042](../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Nutzt Skelett + Templates + Smoke-Harness aus P265.

## findings

Es gibt keinerlei Einstiegs- oder Themen-Doku für Nutzer. Die großen Themen sind
in den Konzept-Contracts (`docs/nodes/concepts/*.md`) technisch beschrieben,
aber nicht nutzerorientiert erschlossen. Das alte P121 wollte „die zwei Wege"
(Wire vs. Referenz) dokumentieren — das wird hier der Actions-Guide.

## acceptance

Alle Dokumente **EN kanonisch + DE-Spiegel**, nach Guide-Template (P265), jeder
Guide mit **mindestens einem Import-Beispiel-Flow** (`examples/guide/…`, vom
Smoke-Harness verifiziert):

- **`introduction.md`** — was das Projekt ist (deklarative Web-Apps aus
  Node-RED-Flows), das Kern-Modell in einer Seite: Knoten beschreiben Struktur
  (`mount`/`app`, NIE Wires für Hierarchie), Wires tragen Daten/Events;
  Bindings; Server-Snapshot + SSE. Ein Architektur-Diagramm (Mermaid).
- **`getting-started.md`** — Install (npm/Palette), erste App in ≤10 Minuten:
  ui-app → ui-route → ui-text/ui-button → Deploy → App öffnen; komplett als
  Import-Flow beigelegt; Troubleshooting-Basics (Port, App-URL, „Unknown node
  type" → Restart-Hinweis).
- **8 Themen-Guides** (`docs/guide/guides/`):
  1. **Layout & Slots** — mount-Pfade, Presets (vertical/horizontal/grid/absolute/
     app/dialog), Platzierungsfelder.
  2. **Bindings & State** — die Binding-Arten nutzerorientiert (literal/state/
     store/query/routeParam/msg/flow/global/jsonata/env/**user**), Stores
     (Scopes, writeTo/writeTrigger), typische Muster.
  3. **Actions & Events** — Output-Events verdrahten; **die zwei Wege: Wire vs.
     Referenz** (ui-action/store-action/query-action `mode`); wann welcher.
     *(= Auflösung des alten P121-Kernthemas.)*
  4. **Navigation & Dialoge** — Routen, ui-action navigate (drei Modi), Dialog
     open/close, routeId-Scoping.
  5. **Daten anzeigen** — table/list/repeat/pagination-Muster, Query-Loop
     (refresh → Fetch → replace), Item-Field-Mapping.
  6. **Formulare** — Input-Familie, value/writeTo (bidirektional, ADR 0027),
     Validierungs-Verhalten.
  7. **Auth** — trusted-header-Betrieb (Proxy-Beispiel), `user`-Binding,
     `requiresGroup`-Guards; „visibleIf ist UX, Guard ist Sicherheit".
  8. **Theming & Komponenten** — Design-Tokens, variant/color-Modell (ADR 0039),
     ui-component-definition/-instance Wiederverwendung.
- **Verlinkung:** `docs/guide/README.md` als Inhaltsverzeichnis; README.md des
  Repos verlinkt auf den Guide; Guides verlinken auf die Node-Referenzen (die mit
  P267–P271 entstehen — Links dürfen dorthin zeigen, sobald der jeweilige Batch
  sie anlegt; bis dahin auf die Knoten-Liste im Guide-README).
- **Beispiele smoke-verifiziert**; `check:links` + `check:guide` (Allowlist
  unverändert — Node-Referenzen sind NICHT Scope dieses Pakets) + `pnpm validate`
  grün.

## verify

`browser` — der Getting-Started-Flow wird real importiert/deployt und die App
gerendert (Smoke-Harness); Stichproben-Guide-Beispiele ebenso.

## spec

`docs/guide/README.md` + die neuen Guide-Dateien selbst.

## tests

Smoke-Harness-Einträge je Beispiel-Flow.

## notes for the implementer

- Fachliche Wahrheit aus den Contract-Docs (`docs/nodes/concepts/*.md`) und den
  Konformitäts-Ergebnissen ziehen — NICHT neu erfinden; bei Widerspruch gewinnt
  der Contract (und der Widerspruch wird gemeldet).
- Auth-Guide: Enforcement-Matrix + Tier-0-Anleitung existieren in
  `docs/nodes/concepts/auth.md` (P260) — nutzerorientiert nacherzählen, verlinken.
- EN zuerst schreiben, DE im selben Paket übersetzen (ADR 0042 §3).
