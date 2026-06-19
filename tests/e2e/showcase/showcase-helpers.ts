import type { APIRequestContext, Page } from "@playwright/test";

import { deployFlow, resetFlow } from "../../helpers/admin-api";
import { gotoEditor, waitForNodeTypes } from "../../helpers/editor-ready";
import { WebappPage } from "../../helpers/webapp-page";

export type { NodeDef } from "../../helpers/admin-api";
export { FlowBuilder } from "../../helpers/flow-builder";
export { deployFlow, resetFlow, gotoEditor, waitForNodeTypes, WebappPage };

/**
 * Showcase-Helfer (P187, ADR 0022 §2).
 *
 * A thin layer over the existing E2E harness that supports the
 * fixture-driven, paced "feature-tour" format:
 *
 *   1. Import (deploy) a flow fixture.
 *   2. Open the running webapp.
 *   3. Walk through features in named `test.step` chapters (readable as
 *      chapters in the Playwright trace and showcase video).
 *   4. Optionally open a node's config dialog in the editor so the
 *      typedInput fields are visible on camera.
 *
 * Showcase specs are regular Playwright specs — they pass on every run
 * and produce particularly good video when SHOWCASE=1 is set (P186).
 *
 * ## Pattern for a showcase spec
 *
 * ```ts
 * import { test, expect } from "@playwright/test";
 * import { ShowcaseFlow, FlowBuilder } from "../showcase/showcase-helpers";
 *
 * test("ui-foo showcase", async ({ page, request }) => {
 *   const sf = new ShowcaseFlow(page, request);
 *   const flow = new FlowBuilder().app({ id: "fooApp", root: "fooApp" })
 *     .node("ui-foo", { id: "foo1", ... }).build();
 *   await sf.deploy(flow);
 *
 *   const app = await sf.openApp("fooApp");
 *
 *   await test.step("Feature A — plain items", async () => {
 *     await expect(page.locator(".webapp-foo")).toBeVisible();
 *   });
 *
 *   // Config-dialog cameo: open the editor, show fields, return to app.
 *   await sf.openEditor(["ui-foo"]);
 *   await test.step("Config dialog — items field", async () => {
 *     await sf.openNodeConfig("foo1");
 *     // assertions about editor fields here
 *     await sf.closeNodeConfig();
 *   });
 * });
 * ```
 *
 * ## Rollout to new nodes
 *
 * 1. Create `tests/e2e/showcase/<node>.showcase.spec.ts`.
 * 2. Build a self-contained flow (ui-app + the node + helpers).
 * 3. Wrap each feature in a named `test.step`.
 * 4. Add an editor cameo via `openEditor` + `openNodeConfig`.
 * 5. Reference this spec from the node's `*.tests.md` catalogue.
 *
 * See P187 pilot specs as the canonical examples.
 */

/**
 * ShowcaseFlow — thin coordinator for a showcase spec session.
 *
 * Wraps deploy + app navigation so each showcase spec has a one-liner
 * setup and can focus on the `test.step` feature tour.
 */
export class ShowcaseFlow {
    private editorOpened = false;

    constructor(
        private readonly page: Page,
        private readonly request: APIRequestContext
    ) {}

    /**
     * Deploy `nodes` as the complete flow on the E2E instance.
     * Returns `this` for chaining.
     */
    async deploy(nodes: Parameters<typeof deployFlow>[1]): Promise<this> {
        await deployFlow(this.request, nodes);
        return this;
    }

    /** Reset the E2E instance to an empty flow (use in afterEach). */
    async reset(): Promise<void> {
        await resetFlow(this.request);
    }

    /**
     * Open the webapp at `/webapp/<appId>/` and wait for the SSE stream.
     * Returns the WebappPage helper for assertions.
     */
    async openApp(appId: string, path = "/"): Promise<WebappPage> {
        const app = new WebappPage(this.page, appId);
        await app.navigate(path);
        return app;
    }

    /**
     * Open the Node-RED editor and wait for node-type registration.
     *
     * Call before `openNodeConfig`. After this the editor is the active
     * page — call `openApp` again to return to the webapp view.
     *
     * Optional `types` narrows the wait list (defaults to all core types).
     */
    async openEditor(types?: readonly string[]): Promise<void> {
        await gotoEditor(this.page, types);
        this.editorOpened = true;
    }

    /**
     * Open a node's config dialog in the already-open editor.
     *
     * The dialog is driven via `RED.editor.edit(RED.nodes.node(id))` — the
     * same programmatic path the editor specs use, which avoids brittle
     * canvas double-click positioning. Waits for the tray to be visible so
     * the fields are on-screen before the next step continues.
     *
     * Call `openEditor()` first. After this the editor tray is open; close it
     * with `closeNodeConfig()` or navigate away to continue the webapp tour.
     *
     * @param nodeId   Node-RED node id (as set in the flow fixture).
     * @param pauseMs  Optional dwell time (ms) to let the video "read" the
     *                 dialog.  Default 600 ms — readable at normal playback.
     */
    async openNodeConfig(nodeId: string, pauseMs = 600): Promise<void> {
        if (!this.editorOpened) {
            throw new Error(
                "ShowcaseFlow.openNodeConfig() called before openEditor(). " +
                "Call openEditor() first so the Node-RED editor is loaded."
            );
        }

        // Wait until the node is registered in the editor graph.
        // Reload-once fallback mirrors NodeEditorPage.openNode.
        const waitForNode = async (id: string): Promise<boolean> =>
            this.page
                .waitForFunction(
                    (nid: string) => {
                        const red = (window as { RED?: { nodes?: { node?: (id: string) => unknown } } }).RED;
                        return typeof red?.nodes?.node === "function" && red.nodes.node(nid) != null;
                    },
                    id,
                    { timeout: 5000 }
                )
                .then(() => true)
                .catch(() => false);

        const found = await waitForNode(nodeId);
        if (!found) {
            await this.page.reload();
            await this.page.waitForLoadState("networkidle");
            await waitForNodeTypes(this.page);
            await waitForNode(nodeId);
        }

        await this.page.evaluate((id: string) => {
            const red = (window as {
                RED: {
                    nodes: { node: (id: string) => unknown };
                    editor: { edit: (node: unknown) => void };
                };
            }).RED;
            const node = red.nodes.node(id);
            if (node) {
                red.editor.edit(node);
            }
        }, nodeId);

        // Wait for the tray to slide in.
        const { expect } = await import("@playwright/test");
        await expect(this.page.locator(".red-ui-tray").last()).toBeVisible();

        // Dwell so the video can "read" the open dialog.
        if (pauseMs > 0) {
            await this.page.waitForTimeout(pauseMs);
        }
    }

    /**
     * Close the node config dialog (tray) if one is open.
     * Safe to call even if no tray is visible.
     */
    async closeNodeConfig(): Promise<void> {
        const ok = this.page.locator("#node-dialog-ok");
        const count = await ok.count();
        if (count > 0) {
            await ok.click();
            await this.page
                .locator(".red-ui-tray")
                .first()
                .waitFor({ state: "detached", timeout: 5000 })
                .catch(() => undefined);
        }
    }
}
