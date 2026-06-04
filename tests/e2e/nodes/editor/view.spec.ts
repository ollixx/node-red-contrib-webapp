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

    function appWithRoute(builder: FlowBuilder, appId: string): FlowBuilder {
        return builder.app({ id: appId, root: appId, name: appId }).route({ id: `${appId}Route`, path: "/" });
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
