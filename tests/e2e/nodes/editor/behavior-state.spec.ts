import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P47 — Node-RED EDITOR property-panel specs for behavior + state nodes
 * (ui-action, ui-store, ui-query, ui-navigation). Editor-only: no webapp URL.
 */

test.describe("editor panels — behavior & state nodes (P47)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-action — actionType selector + target field, parent SelectBox lists app", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "actApp", root: "actApp", name: "Action App" })
            .node("ui-action", { id: "actEd", actionType: "navigate" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("actEd");

        await editor.expectFields(["name", "parent", "actionType", "to", "description"]);

        // actionType selector exposes the documented action types.
        const actionTypes = await editor.selectOptionValues("actionType");
        expect(actionTypes).toEqual(expect.arrayContaining(["navigate", "show", "hide", "trigger"]));

        // parent SelectBox lists the app.
        expect(await editor.selectOptionValues("parent")).toContain("actApp");

        // Optional target field persists.
        await editor.fillField("to", "/customers/:id");
        await editor.save();
        await editor.openNode("actEd");
        expect(await editor.readField("to")).toBe("/customers/:id");

        // ui-action has both an input and an output port.
        expect(await editor.inputPortCount("actEd")).toBe(1);
    });

    test("ui-store — initialValue + persist fields, required statePath drives validity", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "storeApp", root: "storeApp", name: "Store App" })
            .node("ui-store", { id: "storeEd", statePath: "", initialValue: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("storeEd");

        await editor.expectFields(["name", "parent", "statePath", "initialValue", "persist"]);

        // statePath required and empty → invalid.
        expect(await editor.getValidationState("storeEd")).toBe("invalid");

        // Fill statePath + initialValue → valid; persists.
        await editor.fillField("statePath", "customers");
        await editor.fillField("initialValue", "[]");
        await editor.save();
        expect(await editor.getValidationState("storeEd")).toBe("valid");

        await editor.openNode("storeEd");
        expect(await editor.readField("statePath")).toBe("customers");
        expect(await editor.readField("initialValue")).toBe("[]");

        // parent SelectBox lists the app.
        expect(await editor.selectOptionValues("parent")).toContain("storeApp");
    });

    test("ui-query — fields present, required queryPath drives validity", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "qApp", root: "qApp", name: "Query App" })
            .node("ui-query", { id: "qEd", queryPath: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("qEd");

        await editor.expectFields(["name", "parent"]);
        expect(await editor.selectOptionValues("parent")).toContain("qApp");
    });

    test("ui-navigation — opens without crash, parent SelectBox lists app", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "navApp", root: "navApp", name: "Nav App" })
            .node("ui-navigation", { id: "navEd", to: "/" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("navEd");

        await editor.expectFields(["name", "parent"]);
        expect(await editor.selectOptionValues("parent")).toContain("navApp");
        expect(await editor.inputPortCount("navEd")).toBe(1);
    });
});
