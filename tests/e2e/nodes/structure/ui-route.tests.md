# ui-route — test catalogue

Location: `tests/e2e/nodes/structure/ui-route.spec.ts`

Written fresh for P89 per `.ai/agents/node-testing.md`. Replaces the P42 spec.

## Tests

| Test | Goal |
|---|---|
| app root '/'  (no ui-route) — renders home content at /webapp/:appId/ | The ui-app serves as the implicit root route; content mounts to `appId.content` without a `ui-route` node. |
| route at '/customers' — renders at /webapp/:appId/customers | A sub-path route renders its mounted content at the expected URL. |
| two routes — navigating to each shows its content | Navigating between two routes shows the correct content for each and hides the other's. |
| layoutId 'grid' — webapp-layout--grid class in HTML | The `layoutId` "grid" produces `.webapp-layout--grid` in the rendered DOM. |
| layoutId 'vertical' — webapp-layout--vertical class in HTML | The `layoutId` "vertical" produces `.webapp-layout--vertical` in the rendered DOM. |
| title as plain string — appears in page `<title>` | Back-compat: a plain-string title resolves to a string that appears in the browser `<title>` element. |
| title as literal binding { kind: 'literal', value } — appears in page `<title>` | P89: a literal binding object resolves to its `value` string in the `<title>` element. |
| title as state binding — `<title>` falls back to route id | P89: a dynamic binding (state/store/msg/…) that cannot be resolved server-side causes the `<title>` to fall back to the route's id. |
| no title — `<title>` shows route id as fallback | When no title is set, the `<title>` element shows the route id as a fallback identifier. |
