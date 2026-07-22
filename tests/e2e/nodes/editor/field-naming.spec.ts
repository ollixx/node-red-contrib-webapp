import { expect, test, type Page } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { gotoEditor } from "../../../helpers/editor-ready";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P229 (ADR 0038) — legacy-field sweep: migration harness.
 *
 * The legacy editor fields are REMOVED from the authored `defaults` blocks; the
 * open-time migrations stay. Registration injects hidden migration-only defaults
 * (`migrationFields`, see editor-common.js `withMigrationDefaults`) so a legacy
 * flow still imports its legacy values into the editor, the `oneditprepare`
 * migration lifts them into the canonical field, and `oneditsave` DELETES the
 * legacy field so the saved node exports without it.
 *
 * Slice A — the dead pre-ADR-0027 input write-target pair `storeId`/`path`
 * (8 input nodes). A legacy flow opens showing the migrated `writeTo` store
 * binding and saves WITHOUT the legacy pair.
 */

/** Read selected fields off the live editor node config after a save. */
async function readNode(page: Page, nodeId: string, fields: string[]): Promise<Record<string, unknown>> {
    return page.evaluate((args) => {
        const node = RED.nodes.node(args.nodeId) as Record<string, unknown> | null;
        const out: Record<string, unknown> = {};
        if (node) {
            for (const f of args.fields) {
                out[f] = node[f];
            }
        }
        return out;
    }, { nodeId, fields });
}

// ─── Slice A — dead `storeId`/`path` pair on the 8 input nodes ───────────────

const STORE_WRITE_NODES = [
    "ui-input",
    "ui-select",
    "ui-checkbox",
    "ui-radio",
    "ui-switch",
    "ui-textarea",
    "ui-datepicker",
    "ui-slider"
] as const;

const APP_A = "fnaApp";
const STORE_A = "fnaStore";

/** One legacy flow: every input node carries the dead storeId/path pair. */
function legacyStoreWriteFlow() {
    const builder = new FlowBuilder().app({ id: APP_A, root: APP_A });
    builder.node("ui-store", { id: STORE_A, statePath: "draft", initialValue: "{}" });
    for (const type of STORE_WRITE_NODES) {
        const id = nodeIdFor(type);
        builder.node(type, {
            id,
            storeId: STORE_A,
            path: `sub_${id}`
        });
    }
    return builder.build();
}

function nodeIdFor(type: string): string {
    return `fna_${type.replace(/^ui-/, "")}`;
}

test.describe("P229 slice A — dead storeId/path pair migrates to writeTo", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with storeId/path still renders (runtime migration intact)", async ({ page, request }) => {
        await deployFlow(request, legacyStoreWriteFlow());

        const webapp = new WebappPage(page, APP_A);
        await webapp.navigate("/");
        // The runtime `legacyStoreWriteTo` migration keeps the legacy configs
        // valid — every control mounts and renders. (`first()`: the datepicker
        // renders an inner sl-input of its own.)
        await expect(page.locator("sl-input").first()).toBeVisible();
        await expect(page.locator("sl-select").first()).toBeVisible();
        await expect(page.locator("sl-checkbox").first()).toBeVisible();
        await expect(page.locator("sl-radio-group").first()).toBeVisible();
        await expect(page.locator("sl-switch").first()).toBeVisible();
        await expect(page.locator("sl-textarea").first()).toBeVisible();
        await expect(page.locator("sl-range").first()).toBeVisible();
    });

    for (const type of STORE_WRITE_NODES) {
        test(`${type}: opens showing migrated writeTo, saves WITHOUT storeId/path`, async ({ page, request }) => {
            await deployFlow(request, legacyStoreWriteFlow());
            await gotoEditor(page);
            const editor = new NodeEditorPage(page);
            const id = nodeIdFor(type);

            await editor.openNode(id);
            // Open-time migration: the writeTo typedInput shows the store target
            // built from the legacy pair (store id + literal subPath envelope).
            expect(await editor.readTypedInputType("writeToBinding")).toBe("store");
            const carrier = await editor.readTypedInput("writeToBinding");
            expect(carrier).toContain(STORE_A);
            expect(carrier).toContain(`sub_${id}`);

            await editor.save();
            const n = await readNode(page, id, ["writeTo", "storeId", "path"]);
            expect(n.writeTo, `${type} writeTo migrated`).toMatchObject({
                kind: "store",
                path: STORE_A,
                subPath: { kind: "literal", value: `sub_${id}` }
            });
            expect(n.storeId, `${type} legacy storeId dropped`).toBeUndefined();
            expect(n.path, `${type} legacy path dropped`).toBeUndefined();
        });
    }
});
