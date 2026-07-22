import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P112 — route lifecycle on EVERY arrival (deep-link / refresh / navigate).
 *
 * The original complaint: a DEEP-LINK to a parameterised route did not reach the
 * backend — onEnter only fired on a programmatic navigate. The fix moves the
 * lifecycle to the SSE connect, keyed on a per-page-load nonce, so a direct page
 * load / refresh / shared link all emit onEnter on the right route node.
 *
 * These tests prove the event reached the wired flow by having onEnter write the
 * entered `params.id` into a ui-store, then asserting the rendered detail page
 * shows that value (observable in the browser — `verify: browser`).
 */

// Build an app whose customers/:id route declares onEnter and wires it to a
// function → ui-store, so the entered id surfaces in a ui-text on the page.
function deepLinkFlow(appId: string) {
    const flow = new FlowBuilder()
        .app({ id: appId, root: appId, name: appId, layout: "vertical" })
        .node("ui-text", { id: appId + "-home", text: "Home content" })
        .build();

    flow.push({
        type: "ui-route",
        id: appId + "-detail",
        uiId: appId + "-detail",
        name: appId + "-detail",
        app: appId,
        path: "/customers/:id",
        layoutId: "vertical",
        events: ["onEnter"],
        outputs: 1,
        z: "e2e-flow",
        x: 100,
        y: 200,
        wires: [[appId + "-fn"]]
    });
    // onEnter → REPLACE the whole store root with the entered id (a string), so a
    // `store` binding (which resolves to the store's statePath root) reads it back
    // directly. The push targets the navigating client via msg.ui.clientId.
    flow.push({
        type: "function",
        id: appId + "-fn",
        name: appId + "-fn",
        func: "return { ui: { clientId: msg.ui && msg.ui.clientId, store: { id: '"
            + appId + "-store', op: 'replace', value: 'entered-' + ((msg.ui && msg.ui.params && msg.ui.params.id) || '') } } };",
        outputs: 1,
        z: "e2e-flow",
        x: 320,
        y: 200,
        wires: [[appId + "-store"]]
    });
    flow.push({
        type: "ui-store",
        id: appId + "-store",
        uiId: appId + "-store",
        name: appId + "-store",
        app: appId,
        statePath: "entered",
        initialValue: "\"\"",
        z: "e2e-flow",
        x: 540,
        y: 200,
        wires: [[]]
    });
    // A ui-text on the detail route bound to the store value (kind "store", path =
    // store node id) — visible proof the onEnter event reached the backend with
    // the right params.
    flow.push({
        type: "ui-text",
        id: appId + "-detailText",
        uiId: appId + "-detailText",
        name: appId + "-detailText",
        app: appId,
        mount: appId + "-detail.content",
        z: "e2e-flow",
        x: 100,
        y: 260,
        text: "",
        value: { kind: "store", path: appId + "-store" },
        wires: [[]]
    });
    return flow;
}

test.describe("P112: route lifecycle on arrival (deep-link / refresh)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("deep-link to /customers/123 fires onEnter on the route with params {id:'123'}", async ({ page, request }) => {
        const appId = "p112App1";
        await deployFlow(request, deepLinkFlow(appId));

        const webapp = new WebappPage(page, appId);
        // Direct page load (deep-link) — NO prior navigate. This is the path that
        // previously did NOT reach the backend.
        await webapp.navigate("/customers/123");

        // onEnter fired → function wrote id 123 to the store → the bound ui-text
        // renders it. Proves the event reached the wired flow with the params.
        await expect(webapp.root()).toContainText("entered-123", { timeout: 10000 });
    });

    test("refresh of the same route re-fires onEnter (fresh loadId)", async ({ page, request }) => {
        const appId = "p112App2";
        await deployFlow(request, deepLinkFlow(appId));

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/customers/7");
        await expect(webapp.root()).toContainText("entered-7", { timeout: 10000 });

        // A full reload is a fresh page-load (new loadId) → onEnter fires again.
        await page.reload();
        await expect(webapp.root()).toContainText("entered-7", { timeout: 10000 });
    });
});
