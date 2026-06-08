import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P83 — ui-divider render E2E specs.
 *
 * Verifies that the ui-divider node renders as an <sl-divider> element. Before
 * P83, ui-divider was missing from both the components filter (getDefinitionBuckets)
 * and the renderer's kind map, so it produced no output at all.
 *
 * ui-divider has no input port and emits no events — behaviour coverage is in
 * packages/runtime/test/p76-divider-no-input-handler.test.ts and
 * p83-display-nodes-behaviour.test.ts. Editor coverage is in
 * p16d-display-nodes.spec.ts.
 */

test.describe("ui-divider render (P83)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders as <sl-divider> in the served page", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "divApp1", root: "divApp1" })
            .node("ui-divider", { id: "divNode1" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/divApp1/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("<sl-divider");

        const webapp = new WebappPage(page, "divApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });

    test("renders a vertical divider with the vertical attribute", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "divApp2", root: "divApp2" })
            .node("ui-divider", { id: "divNode2", orientation: "vertical" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/divApp2/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("<sl-divider vertical");
    });

    test("renders a divider with a label inside the element", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "divApp3", root: "divApp3" })
            .node("ui-divider", { id: "divNode3", label: "Section" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/divApp3/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("<sl-divider>");
        expect(html).toContain("Section");
    });

    test("renders without crashing when only defaults are configured", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "divApp4", root: "divApp4" })
            .node("ui-divider", { id: "divNode4" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "divApp4");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });
});
