import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-empty-state (stateless view node).
 *
 * ui-empty-state has NO dedicated serializer branch yet — it currently emits no
 * chrome of its own (deferred; a per-node conformance pass will give it real
 * output). The observable outcome available today is that a flow CONTAINING an
 * empty-state still renders its siblings — i.e. the node integrates into the
 * render pipeline without breaking it. That is asserted below via a sibling
 * ui-text whose content must appear (goes red if the empty-state node breaks
 * the app render). No presence-only "does it render" test is kept (P233).
 */

test.describe("ui-empty-state (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("empty-state alongside text node — layout renders correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "emptyApp2", root: "emptyApp2" })
            .node("ui-empty-state", { id: "emptyNode2", visible: "true", title: "Empty" })
            .node("ui-text", { id: "emptyText2", text: "Other content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "emptyApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Other content");
    });
});
