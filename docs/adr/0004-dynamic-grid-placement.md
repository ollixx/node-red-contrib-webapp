# ADR 0004: Dynamic values for grid placement

- Status: accepted
- Date: 2026-06-06
- Scope: the grid-child placement props `row` / `col` / `colSize` / `rowSize`
  (and, by extension, the absolute-layout `layoutX` / `layoutY`). Decides whether
  these structural fields may change at **runtime**, and if so by which mechanism.
  Builds on the firm positive-integer validation from P51 and the input-patch
  path from P39.

## Context

P51 made the grid-child placement props strict positive integers (>= 1) **in the
schema** (`gridChildPropsSchema` in `packages/schema/src/node-definitions.ts`):
grid positions and spans are 1-based, so `0`, negatives, and fractions are
rejected at deploy time. The schema is the only place that validation lived.

The P52 roadmap entry posed the open design question: should placement become
**dynamic** — reconfigurable after deploy — and if so via which of two candidate
capabilities?

- **A) Update via input message.** Let a flow change placement at runtime through
  the node's input port, building on P39's `msg.payload` / `msg.ui.patch`
  mechanism.
- **B) typedInput bindings.** Let the editor bind these fields to `msg` / `flow` /
  `global` values (binding kinds beyond the current `literal` / `state` / `query`
  / `routeParam`), resolved at render time.

Two facts about the existing code shaped the decision (both verified during P52,
not assumed):

1. **The binding *kinds* for B already exist.** `bindingSchema` /
   `DYNAMIC_BINDING_KINDS` in `packages/schema/src/contracts.ts` already enumerate
   `state, query, routeParam, literal, msg, flow, global, jsonata, env`. What does
   *not* exist is placement props being `bindingSchema` — `row` / `col` /
   `colSize` / `rowSize` are plain `z.number()`, and the serializer that turns
   them into CSS (`wrapRenderedComponentHtml` in `nodes/webapp.js`, mirrored in
   `resources/lib/webapp-serializer.js`) reads raw numbers in a synchronous
   HTML-string pass that has **no binding-source context** (no `msg` / `flow` /
   `global` at that layer). Making placement a binding would mean: convert four
   props on ~28 node types to `bindingSchema`, add typedInput UI for each, thread
   a resolution context into the serializer, and re-validate the *resolved* value.

2. **Path A is ~90% already wired — but broken in two specific ways.** P39's
   `viewNodePatchInputHandler` (`nodes/webapp.js`) already applies
   `msg.ui.patch` as arbitrary field overrides onto the live
   `registration.definition` and pushes a snapshot. So a flow can *today* send
   `{ ui: { patch: { col: 2 } } }`. But:
   - **No validation on the patch path.** `msg.ui.patch` is `Object.assign`-ed in
     raw. A patch of `{ col: 0 }`, `{ col: -3 }`, or `{ col: 1.5 }` bypasses P51
     entirely and reaches the renderer. The P51 invariant holds at deploy time and
     is silently violated at runtime.
   - **Layout patches never re-place the element.** The snapshot is rebuilt by
     `pushSnapshotToClients(appId, …, readDeployDefinitions(RED))`, and
     `readDeployDefinitions` re-derives every definition from the **flow file**,
     merging back only `value` / `rows` / `items` from live state — *not* layout
     props. So a `patch` that sets `col` / `row` mutates in-memory state that the
     pushed snapshot then discards. The browser never reflows.

## Decision

**Implement A. Do not implement B now.**

1. **A — update via input message — is the chosen capability.** It matches how
   every other runtime mutation in this codebase already works (P39 patch +
   SSE snapshot push), it is the smaller and better-contained change, and it
   closes a real correctness gap rather than adding new surface area. Two fixes:

   a. **Validate placement on the patch path.** When `msg.ui.patch` (or a
      placement-bearing `msg.payload`) sets any of `row` / `col` / `colSize` /
      `rowSize`, the resolved value must be a **positive integer** — the exact
      P51 rule, now enforced at runtime too. An invalid placement value is
      **rejected**: the offending key is dropped from the patch (other keys in the
      same patch still apply), and the node raises a clear error via the existing
      structured error path (ADR 0006). `layoutX` / `layoutY` are **not** subject
      to this rule — `0` is the legitimate top-left origin for absolute layout.

   b. **Carry layout patches into the pushed snapshot.** `readDeployDefinitions`
      merges live placement props (`row` / `col` / `colSize` / `rowSize` /
      `layoutX` / `layoutY`) back onto the flow-file definition the same way it
      already merges `value` / `rows` / `items`, so the re-placement actually
      reaches the client and the element reflows.

2. **B — typedInput placement bindings — is deferred.** Layout is *structural*:
   binding placement to `msg` / `flow` / `global` is a broader concept than the
   current render-time bindings and forces binding-source context into the
   synchronous serializer pass that does not have it today. The incremental value
   over A is marginal — A already gives flows runtime control of placement — and
   the cost (four props × ~28 nodes + editor + serializer plumbing) is high. Not
   worth it now.

   **Follow-up trigger for B:** revisit only if a concrete app needs placement to
   track a `flow` / `global` value *without* a flow explicitly pushing a patch
   (i.e. declarative reactive layout), or if more than a couple of node types need
   per-render computed placement. Until then, A covers the need.

## Consequences

- The P51 positive-integer invariant now holds on **both** paths: deploy-time
  (schema) and runtime (the patch handler). This is the phase's hard invariant and
  is unit-tested.
- Flows can reconfigure grid placement live: send `{ ui: { patch: { col, row,
  colSize, rowSize } } }` to a view node's input and connected clients reflow.
- Invalid runtime placement is rejected with a clear node error, never silently
  applied — consistent with ADR 0006's error contract.
- No schema change, no new binding kinds, no editor change. The change is confined
  to the runtime patch handler and the deploy-definition merge in `nodes/webapp.js`.
- B remains available as a clean future extension; the binding kinds it needs
  already exist, so picking it up later is additive, not a rework of A.
