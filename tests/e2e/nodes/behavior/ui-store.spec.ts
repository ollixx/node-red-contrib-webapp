import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P46 — per-node E2E specs for ui-store (state node).
 *
 * ui-store does not render a component itself; it drives state. Tests verify
 * downstream effects on bound nodes.
 *
 * Covers:
 *   - Store with an initial value → bound ui-text renders that value.
 *   - Inject a message to the store node → bound ui-text updates via SSE.
 *   - Value is retained when re-navigating within the same session (liveState).
 */

test.describe("ui-store (P46)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── initial value ────────────────────────────────────────────────────────

    test("store with initial value → bound ui-text renders that value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "storeApp1", root: "storeApp1" })
            .route({ id: "storeRoute1", path: "/" })
            .node("ui-store", {
                id: "storeNode1",
                statePath: "greeting",
                initialValue: "\"Hello from store\""
            })
            .node("ui-text", {
                id: "storeTxt1",
                value: { kind: "state", path: "greeting" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "storeApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello from store");
    });

    test("store with numeric initial value → bound ui-text renders the number", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "storeApp2", root: "storeApp2" })
            .route({ id: "storeRoute2", path: "/" })
            .node("ui-store", {
                id: "storeNode2",
                statePath: "count",
                initialValue: "42"
            })
            .node("ui-text", {
                id: "storeTxt2",
                value: { kind: "state", path: "count" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "storeApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("42");
    });

    // ─── inject → live SSE update ─────────────────────────────────────────────

    test("inject message to store node → bound ui-text updates via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "storeApp3", root: "storeApp3" })
            .route({ id: "storeRoute3", path: "/" })
            .node("ui-store", {
                id: "storeNode3",
                statePath: "msg",
                initialValue: "\"initial\""
            })
            .node("ui-text", {
                id: "storeTxt3",
                value: { kind: "state", path: "msg" }
            })
            .withStoreInject("storeInj3", "storeNode3", "updated")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "storeApp3");
        await webapp.navigate("/");

        // Verify the initial render.
        await expect(webapp.root()).toContainText("initial");

        // Fire the inject; it routes through a function node that formats
        // msg.ui.store, then the store handler applies the update and pushes
        // a snapshot to connected SSE clients.
        await injectMessage(request, "storeInj3");

        // The SSE snapshot will morph the DOM. Poll for the updated text.
        await expect(webapp.root()).toContainText("updated", { timeout: 5000 });
    });

    // ─── value survives re-navigation ────────────────────────────────────────

    test("value injected into store persists when re-navigating within session", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "storeApp4", root: "storeApp4" })
            .route({ id: "storeRoute4", path: "/" })
            .node("ui-store", {
                id: "storeNode4",
                statePath: "label",
                initialValue: "\"before\""
            })
            .node("ui-text", {
                id: "storeTxt4",
                value: { kind: "state", path: "label" }
            })
            .withStoreInject("storeInj4", "storeNode4", "after")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "storeApp4");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("before");

        // Update the store value.
        await injectMessage(request, "storeInj4");
        await expect(webapp.root()).toContainText("after", { timeout: 5000 });

        // Re-navigate to the same route. The live-state (in-memory liveState map)
        // should still hold the updated value — the server renders it on next GET.
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("after");
    });
});
