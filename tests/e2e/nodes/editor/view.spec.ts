import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P47 — Node-RED EDITOR property-panel specs for the high-complexity view nodes
 * (ui-input, ui-checkbox, ui-select, ui-table). Editor-only: no webapp URL.
 *
 * Each view node mounts into a route (FlowBuilder sets `mount`). Required
 * fields (label / columns) are intentionally left empty per test so the
 * validation-indicator assertions have something to fire on.
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

        // P203 (ADR 0027): the writeTo (WRITE) typedInput + writeTrigger select are
        // present; the legacy storeId/path fields are gone.
        await editor.expectFields(["name", "mount", "label", "valueBinding", "writeToBinding", "writeTrigger", "inputType", "disabledBinding"]);
        await expect(page.locator("#node-input-storeId")).toHaveCount(0);
        await expect(page.locator("#node-input-path")).toHaveCount(0);

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

    test("ui-input — P203: legacy storeId/path migrates to a writeTo store binding on open; save drops the old pair", async ({ page, request }) => {
        // A pre-P203 node carrying the dead storeId+path write-target pair.
        const flow = appWithRoute(new FlowBuilder(), "inputMigApp")
            .node("ui-input", { id: "inputMig", label: "Name", storeId: "migStore", path: "name" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("inputMig");

        // The writeTo typedInput opens as a `store` target seeded with the store id.
        expect(await editor.readTypedInputType("writeToBinding")).toBe("store");
        const writeToValue = await editor.readTypedInput("writeToBinding");
        expect(writeToValue).toContain("migStore");
        // The literal path migrates into the store binding's subPath envelope.
        expect(writeToValue).toContain("name");

        await editor.save();

        // The saved node carries writeTo (kind store, migrated subPath) and NO
        // legacy storeId/path.
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("inputMig");
            return n ? { writeTo: n.writeTo, storeId: n.storeId, path: n.path } : null;
        });
        expect(saved).not.toBeNull();
        expect(saved?.writeTo).toMatchObject({
            kind: "store",
            path: "migStore",
            subPath: { kind: "literal", value: "name" }
        });
        // P229 (ADR 0038): the dead pair is DELETED on save (no longer blanked),
        // so the exported node carries no legacy fields at all.
        expect(saved?.storeId).toBeUndefined();
        expect(saved?.path).toBeUndefined();
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

    // P158 (ADR 0012): `rowsPath` plain text field became the `rows` STRUCTURAL
    // array value typedInput (the table renders its rows itself — a DATA SOURCE,
    // NOT a repeats case). `columns` stays a separate required field. The legacy
    // `rowsPath` migrates to a state binding; the visible widget is now
    // #node-input-rowsBinding.
    test("ui-table — columns required drives validity; rows typedInput present", async ({ page, request }) => {
        // Leave columns empty → columns is required, so node is invalid. `rows`
        // (data source) is optional.
        const flow = appWithRoute(new FlowBuilder(), "tblApp")
            .node("ui-table", { id: "tblEd", columns: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("tblEd");

        await editor.expectFields(["name", "mount", "columns", "rowsBinding", "events"]);
        expect(await editor.getValidationState("tblEd")).toBe("invalid");

        // Fill the required columns field → valid; configure rows; persists.
        await editor.fillField("columns", JSON.stringify([{ key: "name", label: "Name" }]));
        await editor.fillTypedInput("rowsBinding", "data.rows", "msg");
        await editor.save();
        expect(await editor.getValidationState("tblEd")).toBe("valid");

        await editor.openNode("tblEd");
        expect(await editor.readTypedInput("rowsBinding")).toBe("data.rows");
    });

    // P158: a legacy `rowsPath` plain string migrates into the `rows` typedInput
    // as a state binding (the typedInput value holds the migrated state path).
    test("ui-table — legacy rowsPath migrates into the rows typedInput", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "tblMigApp")
            .node("ui-table", {
                id: "tblMig",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rowsPath: "customers.list",
                // P229: the FlowBuilder default now emits the canonical `rows`
                // binding; suppress it so the legacy field is the only source.
                rows: undefined
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("tblMig");

        await editor.expectFields(["name", "mount", "columns", "rowsBinding", "events"]);
        expect(await editor.readTypedInput("rowsBinding")).toBe("customers.list");
    });

    test("ui-table — configured event surfaces as the output port label", async ({ page, request }) => {
        const flow = appWithRoute(new FlowBuilder(), "tblApp2")
            .node("ui-table", {
                id: "tblEd2",
                columns: JSON.stringify([{ key: "n", label: "N" }]),
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
            .node("ui-container", { id: "ctrV1", layout: "vertical", variant: "panel" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ctrV1");

        await editor.expectFields(["variant"]);
        const options = await editor.selectOptionValues("variant");
        expect(options).toEqual(["card", "panel", "section", "transparent", "span"]);
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
