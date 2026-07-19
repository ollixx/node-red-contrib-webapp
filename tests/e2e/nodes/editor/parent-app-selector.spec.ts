import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * Bug (Owner, 2026-07-05): a ui-store's App reference (`parent`) got seeded to
 * the node's OWN id when no app was chosen — `installParentAppSelector` used
 * `seedValue: self.parent || self.id || ""`. A store saved that way carries
 * `parent === <its own id>`, so every reference picker (which filters
 * `store.parent === appId`) silently drops it — e.g. the "Entity Editor" store
 * vanished from a ui-input's Store selector while sibling stores remained.
 *
 * The App selector must NEVER seed the node's own id: a fresh/empty `parent`
 * seeds "", and an already-corrupted `parent === self.id` self-heals to "" so
 * the user is prompted to pick the real app. Applies to every node that uses
 * installParentAppSelector (ui-store/ui-query/ui-action/ui-dialog/ui-route);
 * proven here on ui-store where the owner hit it.
 */

test.describe("editor — App parent selector never seeds the node's own id", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openStore(
        page: import("@playwright/test").Page,
        request: import("@playwright/test").APIRequestContext,
        storeProps: Record<string, unknown>,
    ) {
        const flow = new FlowBuilder()
            .app({ id: "pasApp", root: "pasApp", name: "Parent Selector App" })
            .node("ui-store", { id: "pasStore", statePath: "slice", ...storeProps })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("pasStore");
        return editor;
    }

    test("a fresh ui-store with empty parent seeds '' (not its own id)", async ({ page, request }) => {
        const editor = await openStore(page, request, { parent: "" });
        // #node-input-parent is the hidden value carrier the picker seeds.
        expect(await editor.readField("parent")).toBe("");
    });

    test("an already-corrupted parent === self.id self-heals to '' on open", async ({ page, request }) => {
        const editor = await openStore(page, request, { parent: "pasStore" });
        expect(await editor.readField("parent")).toBe("");
    });

    test("a valid app parent is preserved (not cleared)", async ({ page, request }) => {
        const editor = await openStore(page, request, { parent: "pasApp" });
        expect(await editor.readField("parent")).toBe("pasApp");
    });

    // The seed fix alone leaves an appless node silently empty — it must instead
    // be a deploy-blocking error. `parent` is required on every app-owned node.
    test("a ui-store with no app parent is INVALID (deploy-blocking error)", async ({ page, request }) => {
        const editor = await openStore(page, request, { parent: "" });
        expect(await editor.getValidationState("pasStore")).toBe("invalid");
    });

    test("a ui-store WITH an app parent is valid", async ({ page, request }) => {
        const editor = await openStore(page, request, { parent: "pasApp" });
        expect(await editor.getValidationState("pasStore")).toBe("valid");
    });
});
