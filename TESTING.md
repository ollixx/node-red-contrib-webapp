# Testing

## Test layers

| Layer | Where | Runs with |
|---|---|---|
| Unit | `packages/*/test/` | `pnpm test` |
| Per-node E2E (regression) | `tests/e2e/nodes/*.spec.ts` | `pnpm exec playwright test` |
| Integration smoke | `tests/e2e/customers-crud.spec.ts` (tagged `@integration`) | `pnpm test:e2e:integration` |

The default Playwright run **excludes** `@integration` specs. The toggle is the
`E2E_INTEGRATION` env var, applied in `playwright.config.ts`:

- default → `grepInvert: /@integration/` (run everything except integration)
- `E2E_INTEGRATION=1` → `grep: /@integration/` (run only integration)

A CLI `--grep` is **not** the toggle: Playwright ANDs a CLI `--grep` with the
config `grep`/`grepInvert`, so a config-side exclusion can never be overridden
from the command line. The customers-crud spec is a happy-path smoke test — a
broken individual node does not surface there. Each node gets its own regression
spec under `tests/e2e/nodes/`.

## E2E environment

`pnpm exec playwright test` auto-starts a Node-RED instance on port 1882 from a
fresh `.node-red-e2e/` user directory. By default it seeds the customers-crud
flow so the `@integration` suite has its baseline; set `E2E_RESET_ON_START=false`
to start with an empty flow. Per-node specs do not rely on the startup flow —
they deploy their own isolated flow and reset between tests.

## Per-node spec template

Per-node specs build an isolated flow with `FlowBuilder`, deploy it via the
admin-API helpers, and drive/inspect it with `WebappPage`:

```ts
import { expect, test } from "@playwright/test";
import { deployFlow, resetFlow, injectMessage } from "../../helpers/admin-api";
import { FlowBuilder } from "../../helpers/flow-builder";
import { WebappPage } from "../../helpers/webapp-page";

test.describe("ui-xxx", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("renders with required fields", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "app", root: "app" })
            .route({ id: "home", path: "/" })
            .node("ui-xxx", { id: "n1", label: "Hello" })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "app");
        await webapp.navigate("/");
        await webapp.expectComponent("...");
    });
});
```

## Helper API

`tests/helpers/flow-builder.ts` — `FlowBuilder`
- `.app(overrides?)` — add a `ui-app`; becomes the default parent.
- `.route(overrides?)` — add a `ui-route` (parent defaults to last app).
- `.node(type, overrides?)` — add any node type with canonical defaults; view
  nodes mount into `route:<routeId>/content` by default.
- `.withInjectNode(id, wiredTo, payload?)` — an `inject` node wired to the
  node-under-test, for input-port tests.
- `.build()` — returns `NodeDef[]` with a leading `tab` node.

`tests/helpers/admin-api.ts`
- `deployFlow(request, nodes)` — POST `/flows`; throws on non-2xx. Prepends a
  `tab` if the flow has none.
- `resetFlow(request)` — deploy a single empty tab (full isolation).
- `injectMessage(request, nodeId, payload?)` — POST `/inject/:id` to fire a
  wired input port.

`tests/helpers/webapp-page.ts` — `WebappPage(page, appId)`
- `navigate(path?)` — go to the app and wait for the SSE subscription.
- `expectComponent(selector)` / `expectAttr(selector, attr, value)` — assertions.
- `getHtml()` — innerHTML of `#webapp-client-root`.
- `interceptNextEvent()` — resolves with the next POST `/event` body (call
  before the triggering action).
- `waitForSseSnapshot()` — wait for the next live stream frame, then read HTML.
