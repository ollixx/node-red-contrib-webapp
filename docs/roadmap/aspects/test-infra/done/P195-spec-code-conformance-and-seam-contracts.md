---
id: P195
title: "Spec↔Code-Konformitäts-Check (Feldtabelle vs. Schema/Node-Defaults, fängt Doc-Drift automatisch) + Naht-Verträge als first-class Doc/Properties"
epic: aspects/test-infra
findings:
  - "Owner (2026-06-19): 'sind die verträge der knoten eigentlich klar definiert? Über die Felder etc. Sind die docs so ausreichend?' Befund: Format gut (Feld-Tabellen, Detail-Bar), aber wiederholte Drift (ui-list/ui-text diese Session) und die NAHT-Verträge (Scope/Mount/Re-Id/Layout) sind nirgends als Vertrag dokumentiert."
acceptance:
  - "Ein automatischer Check (Tripwire `pnpm check:specs` ODER ein Unit-Test) prüft je ui-*-Knoten: JEDES Feld in seinem Schema/Node-Defaults ist in der Spec-Feldtabelle namentlich erwähnt, und JEDES in der Spec genannte Feld existiert im Code (kein Phantom-Feld) — bidirektional, mit kuratierter Allowlist für bewusste Auslassungen (Layout-/Placement-Boilerplate)."
  - "Der Check liefert bei Drift eine sprechende Meldung (Knoten + fehlendes/überzähliges Feld) und failt; läuft in CI (Teil von `pnpm validate` oder daneben)."
  - "Naht-Verträge first-class: ein Querschnitts-Dokument (z. B. docs/nodes/concepts/composition.md) hält die Container-Invarianten fest (Scope propagiert durch jeden Kind-tragenden Knoten, Mount löst eindeutig auf, Per-Instanz-Re-Id eindeutig, Slot-Layout gilt), verweist auf ADR 0024 + die ausführbaren Properties (P194) und ist aus den Container-Specs verlinkt."
  - "Beweis: ein bewusst eingebautes Drift-Beispiel (Feld im Schema, nicht in der Doc) macht den Check rot."
verify: unit
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P195 — Spec↔Code-Konformität + Naht-Verträge

> Q1 des Owners: sind die Verträge klar/ausreichend? Antwort: Format ja, aber die
> Konsistenz driftet (mehrfach erlebt) und die **Naht-Verträge** fehlen als Doku.
> Dieses Paket macht **Drift automatisch sichtbar** und hebt die Naht-Verträge auf
> first-class.

## Umfang

1. **Konformitäts-Check (das Kernstück):** ein read-only Tripwire/Test, der je
   Knoten die in der Spec genannten Felder (Code-Spans \`feld\` in der „Felder"-
   Sektion) gegen die **tatsächlichen** Felder abgleicht — Quelle: die `defaults`-
   Keys im Node-`.html` und/oder das Zod-Schema. Bidirektional (fehlend +
   überzählig), mit **Allowlist** für absichtlich nicht dokumentierte Boilerplate
   (order/row/col/layoutX/… aus dem Layout-Helfer). Sprechende Fehlermeldung.
2. **Naht-Verträge dokumentieren:** ein `composition`-Konzeptdoc mit den
   Container-Invarianten (Scope/Mount/Re-Id/Layout), parametrisiert gedacht über
   die Container-Arten; Verweis auf ADR 0024 + die Properties aus **P194**; aus den
   Container-Specs (ui-container/ui-repeat/ui-tabs/ui-accordion) verlinkt.
3. **Verdrahtung:** den Check in `pnpm validate` (oder als eigenes `check:specs`)
   einhängen; in `.ai/agents/node-testing.md` als Pflicht-Tripwire notieren.

## acceptance / verify

- `verify: unit` — der Check ist selbst getestet (ein Drift-Fixture failt, ein
  konformer Knoten passt); CI-grün auf dem aktuellen Stand (oder die gefundene
  Drift wird vorab gefixt — dann als Findings an die jeweiligen Node-Pakete).

## Risiken / Hinweise

- **Pragmatisch parsen:** nur die `\`feld\``-Code-Spans der „Felder"-Sektion gegen
  die `defaults`-Keys — keine volle Markdown-Tabellen-Semantik nötig. Robuster als
  Prosa-Parsing.
- **Allowlist klein halten:** je mehr Ausnahmen, desto schwächer der Check; lieber
  die Boilerplate zentral als „dokumentiert in layout.md" markieren.
- **Findings-Welle möglich:** der erste Lauf deckt vermutlich Bestands-Drift auf →
  als kurze Fix-Liste an die betroffenen Node-Epics, nicht hier alles miterledigen.
- Ergänzt — ersetzt nicht — die ausführbaren Verträge aus ADR 0024/P194 (Verhalten)
  und das Zod-Schema (Datenform).

## Result

- **delivered:** (1) **Spec↔Code conformance tripwire** — `scripts/check-specs.js` (`pnpm check:specs`,
  wired into `pnpm validate`) + a vitest unit `scripts/check-specs.test.ts` (6 tests incl. a deliberate-
  drift fixture proving it goes red). Per `ui-*` node it parses the editor `defaults` keys from
  `<node>.html` and checks **bidirectionally** against the spec's canonical field-table: every defaults
  key is named in the spec, and every spec field exists in code (no phantoms). Header-gated parsing
  ignores sub-tables (item schemas, enum/`Wert` tables), struck-through removed-field rows, and
  binding-carrier twins. Result on develop: **39 nodes checked, 3 allowlisted, GREEN.** (2) **Seam-
  contracts doc** — new `docs/nodes/concepts/composition.md` capturing the four container invariants
  (scope propagation through every child-bearing node, unique mount, unique per-instance re-id, slot-
  layout), linked to ADR 0024 + the P194 executable properties, and linked FROM ui-container/ui-tabs/
  ui-accordion specs + the concepts index (deliberately NOT from ui-repeat.md — owned by concurrent
  P190/P191/P193).
- **drift caught & fixed (first run ~80 issues → reconciled):** real doc-drift corrected in specs —
  `layout`→`layoutId` (ui-container/ui-dialog/ui-route), `variant`("Orientation")→`orientation`
  (ui-stepper), `activeItem`→`activeRoute` (ui-menu), and added missing `size` (ui-input/select/
  textarea) + `events` (ui-tabs) rows. The remainder went into a **curated allowlist** with one-line
  reasons: category rules (layout/placement boilerplate, `parent`/`uiId`/`outputs` plumbing, typedInput
  carrier suffixes only when their base key is real), node-level (`ui-repeat` "reconcile after P190/
  P191/P193", the two ui-component stub docs), and 8 spec-ahead/planned fields.
- **stats:** 16 files (2 new scripts, composition.md, 11 spec/doc edits, package.json, node-testing.md);
  +6 unit tests; +1 friction-log line. Develop verification: build exit 0; `pnpm check:specs` green
  (39/3 allowlisted); check:links (106 md) + check:roadmap green; full unit suite green; `pnpm validate`
  (now incl. check:specs) GREEN. verify: unit (the check IS the verification).
- **notes:** Lane-safe — no ui-repeat.md/.html, webapp.js, editor-common.js, packages/** source, or
  docs/roadmap/** touched. **Follow-up:** once P190/P191/P193 land, remove `ui-repeat` from the
  check:specs allowlist and make its spec field-table conformant (the allowlist comment flags this).
  Spec docs are forward-looking requirement docs, so the phantom-direction is allowlisted for planned
  fields while the undocumented-code-field direction stays strict.
- **cost:** session agent-a60a401b60de86b85, ~25m.
