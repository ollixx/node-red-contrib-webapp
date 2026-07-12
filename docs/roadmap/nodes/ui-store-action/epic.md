# Epic: ui-store-action

Work packages for the `ui-store-action` node — a typed, reference-based store
mutation node (hybrid wire/reference).

## References
- Spec: [docs/nodes/state/ui-store-action.md](../../../nodes/state/ui-store-action.md)
- Decision: [ADR 0029](../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)

> Goal: trigger any store op (set/patch/delete/replace/reset) against a referenced
> ui-store without boilerplate — directly (reference mode) or by emitting the
> envelope on the out-port (wire mode).
