import { expect, type Page } from "@playwright/test";

/**
 * NodeEditorPage — page-object for driving the Node-RED EDITOR (canvas) at
 * port 1882 (P47). This is the only helper that interacts with the editor UI
 * rather than the rendered webapp output.
 *
 * Opening an editor panel: rather than drag-and-drop a node from the palette
 * (brittle, position-dependent) the established pattern in this repo is to
 * inject nodes into the canvas via the admin API (FlowBuilder + deployFlow)
 * and then open the panel programmatically through the editor's own API:
 *
 *     RED.editor.edit(RED.nodes.node(id))
 *
 * This is what the existing editor specs (editor-mount-options, parent-selector)
 * do; double-clicking the canvas SVG node resolves to the same RED.editor.edit
 * call but is far more flaky. openNode() therefore drives RED.editor.edit and
 * waits for the panel's tray to be visible.
 *
 * Validation state: Node-RED computes per-node validity from each field's
 * `required` / `validate` definition. After the editor tray's fields are bound,
 * `RED.nodes.node(id).valid` is true only when every required field is filled.
 * getValidationState() reads that flag — it reflects exactly the indicator the
 * editor renders (the red node badge / dirty marker) without scraping CSS.
 */

type REDNode = {
    valid?: boolean;
    validationErrors?: string[];
    [key: string]: unknown;
};

type REDGlobal = {
    nodes: {
        node: (id: string) => REDNode | null;
        eachNode: (cb: (n: REDNode) => void) => void;
        getType?: (type: string) => unknown;
    };
    editor: {
        edit: (node: REDNode) => void;
    };
    view?: { redraw?: (force?: boolean) => void };
    tray?: { close?: () => void };
};

declare global {
    // eslint-disable-next-line no-var
    var RED: REDGlobal;
}

export class NodeEditorPage {
    constructor(private readonly page: Page) {}

    /** Load the Node-RED editor and wait for the runtime API to be ready. */
    async open(): Promise<void> {
        await this.page.goto("/");
        await this.page.waitForLoadState("networkidle");
        await this.page.waitForFunction(() => {
            const red = (window as unknown as { RED?: REDGlobal }).RED;
            return Boolean(red?.nodes?.node && red?.editor?.edit);
        });
        await this.dismissWelcomeTour();
    }

    /**
     * Node-RED shows a first-run "welcome tour" overlay (.red-ui-tourGuide-shade)
     * that intercepts pointer events on the editor. Dismiss it if present so
     * panel buttons (Done/Deploy) are clickable.
     */
    private async dismissWelcomeTour(): Promise<void> {
        const shade = this.page.locator(".red-ui-tourGuide-shade");
        // Give the tour a moment to mount, then dismiss it if it appeared. The
        // tour has no dedicated close button — pressing Escape cancels it, which
        // is what RED.tourGuide binds the key to.
        await shade.first().waitFor({ state: "visible", timeout: 1500 }).catch(() => undefined);
        for (let i = 0; i < 5 && (await shade.count()) > 0; i++) {
            await this.page.keyboard.press("Escape").catch(() => undefined);
            await shade.first().waitFor({ state: "detached", timeout: 1000 }).catch(() => undefined);
        }
    }

    /**
     * Open the editor property panel for the node with the given id. The node
     * must already exist on the canvas (deploy a flow via the admin API first).
     * Resolves once the editor tray is on screen and its fields are bound.
     *
     * Includes a reload-once fallback: if the node is not found within 5 s the
     * editor page is reloaded (the admin-API deploy may have raced the previous
     * page load) and we wait a further 15 s before failing.
     */
    async openNode(nodeId: string): Promise<void> {
        const nodeReady = (id: string) => {
            const red = (window as unknown as { RED?: REDGlobal }).RED;
            return typeof red?.nodes?.node === "function" && red.nodes.node(id) !== null && red.nodes.node(id) !== undefined;
        };

        // First attempt: 5 s
        const found = await this.page
            .waitForFunction(nodeReady, nodeId, { timeout: 5000 })
            .then(() => true)
            .catch(() => false);

        if (!found) {
            // The editor may have loaded before the admin-API deploy completed.
            // Reload to pick up the current flow, then wait again.
            await this.page.reload();
            await this.page.waitForLoadState("networkidle");
            await this.dismissWelcomeTour();
            await this.page.waitForFunction(nodeReady, nodeId, { timeout: 20000 });
        }
        await this.page.evaluate((id) => {
            const node = RED.nodes.node(id);
            if (node) {
                RED.editor.edit(node);
            }
        }, nodeId);
        // The tray slides in; wait for the editor tray to appear (Node-RED 4.x).
        await expect(this.page.locator(".red-ui-tray").last()).toBeVisible();
        // Wait for the field to actually bind before the test reads it.
        await this.page.waitForTimeout(400);
    }

