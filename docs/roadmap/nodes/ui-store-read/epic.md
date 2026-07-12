# Epic: ui-store-read

Work packages for the `ui-store-read` node — an on-demand, reference-based reader
of `ui-store` client state.

## References
- Spec: [docs/nodes/state/ui-store-read.md](../../../nodes/state/ui-store-read.md)
- Decision: [ADR 0028](../../../adr/0028-store-reads-are-a-separate-reference-node.md)

> Goal: read a `ui-store` slice (or sub-path) into a flow on demand — per-client,
> non-mutating, multi-instance — so backends (DB persist / export / sync) get the
> current state without boilerplate or a fan-out bottleneck on `ui-store`.
