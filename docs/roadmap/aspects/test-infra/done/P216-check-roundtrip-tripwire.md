---
id: P216
title: "Test-Infra: read-only tripwire `pnpm check:roundtrip` — every reference/picker/editableList node must have an editor open→save round-trip test (seeded allowlist keeps validate green)"
epic: aspects/test-infra
status: done
dependencies: [P215]
verify: unit
spec: .ai/agents/node-testing.md
tests: scripts/check-roundtrip.test.ts
---
# P216 — `pnpm check:roundtrip` tripwire

> Rationale: [ADR 0031](../../../../adr/0031-editor-open-save-round-trip-test-standard.md)
> — makes the open→save round-trip standard **enforced**, not aspirational.
> Depends on P215 (the harness + standard must exist first).

## findings

From ADR 0031 and session memory `state-node-family-and-editor-save-bug-class`:

- The clobber bug class recurs because **nothing fails** when a node ships a
  reference/picker/editableList field without an editor round-trip test. The
  standard (P215) is only as strong as its enforcement.
- The repo's established enforcement idiom is a read-only tripwire with a small
  curated allowlist: `scripts/check-specs.js` (`pnpm check:specs`), unit-tested by
  `scripts/check-specs.test.ts`, wired into `pnpm validate`. Mirror that shape.
- Enumeration nuance (verified 2026-07-13): ~39 nodes call
  `installReferenceSelectors`, but most of those calls are only the ubiquitous
  `parent`/`mount` picker (already covered by `parent-selector.spec.ts` /
  `editor-mount-options.spec.ts`). The tripwire must target the **additional**
  value-carrying carrier fields, not that baseline.

## acceptance

- **Script + wiring.** `scripts/check-roundtrip.js` exists; `package.json` gains a
  `check:roundtrip` script and `pnpm validate` runs it (in the tripwire group,
  before `lint`). It is **read-only** (writes nothing; exits non-zero on failure
  with a per-node message).
- **Enumeration (qualifying nodes).** The script parses each `nodes/**/*.html` and
  collects nodes that declare a qualifying **hidden-carrier** field:
  (a) an `installReferenceSelectors` reference/picker field whose carrier id is
  **not** `parent`/`mount` (e.g. `store`, `query`), or (b) an `editableList`
  field. The detection rule and the parent/mount exclusion are documented in a
  header comment and covered by the unit test.
- **Coverage requirement.** For each qualifying node the script requires a
  registered editor open→save round-trip test — detected by a marker in the
  node's `tests/e2e/nodes/**/<node>.tests.md` catalogue (e.g. a
  `Round-trip:`/`open→save` entry naming the field) OR a spec matching a
  documented naming convention. A qualifying node with no such registration
  **fails** the tripwire, naming the node and the uncovered field(s).
- **Seeded allowlist keeps validate green.** A small curated allowlist in
  `scripts/check-roundtrip.js` lists the currently-unconverted qualifying nodes,
  each with a one-line reason, so `pnpm validate` is **green on landing** despite
  the backlog. Nodes already covered by P215 (`ui-store-action`,
  `ui-component-instance`) are **not** in the allowlist. Adding a new qualifying
  node without a round-trip test and without an allowlist entry makes the tripwire
  red.
- **Unit test.** `scripts/check-roundtrip.test.ts` exercises: a qualifying node
  with a registered round-trip test → pass; a qualifying node with neither test
  nor allowlist entry → fail; a `parent`/`mount`-only node → not flagged; an
  allowlisted node → pass (allowlist honoured). Runs under `pnpm test`.
- **Docs.** `.ai/agents/node-testing.md` references `pnpm check:roundtrip` as the
  enforcement of the P215 standard (one line, next to the `check:specs` mention).

## verify

`unit` — the tripwire is a Node script proven by `scripts/check-roundtrip.test.ts`
(pass/fail/exclusion/allowlist cases) plus a clean `pnpm validate` run on landing.

## spec

`.ai/agents/node-testing.md` (references the tripwire); the tripwire's own
contract lives in `scripts/check-roundtrip.js` header + its unit test.

## tests

`scripts/check-roundtrip.test.ts` — the tripwire's unit test (pass / fail /
parent-mount-exclusion / allowlist-honoured cases).

## notes for the implementer

- Model the script and its test on `scripts/check-specs.js` +
  `scripts/check-specs.test.ts` (curated-allowlist idiom, one-line reason per
  entry, "every entry weakens the check").
- Seed the allowlist from the actual qualifying set discovered by the
  enumeration minus the P215-covered nodes; the exact list is produced by running
  the enumeration — do not guess it. P217 drives this allowlist to empty.

## Result

**Delivered.** Read-only Tripwire `pnpm check:roundtrip` (ADR 0031-Enforcement), Muster von `check:specs`. Kein `ui-*`-Laufzeitverhalten geändert.
- `scripts/check-roundtrip.js` (neu): schreibt nichts, `process.exit(1)` mit per-Knoten-Meldung bei Lücke; Header dokumentiert Detektion + parent/mount-Ausschluss. Enumeration je registriertem `nodes/**`-HTML: (a) balancierter Parse von `installReferenceSelectors({…})` — jeder Config-Key außer `parent`/`mount`, aufgelöst auf `#node-input-<field>`-Carrier, nur wenn echter `defaults`-Key; (b) `#node-input-<field>-list .editableList(` → Carrier `<field>`. Coverage per Marker in `<node>.tests.md` (`/round.?trip|open→save|open→Done/i` + Feld im Code-Span; passt zum P215-Katalogformat).
- `scripts/check-roundtrip.test.ts` (neu, 9 Tests, pure `analyzeNodes`-Naht): qualifiziert+Test → pass; qualifiziert+weder-noch → fail (nennt Knoten+Feld); parent/mount-only → nicht geflaggt; allowlisted → pass; + Enumeration/editableList/Marker-Asserts.
- `package.json`: `check:roundtrip`-Script; in `validate` **vor `lint`** verdrahtet; `test:specs` läuft beide Scripts-Tests.
- `.ai/agents/node-testing.md`: eine Zeile verweist auf `check:roundtrip` als Enforcement neben `check:specs`.

**Seeded Allowlist (Ist-Enumeration minus P215-abgedeckte `ui-store-action.store`/`ui-component-instance.props`)** — die exakte Liste, die **P217 auf leer treibt** (5 Felder / 4 Knoten):
`ui-query.params` · `ui-query.refreshAction` · `ui-query-action.query` · `ui-store-read.store` · `ui-dialog.routeId`.
(`ui-dialog.routeId` aus `installReferenceSelectors({route:true})` — Nicht-parent/mount-Picker, qualifiziert daher; hat noch keinen `.tests.md`-Katalog → vorerst allowlisted.)

**Verify (unit + validate).** `pnpm check:roundtrip` grün (`6 Knoten / 7 qualifizierende Felder geprüft, 5 allowlisted`; die 2 P215-abgedeckten NICHT allowlisted). `pnpm test:specs` (9 neue), `pnpm build`/`lint`/`check:specs`/`check:links`/`check:roadmap` und `pnpm validate` end-to-end grün (Exit 0).

**Cost.** Sub-Agent `phase/P216` (worktree), ~11 min (15:24:33Z→15:35:27Z); Token-Zeile in `.ai/agent-runs.jsonl`.
