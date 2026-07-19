# ADR 0040: retire the `ui-navigation` node — navigation is solely a `ui-action` of type `navigate`

- Status: accepted
- Date: 2026-07-17
- Supersedes: the deprecation-alias framing of `ui-navigation` in
  `docs/nodes/behavior/ui-navigation.md` (which kept the node "for
  back-compat"). Amends **P119 / [ADR 0011 §5](0011-ui-action-navigation-target-modes-and-dual-path-coding.md)** — P119
  gave the `ui-navigation` editor the full `wire`/`route`/`url` switcher + typed
  `params`, but the runtime never honored them (see Context). This ADR resolves
  the open question the ui-navigation spec itself raised (*"ob `ui-navigation`
  ganz in `ui-action` aufgeht"*): it does.
- Builds on: [ADR 0007](0007-action-message-and-per-node-interaction-handlers.md)
  (navigate is a public action message), [ADR 0011](0011-ui-action-navigation-target-modes-and-dual-path-coding.md)
  (the three navigate target modes on `ui-action`).
- Audit source: the `ui-navigation` conformance audit (2026-07-17).

## Context

`ui-navigation` has been a **deprecated alias** for `ui-action` of type
`navigate`. The conformance audit found the alias is not merely redundant — it is
a **trap**:

- **The runtime deliberately discards everything but `to`.** The P118 node-set
  transform (`packages/runtime/src/node-set.ts`) rewrites every `ui-navigation`
  into a `ui-action` navigate and hard-forces `targetMode: "url"`,
  `routeId: undefined`, `target: undefined`, `params: undefined` — only `to`
  survives. `mapConfig` (`nodes/webapp.js`) likewise carries only `parent` + `to`.
  The schema (`uiNavigationNodeDefinitionSchema`) validates only `parent` + `to`.
- **But P119 gave the editor the full switcher.** The `ui-navigation` editor
  offers `wire`/`route`/`url` **and** typed `params`, with a **validator**
  (`validateNavigateConfig`) that back-stops route mode ("needs a resolvable
  `routeId` + every `:placeholder` filled"). An author picks route mode, sets a
  `routeId`, gets a **green validated node**, deploys — and navigation **silently
  does nothing**, because the runtime drops `routeId` and there is no `to`.
- **No test guards it.** The node's only direct E2E is a forbidden
  no-crash test (*"deploying a ui-navigation node alone does not break the page
  render"*, which P233 should have removed). The `p66-navigation` and
  `ui-navigation` specs exercise the navigate **message contract** (via `inject`)
  and `ui-action`/`ui-button` — **not** the `ui-navigation` node. The `routeId`
  drop is entirely uncaught.

The owner's decision (2026-07-17): **retire the node.** Navigation is a special
case of an action, fully served by `ui-action` navigate; a second, half-wired
node is a liability, not a convenience.

## Decision

### 1. `ui-navigation` is removed as a node type

`ui-action` with `actionType: "navigate"` is the **sole** navigation node. Its
three target modes (`wire`/`route`/`url`, ADR 0011) and typed `params` are the
canonical, fully-wired model. There is no separate navigation node.

### 2. Removal is behaviour-preserving for the only mode that worked

The runtime already collapses `ui-navigation` → `ui-action` navigate in `url`
mode (node-set.ts). Every **functioning** `ui-navigation` in existence is a
`url`-mode node carrying `to` (route/wire/params never reached the runtime). Its
exact equivalent is a `ui-action` with `actionType:"navigate"`, `targetMode:"url"`,
the same `to`, same `parent`. Migrating such a node changes **nothing**
observable.

### 3. Migration

- **Repo-owned flows are regenerated to `ui-action` navigate.** The generators are
  the source of truth (`examples/**` is generated, never hand-edited):
  - `scripts/gen-example.js` (the `navToCustomers` node, currently
    `node("ui-navigation", …)`) emits a `ui-action` navigate (`url`, `to:"/customers"`)
    instead; `examples/customers-crud/flow.json` is regenerated via `pnpm gen:example`.
  - `scripts/gen-node-examples.js` stops emitting `examples/behavior/ui-navigation.json`
    once the node leaves the registered set; the stale file is deleted.
- **External flows: documented, mechanical breaking change.** A deployed
  `type:"ui-navigation"` node becomes an unknown type after removal. The migration
  is purely mechanical and is documented in the changelog / a migration note:
  replace `type:"ui-navigation"` with `type:"ui-action"`, add
  `actionType:"navigate"` + `targetMode:"url"`, keep `to`/`parent`/`name`. This is
  acceptable as a hard change because the package is pre-1.0 (`0.0.0`), the node
  was always a documented deprecated alias, and only its `url`/`to` behaviour ever
  worked. **No runtime shim** is kept (a shim would mean keeping the node
  registered, contradicting "remove").

### 4. What is deleted

Node registration (`nodes/webapp.js` node list + `mapConfig`), the node-set
special-case (`node-set.ts` — the `ui-navigation` branch of the navigate map
collapses to `ui-action`-only), the schema (`uiNavigationNodeDefinitionSchema` +
its union member + type export), the editor definition
(`packages/editor/src/nodes.ts`), `nodes/behavior/ui-navigation.{js,html}`, the
spec (`docs/nodes/behavior/ui-navigation.md`), the node's tests
(`tests/e2e/nodes/behavior/ui-navigation.spec.ts` + `.tests.md`), and both
generated examples. The `p66-navigation` spec **stays** (it tests the navigate
message contract via `inject`, not the node).

## Consequences

- **The trap is gone.** No editor can offer a validated navigation mode the
  runtime silently ignores, because the node offering it no longer exists.
- **One navigation concept.** New and existing authors use `ui-action` navigate;
  the docs stop presenting two ways to do the same thing (relates to the deferred
  P121 "two ways" doc concept — one fewer axis of confusion).
- **First node retirement — this establishes the pattern.** Node removal +
  generator update + documented mechanical migration + keep-the-contract-test.
  Future retirements follow this shape.
- **Breaking for external flows using `ui-navigation`.** Mitigated by the
  mechanical migration note and pre-1.0 status. If, before 1.0, telemetry or an
  owner call later argues for a softer path, a **hidden auto-migrating shim**
  (register `ui-navigation`, rewrite to `ui-action` on load, no palette entry) is
  the reversible alternative — but is explicitly **not** done now.
- **`ui-action` is unaffected** — it already owns the full navigate model; nothing
  about it changes.
- **P119's editor work on `ui-navigation` is discarded** — acceptable: it wired an
  editor to a runtime that never honored it.
