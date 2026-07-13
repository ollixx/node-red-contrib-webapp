import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * Owner (2026-07-13): ui-store-action does not save its store reference. Root
 * cause: installReferenceSelectors' `store` branch seeds the picker from
 * `self.storeId || self.params` (the legacy ui-query field names), not this node's
 * `store` field. So on open the hidden `#node-input-store` is seeded to "", and
 * Node-RED's field-copy then clobbers `this.store` back to "" on save — the
 * reference is lost on any edit. The runtime specs deploy `store` pre-set and never
 * drive the editor, so the round-trip clobber went uncaught.
 */

test.describe("ui-store-action persists its store reference across open→save", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("opening and saving keeps the store reference", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "saApp", root: "saApp" })
            .node("ui-store", { id: "saStore", parent: "saApp", statePath: "entity", initialValue: JSON.stringify({ name: "A" }) })
            .node("ui-store-action", { id: "saAction", parent: "saApp", store: "saStore", op: "set", path: "name", mode: "reference" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("saAction");

        // The picker must show the stored reference (seeded from `store`, not the
        // legacy storeId/params fields).
        const seeded = await page.evaluate(() => {
            const el = document.querySelector("#node-input-store") as HTMLInputElement | HTMLSelectElement | null;
            return el ? el.value : null;
        });
        expect(seeded).toBe("saStore");

        // Force dirty and save; the reference must survive.
        await page.fill("#node-input-name", "Renamed");
        await editor.save();

        const savedStore = await page.evaluate(() => {
            const n = (window as unknown as { RED: { nodes: { node: (i: string) => { store?: unknown } | null } } }).RED.nodes.node("saAction");
            return n ? n.store : null;
        });
        expect(savedStore).toBe("saStore");
    });
});
