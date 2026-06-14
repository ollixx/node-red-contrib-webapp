# ui-component (definition + instance)

> **Stub — to be filled during the Components wave (P177→P178→P179).** The
> contract is decided in [ADR 0020](../../adr/0020-component-model-dedicated-ui-component-node.md)
> (dedicated `ui-component` node pair; spike findings in
> [ADR 0019](../../adr/0019-component-substrate-subflow-vs-ui-component.md)).

A **Component** is a named, parametrised, reusable set of `ui-*` nodes — authored
once as a **`ui-component-definition`** and used many times as a
**`ui-component-instance`** with props. Reuses the `ui-repeat` render-time-scope
machinery ([ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md)).

## Contract (per ADR 0020 — to be detailed as each layer lands)

- **`ui-component-definition`** — container-kind, off-canvas; children mount into
  `def:<componentId>/content`; never renders on its own. *(P177 schema; P179 node/editor.)*
- **`ui-component-instance`** — leaf with an outer `mount`, a `definitionId`, and a
  `props` map (name → value typedInput, any binding kind). *(P177 schema; P179 editor picker + props map.)*
- **`def:` mount scope** — new scope in the mount grammar. *(P177.)*
- **`prop` / `prop.<name>` binding kind** — scope-local, resolved at render time
  against the instance's `propScope` frame; `undefined` outside an instance. *(P177 form; P178 resolution.)*
- **`expandComponent`** — props→propScope→render `def:` subtree→re-id
  `<instanceId>#<innerNodeId>`→flatten into the instance's host region; nested +
  self-reference guard. *(P178.)*
- **v1 cut** — props in / events out; **no** child-slot projection (composition,
  P142); **no** per-instance state (presentational).
