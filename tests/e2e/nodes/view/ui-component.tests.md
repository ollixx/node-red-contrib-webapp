# ui-component — test catalogue

> **Stub — populated as the Components wave lands (P177→P178→P179).** Spec:
> `docs/nodes/structure/ui-component.md`; decision: ADR 0020.

## P177 — schema (unit)
- _to add:_ definition/instance node-def validation; `def:<id>/content` mount parse/serialize; `prop`/`prop.<name>` form validation + round-trip; self-reference rejection; fixtures.

## P178 — renderer (unit)
- _to add:_ `expandComponent` renders the definition subtree at the instance mount; `prop.<name>` resolves per instance; two instances → different values; re-id `<instanceId>#<innerNodeId>`; nested + self-guard; definition does not render on its own; reactive prop change.

## P179 — node + editor + browser proof (browser)
- _to add:_ both node types registered + bucketed; definition is a container with a default slot in the mount-tree; instance `definitionId` picker + props map; missing-definition / self-ref deploy error; end-to-end: a definition with two `ui-text` children (`prop.title`/`prop.body`) + two instances with different props render their own values; prop store-binding updates live; inner-node event carries the instance identity.
