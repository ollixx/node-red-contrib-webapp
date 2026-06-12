# Epic: ui-repeat

Work packages for the new `ui-repeat` node — a generic template container that
renders a child subtree n× from data, with a render-time item scope.

## References
- ADR: [docs/adr/0017-ui-repeat-template-container-render-time-scope.md](../../../adr/0017-ui-repeat-template-container-render-time-scope.md)
- Spec: [docs/nodes/display/ui-repeat.md](../../../nodes/display/ui-repeat.md)
- Resolves concept [[P140]] (Repeats).

> Goal: render a component **n× from data** with children binding **relative to
> the current item** (`item.*`/`index`), scope resolved at render time (not
> persisted). Stage 1 is read-only; writing from a row is a later stage.
