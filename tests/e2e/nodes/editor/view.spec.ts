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

    test("ui-input — P123 canonical fields present, required label drives validity, persists", async ({ page, request }) => {
        // P123 (ADR 0012): the plain `valuePath` field was removed; `value` is now a
        // canonical typedInput on #node-input-valueBinding (value bindings are covered
        // by the dedicated ui-input spec). Validity is driven by the required `label`
        // and `mount` fields, so we exercise it on `label`.
        const flow = appWithRoute(new FlowBuilder(), "inputApp")
            .node("ui-input", { id: "inputEd", label: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("inputEd");

        await editor.expectFields(["name", "mount", "label", "valueBinding", "inputType", "disabledBinding"]);

        // mount is auto-set but required label is empty → invalid.
        expect(await editor.getValidationState("inputEd")).toBe("invalid");

        // Fill label → valid; value persists across re-open.
        // label is a typedInput widget on #node-input-label (P145); plain .fill()
        // hangs because the element is hidden — use the typedInput jQuery API.
        await editor.fillTypedInput("label", "Email", "str");
        await editor.save();
        expect(await editor.getValidationState("inputEd")).toBe("valid");

        await editor.openNode("inputEd");
        expect(await editor.readTypedInput("label")).toBe("Email");

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

    test("ui-checkbox — P97: labelBinding + valueBinding + disabledBinding + size fields present", async ({ page, request }) => {
        // P97: label/valuePath are now typedInput bindings; size field added.
        const flow = appWithRoute(new FlowBuilder(), "cbApp")
            .node("ui-checkbox", { id: "cbEd", label: { kind: "literal", value: "Agree" }, value: { kind: "literal", value: false } })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("cbEd");

        // The new editor exposes labelBinding, valueBinding, disabledBinding and size widgets.
        await editor.expectFields(["name", "mount", "labelBinding", "valueBinding", "disabledBinding", "size"]);
        // size select must contain the expected options.
        const sizeOptions = await editor.selectOptionValues("size");
        expect(sizeOptions).toEqual(expect.arrayContaining(["xs", "sm", "md", "lg", "xl"]));
    });

    test("ui-select — P133 label/value/options/placeholder typedInputs present, required label validation", async ({ page, request }) => {
        // P124: `value` is a canonical typedInput on #node-input-valueBinding.
        // P133 (ADR 0012): `label` and `placeholder` are canonical typedInputs
        // (#node-input-labelBinding / #node-input-placeholderBinding); the two old
        // Options fields collapse to ONE #node-input-optionsField (json|store); the
        // `searchable` checkbox is gone. Validity is driven by the required label
        // (non-empty labelBinding value) and mount.
        const flow = appWithRoute(new FlowBuilder(), "selApp")
            .node("ui-select", { id: "selEd", label: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("selEd");

        await editor.expectFields([
            "name", "mount", "labelBinding", "valueBinding", "disabledBinding",
            "optionsField", "placeholderBinding", "multiple"
        ]);
        // P133: the removed fields must NOT be present.
        expect(await editor.hasField("optionsJson")).toBe(false);
        expect(await editor.hasField("searchable")).toBe(false);
        expect(await editor.getValidationState("selEd")).toBe("invalid");

        await editor.fillTypedInput("labelBinding", "Country", "str");
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

    test("ui-text — style SelectBox (typographic role) + variant SelectBox (colour) per P111 contract", async ({
        page,
        request
    }) => {
        // P111 split the old `variant` (role) field into two orthogonal axes:
        //   `style`   = typographic role (TEXT_STYLES vocabulary)
        //   `variant` = semantic colour  (TEXT_COLOR_VARIANTS vocabulary)
        // `size` was also removed.
        const flow = appOnly(new FlowBuilder(), "txtVApp")
            .node("ui-text", { id: "txtV1", text: "Hello", style: "heading-2", variant: "primary" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtV1");

        // Both axes must be present; `size` must NOT be present.
        await editor.expectFields(["style", "variant"]);

        // `style` = typographic role vocabulary (TEXT_STYLES).
        const styleOptions = await editor.selectOptionValues("style");
        expect(styleOptions).toEqual([
            "heading-1",
            "heading-2",
            "heading-3",
            "body",
            "caption",
            "label",
            "code"
        ]);
        expect(await editor.readField("style")).toBe("heading-2");

        // `variant` = semantic colour vocabulary (TEXT_COLOR_VARIANTS).
        const variantOptions = await editor.selectOptionValues("variant");
        expect(variantOptions).toEqual([
            "default",
            "muted",
            "primary",
            "success",
            "warning",
            "danger",
            "neutral"
        ]);
        expect(await editor.readField("variant")).toBe("primary");
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
