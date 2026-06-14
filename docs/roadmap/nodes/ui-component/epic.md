# Epic: ui-component

Work packages for **Components** — a named, parametrised, reusable set of `ui-*`
nodes, authored once as a **definition** and used many times as an **instance**
with props. Built as a **dedicated node pair** (`ui-component-definition` +
`ui-component-instance`), reusing the `ui-repeat` render-time-scope machinery —
**not** a Node-RED subflow.

## References
- Decision ADR: [docs/adr/0020-component-model-dedicated-ui-component-node.md](../../../adr/0020-component-model-dedicated-ui-component-node.md)
- Feasibility spike: [docs/adr/0019-component-substrate-subflow-vs-ui-component.md](../../../adr/0019-component-substrate-subflow-vs-ui-component.md)
- Reuses: [ADR 0017](../../../adr/0017-ui-repeat-template-container-render-time-scope.md) (render-time scope, clone + re-id, keyed identity).
- Resolves concept [[P141]].

> Goal: render a **definition** subtree at an **instance**'s outer mount, passing
> **typed props** resolved inside as a `prop.<name>` render-time scope. v1 is
> presentational (props in / events out); child-slot projection (composition,
> [[P142]]) and per-instance state are later stages.

## Layers (mirror the ui-repeat wave)
- **P177** — schema: two node defs + `def:` mount scope + `prop` scope-local kind + self-ref validation (`verify:unit`).
- **P178** — renderer: `expandComponent` (props→propScope→render `def:` subtree→re-id→flatten), `prop.<name>` resolution, nested + self-guard (`verify:unit`).
- **P179** — node registration + editor + runtime bucketing + **browser proof** (`verify:browser`).