    /** Whether an `#node-input-<fieldId>` form control is present in the panel. */
    async hasField(fieldId: string): Promise<boolean> {
        return this.page.locator(`#node-input-${fieldId}`).count().then((c) => c > 0);
    }

    /** Assert that every named `#node-input-<fieldId>` control is present. */
    async expectFields(fieldIds: string[]): Promise<void> {
        for (const fieldId of fieldIds) {
            await expect(
                this.page.locator(`#node-input-${fieldId}`),
                `expected field #node-input-${fieldId} in editor panel`
            ).toHaveCount(1);
        }
    }

    /** Fill an `#node-input-<fieldId>` text/select field. */
    async fillField(fieldId: string, value: string): Promise<void> {
        const locator = this.page.locator(`#node-input-${fieldId}`);
        const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
        if (tagName === "select") {
            await locator.selectOption(value);
        } else {
            await locator.fill(value);
        }
    }

    /** Read the current value of an `#node-input-<fieldId>` field. */
    async readField(fieldId: string): Promise<string> {
        return this.page.locator(`#node-input-${fieldId}`).inputValue();
    }

    /** The `<option>` values of a `#node-input-<fieldId>` select (empty filtered out). */
    async selectOptionValues(fieldId: string): Promise<string[]> {
        return this.page.evaluate((id) => {
            const select = document.querySelector<HTMLSelectElement>(`#node-input-${id}`);
            return select ? Array.from(select.options).map((o) => o.value).filter((v) => v !== "") : [];
        }, fieldId);
    }

    /**
     * Return "valid" | "invalid" for the node currently being edited, based on
     * Node-RED's own validity flag (the same signal that drives the red node
     * badge). Saves the open panel first so pending field edits are validated.
     */
    async getValidationState(nodeId: string): Promise<"valid" | "invalid"> {
        const valid = await this.page.evaluate((id) => {
            const node = RED.nodes.node(id);
            return Boolean(node && node.valid);
        }, nodeId);
        return valid ? "valid" : "invalid";
    }

    /** Click the editor panel's Done button to persist field edits to the node. */
    async save(): Promise<void> {
        // Node-RED 4.x renders the editor tray's Done action as #node-dialog-ok
        // in the tray toolbar (the primary button). Wait for the tray to slide
        // out so a subsequent openNode binds to the persisted values.
        await this.page.locator("#node-dialog-ok").click();
        await this.page.locator(".red-ui-tray").first().waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
        await this.page.waitForTimeout(200);
    }

    /** Deploy the current canvas and wait for the success notification. */
    async deploy(): Promise<void> {
        await this.page.locator("#red-ui-header-button-deploy").click();
        // Node-RED shows a green "Successfully deployed" notification on success.
        await expect(this.page.locator(".red-ui-notification")).toBeVisible({ timeout: 10000 });
        await this.page.waitForTimeout(300);
    }

    /** The number of input ports the node renders on the canvas (0 or 1). */
    async inputPortCount(nodeId: string): Promise<number> {
        return this.page.evaluate((id) => {
            const node = RED.nodes.node(id) as { inputs?: number } | null;
            return node && typeof node.inputs === "number" ? node.inputs : 0;
        }, nodeId);
    }

    /** The output port labels the node exposes (from outputLabels / outputs). */
    async outputLabels(nodeId: string): Promise<string[]> {
        return this.page.evaluate((id) => {
            const node = RED.nodes.node(id) as
                | { outputs?: number; _def?: { outputLabels?: ((i: number) => string) | string[] } }
                | null;
            if (!node) {
                return [];
            }
            const count = typeof node.outputs === "number" ? node.outputs : 0;
            const def = node._def?.outputLabels;
            const labels: string[] = [];
            for (let i = 0; i < count; i++) {
                if (typeof def === "function") {
                    labels.push(def.call(node, i) || "");
                } else if (Array.isArray(def)) {
                    labels.push(def[i] || "");
                } else {
                    labels.push("");
                }
            }
            return labels;
        }, nodeId);
    }
}
