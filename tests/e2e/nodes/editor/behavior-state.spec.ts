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

    test("ui-action — actionType selector + node picker, parent SelectBox lists app", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "actApp", root: "actApp", name: "Action App" })
            .node("ui-action", { id: "actEd", actionType: "navigate" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("actEd");

        // P60 / ADR 0007 §3: the free-text `target` field is replaced by a canvas
        // node picker. `targets` (JSON list) is the new config field; legacy
        // `target` survives as a hidden input for backward-compat.
        await editor.expectFields(["name", "parent", "actionType", "to", "targets", "part", "description"]);

        // The wireless picker exposes a "pick on canvas" button.
        await expect(page.locator("#node-input-targets-pick")).toHaveCount(1);

        // P53: actionType selector exposes the canonical interaction verb set
        // (ADR 0005) — no submit/remove (P29), no trigger; open/close/select/
        // focus/reset added.
        const actionTypes = await editor.selectOptionValues("actionType");
        expect(actionTypes).toEqual(expect.arrayContaining([
            "navigate", "show", "hide", "open", "close", "select", "enable", "disable", "focus", "reset"
        ]));
        expect(actionTypes).not.toContain("trigger");
        expect(actionTypes).not.toContain("submit");
        expect(actionTypes).not.toContain("remove");

        // parent SelectBox lists the app.
        expect(await editor.pickerPresetValues("apps")).toContain("actApp");

        // P66 (ADR 0007): `to` is now a typedInput (str / msg / flow / global /
        // jsonata) — driven via the widget API, not a plain visible <input>. The
        // literal-path (str) value must round-trip across save/reopen.
        await editor.fillTypedInput("to", "/customers/:id", "str");
        await editor.save();
        await editor.openNode("actEd");
        expect(await editor.readTypedInput("to")).toBe("/customers/:id");
        expect(await editor.readTypedInputType("to")).toBe("str");

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
        expect(await editor.pickerPresetValues("apps")).toContain("storeApp");
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
        expect(await editor.pickerPresetValues("apps")).toContain("qApp");
    });

    test("ui-query — P78: previewData field absent from editor (removed in P32); queryPath round-trips", async ({ page, request }) => {
        // previewData was removed from schema+runtime in P32 but lingered in the
        // editor HTML. P78 removes it from the editor so the three-way contract
        // (schema / runtime / editor) is consistent.
        const flow = new FlowBuilder()
            .app({ id: "qP78App", root: "qP78App", name: "Query P78 App" })
            .node("ui-query", { id: "qP78Ed", queryPath: "items.list" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("qP78Ed");

        // previewData must NOT appear in the editor panel.
        expect(await editor.hasField("previewData")).toBe(false);

        // The real fields must still be present and editable.
        await editor.expectFields(["name", "parent", "queryPath"]);

        // queryPath value round-trips across save/reopen.
        expect(await editor.readField("queryPath")).toBe("items.list");
        await editor.fillField("queryPath", "products.list");
        await editor.save();
        await editor.openNode("qP78Ed");
        expect(await editor.readField("queryPath")).toBe("products.list");
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
        expect(await editor.pickerPresetValues("apps")).toContain("navApp");
        expect(await editor.inputPortCount("navEd")).toBe(1);
    });
});
