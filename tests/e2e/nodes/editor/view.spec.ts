import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P47 — Node-RED EDITOR property-panel specs for the high-complexity view nodes
 * (ui-input, ui-checkbox, ui-select, ui-table). Editor-only: no webapp URL.
 *
 * Each view node mounts into a route (FlowBuilder sets `mount`). The required
 * `valuePath` / `rowsPath` fields are intentionally left empty by the builder so
 * the validation-indicator assertions have something to fire on.
 */

test.describe("editor panels — view nodes (P47)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // P48: the app is the implicit root route; nodes auto-mount to `${appId}.content`.
    function appWithRoute(builder: FlowBuilder, appId: string): FlowBuilder {
        return builder.app({ id: appId, root: appId, name: appId });
    }

    test("ui-input — fields present, required valuePath drives validity, persists", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "inputApp")
            .node("ui-input", { id: "inputEd", label: "Email", valuePath: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("inputEd");

        await editor.expectFields(["name", "mount", "label", "valuePath", "inputType"]);

        // label is filled, but required valuePath is empty → invalid.
        expect(await editor.getValidationState("inputEd")).toBe("invalid");

        // Fill valuePath → valid; value persists across re-open.
        await editor.fillField("valuePath", "form.email");
        await editor.save();
        expect(await editor.getValidationState("inputEd")).toBe("valid");

        await editor.openNode("inputEd");
        expect(await editor.readField("valuePath")).toBe("form.email");

        // inputType is a select with the documented options.
        const inputTypes = await editor.selectOptionValues("inputType");
        expect(inputTypes).toContain("text");
    });

    test("ui-input — has an input port (inputs: 1) and an output port", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "inputApp2")
            .node("ui-input", { id: "inputEd2", label: "X", valuePath: "x" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        expect(await editor.inputPortCount("inputEd2")).toBe(1);
    });

    test("ui-checkbox — label + valuePath fields, required valuePath validation", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "cbApp")
            .node("ui-checkbox", { id: "cbEd", label: "Agree", valuePath: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("cbEd");

        await editor.expectFields(["name", "mount", "label", "valuePath"]);
        expect(await editor.getValidationState("cbEd")).toBe("invalid");

        await editor.fillField("valuePath", "form.agree");
        await editor.save();
        expect(await editor.getValidationState("cbEd")).toBe("valid");
    });

    test("ui-select — value binding + options fields present, required valuePath validation", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "selApp")
            .node("ui-select", { id: "selEd", label: "Country", valuePath: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("selEd");

        await editor.expectFields(["name", "mount", "label", "valuePath", "optionsJson", "optionsBinding"]);
        expect(await editor.getValidationState("selEd")).toBe("invalid");

        await editor.fillField("valuePath", "form.country");
        await editor.save();
        expect(await editor.getValidationState("selEd")).toBe("valid");
    });

    test("ui-table — columns editor + rowsPath present, required fields drive validity", async ({ page, request }) => {
        // Leave columns and rowsPath empty → both required, so node is invalid.
        const flow = appWithRoute(new FlowBuilder(), "tblApp")
            .node("ui-table", { id: "tblEd", columns: "", rowsPath: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("tblEd");

        await editor.expectFields(["name", "mount", "columns", "rowsPath", "events"]);
        expect(await editor.getValidationState("tblEd")).toBe("invalid");

        // Fill both required fields → valid; persists.
        await editor.fillField("columns", JSON.stringify([{ key: "name", label: "Name" }]));
        await editor.fillField("rowsPath", "data.rows");
        await editor.save();
        expect(await editor.getValidationState("tblEd")).toBe("valid");

        await editor.openNode("tblEd");
        expect(await editor.readField("rowsPath")).toBe("data.rows");
    });

    test("ui-table — configured event surfaces as the output port label", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "tblApp2")
            .node("ui-table", {
                id: "tblEd2",
                columns: JSON.stringify([{ key: "n", label: "N" }]),
                rowsPath: "rows",
                events: JSON.stringify(["rowClick"]),
                outputs: 1
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        expect(await editor.outputLabels("tblEd2")).toEqual(["rowClick"]);
        // Interactive view nodes have an input port.
        expect(await editor.inputPortCount("tblEd2")).toBe(1);
    });
});

/**
 * P50 — variant SelectBox injected from schema vocabulary (not backend-specific).
 *
 * For each node with a TRUE semantic `variant` field the editor panel must expose
 * a <select id="node-input-variant"> whose options match the schema vocabulary
 * exactly (COMPONENT_VARIANT_VOCABULARY), and the stored value must be pre-selected
 * on panel open. No node HTML may hard-code the option list.
 */
test.describe("editor panels — variant SelectBox (P50)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    function appOnly(builder: FlowBuilder, appId: string): FlowBuilder {
        return builder.app({ id: appId, root: appId, name: appId });
    }

    test("ui-button — variant SelectBox present with schema vocabulary, stored value pre-selected", async ({
        page,
        request
    }) => {
        const flow = appOnly(new FlowBuilder(), "btnVApp")
            .node("ui-button", { id: "btnV1", label: "Go", variant: "ghost" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("btnV1");

        // The variant SelectBox must be present (injected by installVariantSelectBox).
        await editor.expectFields(["variant"]);

        // Options must match the schema BUTTON_VARIANTS vocabulary exactly.
        const options = await editor.selectOptionValues("variant");
        expect(options).toEqual([
            "primary",
            "secondary",
            "success",
            "danger",
            "warning",
            "neutral",
            "ghost",
            "link"
        ]);

        // The stored value ("ghost") must be pre-selected.
        expect(await editor.readField("variant")).toBe("ghost");
    });

    test("ui-text — variant SelectBox present with schema vocabulary (text variants)", async ({
        page,
        request
    }) => {
        const flow = appOnly(new FlowBuilder(), "txtVApp")
            .node("ui-text", { id: "txtV1", text: "Hello", variant: "heading-1" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtV1");

        await editor.expectFields(["variant"]);
        const options = await editor.selectOptionValues("variant");
        expect(options).toEqual([
            "heading-1",
            "heading-2",
            "heading-3",
            "body",
            "caption",
            "label",
            "code",
            "muted"
        ]);
        expect(await editor.readField("variant")).toBe("heading-1");
    });

    test("ui-input — variant SelectBox present with schema vocabulary (input variants)", async ({
        page,
        request
    }) => {
        const flow = appOnly(new FlowBuilder(), "inpVApp")
            .node("ui-input", { id: "inpV1", label: "Email", valuePath: "form.email", variant: "filled" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("inpV1");

        await editor.expectFields(["variant"]);
        const options = await editor.selectOptionValues("variant");
        expect(options).toEqual(["default", "filled", "outlined"]);
        expect(await editor.readField("variant")).toBe("filled");
    });

    test("ui-container — variant SelectBox present with schema vocabulary (container variants)", async ({
        page,
        request
    }) => {
        const flow = appOnly(new FlowBuilder(), "ctrVApp")
            .node("ui-container", { id: "ctrV1", layoutId: "vertical", variant: "panel" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ctrV1");

        await editor.expectFields(["variant"]);
        const options = await editor.selectOptionValues("variant");
        expect(options).toEqual(["card", "panel", "section", "transparent"]);
        expect(await editor.readField("variant")).toBe("panel");
    });

    test("ui-button — changing variant in editor persists after save", async ({ page, request }) => {
        const flow = appOnly(new FlowBuilder(), "btnVApp2")
            .node("ui-button", { id: "btnV2", label: "Save", variant: "neutral" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("btnV2");

        // Change from neutral → danger.
        await editor.fillField("variant", "danger");
        await editor.save();

        // Re-open: persisted value must be "danger".
        await editor.openNode("btnV2");
        expect(await editor.readField("variant")).toBe("danger");
    });
});
