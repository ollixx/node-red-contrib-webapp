import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../../helpers/admin-api";
import { FlowBuilder } from "../../helpers/flow-builder";
import { WebappPage } from "../../helpers/webapp-page";

/**
 * P41 — smoke test for the per-node E2E infrastructure (FlowBuilder, admin-api
 * helpers, WebappPage). Every subsequent per-node spec depends on these, so this
 * verifies the foundation end to end against the live E2E Node-RED.
 */
test.describe("per-node E2E infrastructure (P41)", () => {
    // Restore the customers-crud baseline so the @integration smoke suite and any
    // other spec that assumes customersApp starts from a known-good flow.
    test.afterAll(async ({ request }) => {
        const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
        const baseline = JSON.parse(await readFile(fixturePath, "utf8")) as NodeDef[];
        await deployFlow(request, baseline);
    });

    test("deployFlow + resetFlow round-trip works", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "smokeApp", root: "smokeApp" })
            .route({ id: "smokeHome", path: "/" })
            .node("ui-text", { id: "smokeText", text: "Hello smoke" })
            .build();

        // Deploy a minimal built flow — the app page must serve (200) and the
        // text node must render client-side into the app root.
        await deployFlow(request, flow);
        const deployed = await request.get("/webapp/smokeApp/");
        expect(deployed.ok()).toBeTruthy();

        const webapp = new WebappPage(page, "smokeApp");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello smoke");

        // Reset to an empty tab — the app must no longer exist (404).
        await resetFlow(request);
        const afterReset = await request.get("/webapp/smokeApp/");
        expect(afterReset.status()).toBe(404);
    });

    test("WebappPage.interceptNextEvent captures a POST /event body", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "evtApp", root: "evtApp" })
            .route({ id: "evtHome", path: "/" })
            .node("ui-button", { id: "evtButton", label: "Fire" })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "evtApp");
        await webapp.navigate("/");
        await webapp.expectComponent("#webapp-client-root");

        const eventBody = webapp.interceptNextEvent();
        await page.getByRole("button", { name: "Fire" }).click();
        const body = await eventBody;

        expect(body.event).toBe("click");
        expect(body.sourceId).toBe("evtButton");
        expect(typeof body.clientId).toBe("string");
    });
});
