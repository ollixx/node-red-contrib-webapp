import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * Owner (2026-07-10): a ui-component-instance's `props` map is never saved — the
 * component renders nothing because `prop.<name>` resolves to undefined. Root
 * cause: the panel has a hidden `#node-input-props` input AND `props` in
 * `defaults`, so Node-RED's field-copy overwrites the `this.props` that oneditsave
 * built with the (empty) hidden input's value. oneditsave must serialise into the
 * hidden input so the props map actually persists.
 *
 * The editableList row accessor (getRow) already returns the right data — proven
 * inline below — so the bug is purely the post-oneditsave clobber; the fix is
 * writing the serialised map into the hidden carrier.
 */

test.describe("ui-component-instance persists its props map on save", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("adding a prop and saving persists it (not clobbered to empty)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ciApp", root: "ciApp" })
            .node("ui-component-definition", { id: "ciDef", name: "Card" })
            .node("ui-text", { id: "ciChild", mount: "def:ciDef/content", value: { kind: "prop", path: "text" } })
            .node("ui-component-instance", { id: "ciInst", parent: "ciApp", mount: "ciApp.content", definitionId: "ciDef", props: "" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ciInst");

        // Add a prop row via the editableList's own addItem (the same callback the
        // add button uses); confirm the row accessor captures it correctly.
        const captured = await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { editableList: (...a: unknown[]) => unknown; each: (f: () => void) => void; data: (k: string) => unknown } }).$;
            $("#node-input-props-list").editableList("addItem", { name: "text", binding: { kind: "literal", value: "Hallo" } });
            const items = $("#node-input-props-list").editableList("items") as { each: (f: (this: unknown) => void) => void };
            let row: unknown = null;
            items.each(function (this: unknown) {
                const fn = ($(this as unknown as string) as unknown as { data: (k: string) => unknown }).data("getRow");
                if (typeof fn === "function") row = (fn as () => unknown)();
            });
            return row;
        });
        expect(captured).toMatchObject({ name: "text", binding: { kind: "literal", value: "Hallo" } });

        // Force the node dirty via a real tracked input so Node-RED definitely runs
        // the save path (oneditsave + field-copy), then save.
        await page.fill("#node-input-name", "Renamed");
        await editor.save();

        const savedProps = await page.evaluate(() => {
            const n = (window as unknown as { RED: { nodes: { node: (i: string) => { props?: unknown } | null } } }).RED.nodes.node("ciInst");
            return n ? n.props : null;
        });

        const asObj = typeof savedProps === "string" ? JSON.parse(savedProps || "{}") : (savedProps || {});
        expect(Object.keys(asObj)).toContain("text");
        expect(asObj.text).toMatchObject({ kind: "literal", value: "Hallo" });
    });
});
