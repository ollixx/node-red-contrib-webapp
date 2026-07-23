# ui-app — test catalogue

Location: `tests/e2e/nodes/structure/ui-app.spec.ts`

Written fresh for P87 per `.ai/agents/node-testing.md`. Reviewed for P88 — no new tests needed (P88 is a pure editor HTML layout polish: no new fields, no new runtime behaviour). Extended for P109 (name/root/title rework: schema changes + header-slot render semantics).

## Tests

| Test | Goal |
|---|---|
| minimal config — app-bar visible with title | `.webapp-app-bar` and `.webapp-app-bar-title` render the node's `name` when `layout: "app"`. |
| tokens.colorPrimary — CSS custom property applied to app bar background | Setting `tokens.colorPrimary` to `#7c3aed` causes `--wa-color-primary` to be applied and the app-bar background renders in that colour. |
| missing root — /webapp/:id returns 404 | Accessing `/webapp/noSuchApp/` when no `ui-app` node is deployed returns HTTP 404. |
| layout preset 'app' — app-bar and slot chrome render | `layout: "app"` renders `.webapp-app-bar` and `.webapp-layout--app`. |
| layout preset 'plain' — no app-bar rendered | `layout: "vertical"` does NOT render `.webapp-app-bar`; the client root is still visible. |
| app-bar persists on routes with non-'app' layoutId | App-bar is driven by `ui-app.layout`, not the active route's `layoutId` — navigating to a `vertical` sub-route must still show the `app` app-bar. |
| P87: clientId is persisted in localStorage — reload reuses the same id | After first load, `localStorage["webapp:clientId:<appId>"]` is set with a `client-` prefixed value. After reload, the stored value is unchanged (same clientId reused). |
| P87: clientId key is scoped per appId — two apps get distinct keys | Two apps on the same origin store their clientIds under different keys and get different values; visiting one app does not change the other's key. |
| P109: HTML `<title>` element shows the app's name | The browser-tab `<title>` contains the app's `name` field value. |
| P109: header-slot empty → name shown as title in app-bar | When no children are in the header slot, `.webapp-app-bar-title` shows the app's `name`. |
| P109: header-slot has children → no name title in app-bar | When ≥1 child is mounted in the header slot, `.webapp-app-bar-title` is absent and only the slot content is rendered. |

## Editor round-trip (P260)

Location: `tests/e2e/nodes/structure/ui-app.roundtrip.spec.ts`

The `auth` config (ADR 0041 §2) is ONE object stored directly on the node — deliberately without a `#node-input-auth` DOM carrier (ADR 0031 clobber class): `oneditprepare` seeds the `#node-ui-app-auth-*` rows from `this.auth`, `oneditsave` writes the object back. The field is INERT until P261 (configured, not enforced) — these tests prove config persistence only, deliberately no behaviour.

| Test | Goal |
|---|---|
| trusted-header `auth` survives open→Done and a change round-trips | A deployed `{ mode: "trusted-header", headerUser, redirect }` seeds the auth rows on open and survives Done structurally unchanged (no clobber to the `{ mode: "none" }` default); editing header rows persists the new values; blanking a row drops its key ("use documented default"). |
| mode none hides the detail rows and persists as `{ mode: "none" }` | Default `auth` mode is `none`; the header/redirect detail rows are hidden for `none`, revealed on switching to `trusted-header`, hidden again on switching back; Done persists `{ mode: "none" }`. |
