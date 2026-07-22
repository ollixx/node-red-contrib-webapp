# ui-component — test catalogue

> **Stub — populated as the Components wave lands (P177→P178→P179).** Spec:
> `docs/nodes/structure/ui-component.md`; decision: ADR 0020.

## P177 — schema (unit) — `packages/schema/test/p177-component-schema.test.ts`
- **`ui-component-definition`**: validates off-canvas (no outer mount required); optional `name` (empty-string rejected); requires `id`; reachable via `validateUiNodeDefinition`; `COMPONENT_DEF_SLOT === "content"`.
- **`ui-component-instance`**: validates with outer `mount` + `definitionId` + `props`; `props` defaults to `{}`; `definitionId` required (empty-string rejected); outer `mount`/`app` required (leaf, mounted into a real region); props accept any binding kind; **negative:** a props value with an unknown binding kind is rejected; reachable via `validateUiNodeDefinition`.
- **`def:` mount scope**: `parseMountReference("def:<id>/content")` → scope `def`, target/regionPath split; round-trips parse → serialize → parse losslessly; region required after target; **negative:** an unknown scope (`widget:…`) is still rejected.
- **`prop` / `prop.<path>` binding form**: `SCOPE_LOCAL_BINDING_KINDS === ["item","index","prop"]`; bare `prop` and one-/multi-level `prop.<path>` accept; leading-/double-dot paths reject; round-trips; `item`/`index` behaviour unchanged; **negative:** unknown kind rejected.
- **`validateComponentAcyclic`**: acyclic definition→instance graph accepted; direct self-reference rejected (error mentions "self"); transitive A→B→A cycle rejected (error mentions "cycle"); transitive-but-acyclic A→B accepted; component-free node set accepted.
- **Fixtures**: `propBindingFixture` parses; `minimalComponentNodeSetFixture` validates every node, its definition child mounts into `def:greetingCard/content` binding `prop.title`, its instance supplies `props = { title: "A" }`, and the graph is acyclic.

## P178 — renderer (unit) — `packages/renderer/test/p178-component-expand-prop-scope.test.ts`
- **expand at the instance mount**: an instance with `props={title:"A"}` renders the `def:<id>/content` subtree into the instance's host region; a child bound to `prop.title` shows `"A"`; the clone carries the composed id `<instanceId>#<innerNodeId>` (`inst#greetingText`).
- **per-instance prop resolution**: two instances of the same definition with different props render different values (`Alpha`/`Beta`) and unique, stable ids (`a#greetingText`/`b#greetingText`).
- **prop path**: `prop.<path>` resolves a multi-level field of an object prop (`prop.user.name` → `"Ada"`); bare `prop` (path = prop name) yields the whole prop value; `prop` **outside** any instance → `undefined` (the binding's `fallback` applies, e.g. `"FALLBACK"`; with no fallback the node still renders, no crash).
- **definition never renders on its own**: a definition + children but **no** instance emits nothing into any real region.
- **nested**: an instance whose definition contains another instance expands both; each prop resolves against its own frame (inner instance's prop binds the outer frame's `prop.heading`); ids compose (`top#innerInst#innerLabel`).
- **self-guard (no hang)**: a definition that instantiates itself directly terminates (one level, then cut); a transitive A→B→A self-reference terminates (`["a","b"]`, then cut) — no infinite expansion.
- **reactive prop**: a prop bound to `state` re-resolves on the next render after `replaceState` (`"First"` → `"Second"`); a dangling `definitionId` renders nothing (no crash).

## P179 — node + editor + runtime bucketing (unit) — `packages/runtime/test/p179-component-node-render.test.ts`
- **registration**: `runtimeNodeRegistry` has `ui-component-definition` and `ui-component-instance`.
- **bucketing**: `getDefinitionBuckets` buckets the definition, its two `ui-text` children, and both instances into the app (children bucket by their real `.z` like any ui-node).
- **render**: a definition with two `ui-text` children (`prop.title`/`prop.body`) + two instances at different route mounts with different props render each instance's two lines with its own values; the other instance's values do not bleed across routes.
- **identity**: inner nodes are re-id'd `<instanceId>#<innerNodeId>` (`inst1#tTitle`, `inst2#tBody`); an inner `ui-button`'s rendered id IS its event sourceId (`c1#btn`).
- **off-canvas**: the definition never renders on its own (no `def:` leakage in the page body).
- **store-bound prop**: a prop bound to a store (`state` path) resolves the store value into the instance (`Hello-from-store`).
- **dangling**: a missing/unknown `definitionId` renders nothing for that instance (no crash, 200).

## P179 — editor (unit) — `packages/editor/test/p113-value-binding-types.test.ts`
- the canonical value-binding type set gains a scope-local **`prop`** kind at the tail (after `item`/`index`); `prop` is NOT offered in the boolean/url categories.

## P179 — browser proof (e2e) — `tests/e2e/nodes/view/ui-component.spec.ts`
- **two instances, instance-specific values**: a `ui-component-definition` with two `ui-text` children (`prop.title`/`prop.body`) + a `ui-button` child; two instances at the same app slot with different props render `inst1#cardTitle`="Alpha" / `inst1#cardBody`="First-live" and `inst2#cardTitle`="Beta" / `inst2#cardBody`="Second".
- **instance identity**: both inner button clones exist as `inst1#cardCta` / `inst2#cardCta` (the click sourceId); the bare definition ids (`cardTitle`/`cardBody`) never render.
- **live store-bound prop**: clicking "Update body" replaces `card.body`; only inst1 (store-bound body) updates live to "First-updated"; inst2's literal body ("Second") and inst1's literal title ("Alpha") are untouched.
- **editor (manual / mount-tree)**: the definition appears in the mount picker under "Komponenten" with a `content` slot (children mount via `def:<id>/content`); the instance's `definitionId` button-picker lists `ui-component-definition` nodes; the props editableList persists name→value-binding pairs; a missing `definitionId` blocks deploy (required-field validation), and `validateComponentAcyclic` surfaces a self-reference as a deploy error.

## P215 — Editor open→save round-trip (e2e) — `tests/e2e/nodes/view/ui-component.roundtrip.spec.ts`

Standard: `.ai/agents/node-testing.md` "Editor open→save round-trip", [ADR 0031](../../../../docs/adr/0031-editor-open-save-round-trip-test-standard.md).
The mandatory round-trip test for the `ui-component-instance` `props` **editableList**
carrier, via `assertEditorRoundTrip` (folds in the former bespoke
`component-instance-props-save.spec.ts`).

- **`props` open→Done round-trip**: an instance deployed with `props` pre-set to `{title:{kind:literal,value:"Alpha"}}` — on open the editableList's hidden carrier (`#node-input-props`) is **seeded non-empty** (proves `oneditprepare` seeds both list and carrier), **survives Done** unchanged (`RED.nodes.node().props` is not clobbered to `""`/`{}`), and a **value-change** (repopulating the list to `{greeting:{kind:literal,value:"Hello"}}` via the widget's `addItem`) persists through `oneditsave` and re-seeds on reopen. Removing the `$("#node-input-props").val(JSON.stringify(stored))` carrier-seed in `oneditprepare` turns it red.
