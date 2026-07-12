# Epic: ui-query-action

Work packages for the `ui-query-action` node — a typed, reference-based query
trigger node (hybrid wire/reference).

## References
- Spec: [docs/nodes/state/ui-query-action.md](../../../nodes/state/ui-query-action.md)
- Decision: [ADR 0029](../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)

> Goal: trigger a ui-query action (refresh) against a referenced ui-query without
> boilerplate — directly (reference mode) or by emitting the envelope on the
> out-port (wire mode).
