# ui-component — test catalogue

> **Stub — populated as the Components wave lands (P177→P178→P179).** Spec:
> `docs/nodes/structure/ui-component.md`; decision: ADR 0020.

## P177 — schema (unit) — `packages/schema/test/p177-component-schema.test.ts`
- **`ui-component-definition`**: validates off-canvas (no outer mount required); optional `name` (empty-string rejected); requires `id`; reachable via `validateUiNodeDefinition`; `COMPONENT_DEF_SLOT === "content"`.
- **`ui-component-instance`**: validates with outer `mount` + `definitionId` + `props`; `props` defaults to `{}`; `definitionId` required (empty-string rejected); outer `mount`/`parent` required (leaf, mounted into a real region); props accept any binding kind; **negative:** a props value with an unknown binding kind is rejected; reachable via `validateUiNodeDefinition`.
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

## P179 — node + editor + browser proof (browser)
- _to add:_ both node types registered + bucketed; definition is a container with a default slot in the mount-tree; instance `definitionId` picker + props map; missing-definition / self-ref deploy error; end-to-end: a definition with two `ui-text` children (`prop.title`/`prop.body`) + two instances with different props render their own values; prop store-binding updates live; inner-node event carries the instance identity.
