# ADR 0042: user-docs architecture — `docs/guide/` tree + Node-RED i18n help, English first, German translation

- Status: accepted
- Date: 2026-07-22
- Resolves: **P121** (user-docs concept, deferred since P121 was opened — the
  "Ort + Form" decision is now made by the owner). Builds on the conformance
  program's per-node truth (fields, input behaviour, observable effects — all
  audited P230–P258) and [ADR 0040](0040-retire-ui-navigation-node-navigate-is-a-ui-action.md)
  (one navigation concept → simpler docs).
- Owner decision (2026-07-22): user docs for **every node** (purpose, all fields
  with variants, 1–3 importable examples), a **high-quality HTML-help summary**
  per node (key functions, fields, **especially input behaviour**, link to full
  doc), plus **Introduction, Getting Started, and guides for the big topics** —
  written **English-first via the Node-RED i18n mechanism, then translated to
  German**; living in **`docs/guide/` in the repo**.

## Context

The repo has excellent **contract docs** (`docs/nodes/**` — German,
requirement-level, guardrail-checked by `check:specs`) but no **user docs**: no
introduction, no getting started, no task-oriented guides, and inline help of
mixed quality **and mixed language** (ui-skeleton/ui-log German, ui-store-action
English). All 44 nodes are registered individually in `package.json`
`node-red.nodes` (`nodes/<cat>/<node>.js`), so Node-RED's standard per-node
locale mechanism (`nodes/<cat>/locales/<lang>/<node>.html` for help,
`…/<node>.json` for editor strings) applies cleanly; no `locales/` exist yet.

## Decision

### 1. Two documentation layers, distinct genres

- **`docs/nodes/**` stays the internal contract** (German, detail-bar,
  `check:specs`-guarded, written for implementers/agents). Unchanged.
- **`docs/guide/**` is the user documentation** (task-oriented, example-driven):
  `introduction.md`, `getting-started.md`, `guides/*.md` (big topics),
  `nodes/<node>.md` (user reference per node). **English is canonical**;
  `docs/guide/de/**` mirrors the tree as the German translation.

### 2. Per-node user reference — the owner's three deliverables

Every registered node gets:
1. **`docs/guide/nodes/<node>.md`** — purpose, **all fields with their variants**
   explained at user level (what to pick when, not schema notation),
2. **1–3 examples** that can be transferred to Node-RED: importable flow JSON
   (kept as files under `examples/guide/`, embedded/linked from the doc with
   import instructions), each **smoke-verified** (deploys + renders),
3. **HTML help via Node-RED i18n**: `nodes/<cat>/locales/en-US/<node>.html` +
   `locales/de/<node>.html` replace the inline `data-help-name` block — a *very
   good summary*: purpose, key functions, fields, **explicit input behaviour**
   (`msg.payload` / `msg.ui.patch` / `msg.ui.component.op` / pass-through — the
   truth the conformance program established per node), outputs/events, and the
   link to the full guide doc.

### 3. English first, German translation, one mechanism

Help lives in the Node-RED locale mechanism (editor language selects it);
guides live as md twins (`docs/guide/…` ↔ `docs/guide/de/…`). English is written
first and is the review target; German is a translation pass in the same
package (never a separate drift-prone effort). **Editor form labels**
(`data-i18n` on rows) are explicitly **out of scope** for 1.0 — help + guides
only; label i18n is a possible later package.

### 4. Guardrails extend to user docs

`check:help` is extended to the locale files (every node has en-US + de help;
both link to its guide doc); a light `check:guide` verifies every registered
node has an EN + DE guide doc and ≥1 example; the example smoke test proves
every `examples/guide/**.json` deploys cleanly. `check:links` already covers
`docs/guide/`.

### 5. Sources of truth

Guide content derives from the contract docs and the conformance results —
the field tables in `docs/nodes/**` are `check:specs`-verified against the real
editors; the input-behaviour statements were measured in P230–P258. User docs
must never contradict them.

## Consequences

- **P121 is resolved** by this ADR + packages P265–P271 (framework/pilot,
  intro+guides, five node batches).
- The **mixed-language inline helps disappear** — help moves to locales;
  the pilot (P265) proves the exact mechanics before the batches roll.
- **Two docs per node** (contract + guide) is deliberate: different audiences,
  different genres. Drift is bounded by the guardrails and by deriving guide
  facts from checked contracts.
- The old P121 concern ("two ways: wire vs reference") becomes one of the
  guides (Actions & Events) instead of a standalone concept.
- German translation doubles the text volume; batches include it by design so
  EN/DE never diverge in coverage.
- flows.nodered.org/npm presentation improves (English help + real docs) —
  feeds the 1.0 release package (README links `docs/guide/`).
