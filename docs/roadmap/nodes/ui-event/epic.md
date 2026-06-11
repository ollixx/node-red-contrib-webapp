# Epic: ui-event

Work packages for the `ui-event` node — a reference-based local tap of the
app/route lifecycle events (the *reference* arm of the wire-vs-reference duality
for lifecycle events).

## References
- ADR: [docs/adr/0016-ui-query-trigger-model-visible-no-auto-fire.md](../../../adr/0016-ui-query-trigger-model-visible-no-auto-fire.md)
- ADR: [docs/adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md](../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md)

> Goal: surface app/route lifecycle events (`onEnter`/`onLeave`, …) **locally**
> next to their consumer (e.g. a `ui-query`), keeping the trigger **visible**
> without dragging a long wire across the canvas.
