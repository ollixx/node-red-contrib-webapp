import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-skeleton (stateless view node).
 *
 * ui-skeleton has NO dedicated serializer element yet (sl-skeleton is not in the
 * bundled Shoelace set) — it currently emits no chrome of its own (deferred; a
 * per-node conformance pass will give it real output). The observable outcome
 * available today is that a flow CONTAINING a skeleton still renders its
 * siblings — i.e. the node integrates into the render pipeline without breaking
 * it. That is asserted below via a sibling ui-text whose content must appear
 * (goes red if the skeleton node breaks the app render). No presence-only "does
 * it render" test is kept (P233).
 */

test.describe("ui-skeleton (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("skeleton alongside text node — layout renders correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "skelApp2", root: "skelApp2" })
            .node("ui-skeleton", { id: "skelNode2", visible: "true" })
            .node("ui-text", { id: "skelText2", text: "Content loaded" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "skelApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Content loaded");
    });
});
