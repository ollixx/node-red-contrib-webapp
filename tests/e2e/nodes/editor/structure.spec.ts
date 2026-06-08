import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P47 — Node-RED EDITOR property-panel specs for structure nodes
 * (ui-app, ui-route, ui-dialog).
 *
 * These drive the Node-RED editor canvas via Playwright (NodeEditorPage), not
 * the rendered webapp. Nodes are injected via the admin API, then their editor
 * panel is opened programmatically (RED.editor.edit) — never the webapp URL.
 */

test.describe("editor panels — structure nodes (P47)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-app — fields present, required root drives validity, optional fields persist", async ({ page, request }) => {
        // Deploy an app with an EMPTY root so it starts invalid.
        await deployFlow(request, new FlowBuilder().app({ id: "edApp", root: "", name: "" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("edApp");

        // 1. All documented fields present.
        await editor.expectFields(["name", "root", "layout-preset", "tokens", "events"]);

        // 2. Missing required field (root empty) → node invalid.
        expect(await editor.getValidationState("edApp")).toBe("invalid");

        // 3. Layout preset SelectBox is populated.
        const layoutOptions = await editor.selectOptionValues("layout-preset");
        expect(layoutOptions.length).toBeGreaterThan(0);

        // 4. Fill required field, save, re-open → persisted and valid.
        await editor.fillField("root", "myApp");
        await editor.save();
        expect(await editor.getValidationState("edApp")).toBe("valid");

        await editor.openNode("edApp");
        expect(await editor.readField("root")).toBe("myApp");
    });

    test("ui-app — has one input port (P59 interaction handler); configured event surfaces as an output label", async ({ page, request }) => {
        // outputs is derived from the node's events config (outputLabels reads
        // events[index]). Configure one event so the output port carries its name.
        await deployFlow(
            request,
            new FlowBuilder()
                .app({ id: "edApp2", root: "edApp2", events: JSON.stringify(["submit"]), outputs: 1 })
                .build()
        );

        const editor = new NodeEditorPage(page);
        await editor.open();

        // P59 (ADR 0007 §2): ui-app now owns navigate/reset interaction verbs and
        // carries one input port so a wired ui-action can drive it.
        expect(await editor.inputPortCount("edApp2")).toBe(1);
        // The configured event name appears as the output port label.
        expect(await editor.outputLabels("edApp2")).toEqual(["submit"]);
    });

    test("ui-route — fields present, parent SelectBox lists the app, path required", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeEdApp", root: "routeEdApp", name: "Route Editor App" })
            .route({ id: "routeEd", path: "", layoutId: "vertical" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("routeEd");

        // Fields documented for ui-route.
        // P89: title is a typedInput that uses `titleBinding` as the DOM field id.
        await editor.expectFields(["name", "parent", "path", "titleBinding", "layout-preset"]);

        // Parent SelectBox lists the app.
        const parentOptions = await editor.selectOptionValues("parent");
        expect(parentOptions).toContain("routeEdApp");

        // Empty path → invalid.
        expect(await editor.getValidationState("routeEd")).toBe("invalid");

        // Fill path → valid, persists.
        await editor.fillField("path", "/customers");
        await editor.save();
        expect(await editor.getValidationState("routeEd")).toBe("valid");

        await editor.openNode("routeEd");
        expect(await editor.readField("path")).toBe("/customers");
    });

    test("ui-route — path '/' is rejected (reserved for the implicit app root)", async ({ page, request }) => {
        // P48: "/" is reserved for the ui-app implicit root route. A ui-route
        // node with path "/" must be flagged invalid by the editor (and rejected
        // by the schema at deploy time). FlowBuilder.route() refuses "/", so the
        // raw node is constructed here to exercise the rejection path directly.
        const app = new FlowBuilder().app({ id: "slashApp", root: "slashApp", name: "Slash App" }).build();
        const flow = [
            ...app,
            {
                type: "ui-route",
                id: "slashRoute",
                uiId: "slashRoute",
                name: "slashRoute",
                parent: "slashApp",
                path: "/",
                title: "Bad Route",
                layoutId: "vertical",
                z: "e2e-flow",
                x: 100,
                y: 200,
                wires: [[]]
            }
        ];
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("slashRoute");

        // path "/" → invalid.
        expect(await editor.getValidationState("slashRoute")).toBe("invalid");

        // Changing to a non-"/" sub-path makes it valid.
        await editor.fillField("path", "/customers");
        await editor.save();
        expect(await editor.getValidationState("slashRoute")).toBe("valid");
    });

    test("ui-dialog — opens without crash, has expected fields", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dlgApp", root: "dlgApp" })
            .node("ui-dialog", { id: "dlgEd", title: "My Dialog" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("dlgEd");

        await editor.expectFields(["name"]);
        // Parent selector present and lists the app.
        if (await editor.hasField("parent")) {
            expect(await editor.selectOptionValues("parent")).toContain("dlgApp");
        }
    });
});
