import { expect, type Page } from "@playwright/test";

import { waitForNodeTypes } from "./editor-ready";

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

/**
 * The DOM shape of a hidden-carrier field, per ADR 0031. Both persist their
 * value through a hidden `#node-input-<field>` control, but they are seeded and
 * driven differently:
 *
 *  - `"picker"`     — an `installReferenceSelectors` / `installPickerField`
 *                     reference field. The carrier is an option-less `<select>`
 *                     (or `<input>`) that `oneditprepare` seeds from the saved
 *                     property; a new value is driven by setting the carrier and
 *                     firing `change` (exactly what the picker dialog's onSelect
 *                     does). No `oneditsave` rebuilds it — the carrier IS the
 *                     source of truth on Done.
 *  - `"editableList"` — an `editableList` widget (`#node-input-<field>-list`)
 *                     whose rows `oneditsave` serialises into the hidden
 *                     `#node-input-<field>` input. The seeded value is JSON; a
 *                     new value is driven by repopulating the list via the
 *                     widget's own `addItem` so `oneditsave` re-serialises it.
 */
export type RoundTripCarrier = "picker" | "editableList";

export interface RoundTripField {
    /** Carrier field id, e.g. `"store"` or `"props"` (drives `#node-input-<field>`). */
    field: string;
    /**
     * The value the field was deployed with (pre-set via the admin API). For a
     * `"picker"` this is the referenced node id; for an `"editableList"` it is
     * the serialised JSON carrier string. The harness asserts the carrier is
     * seeded to this on open and that it survives Done unchanged.
     */
    expected: string;
    /** Carrier DOM shape. Defaults to `"picker"`. */
    carrier?: RoundTripCarrier;
    /**
     * Optional value-change to round-trip. When present the harness drives this
     * NEW value through the editor, saves, reopens, and asserts it persisted —
     * proving the round-trip in both directions, not only initial preservation.
     * For a `"picker"` it is the new node id. For an `"editableList"` it is the
     * expected serialised carrier string AND `newItems` supplies the widget rows.
     */
    newValue?: string;
    /**
     * For an `"editableList"` value-change: the item-data objects to feed the
     * widget's `addItem` (the same shape the node's `addItem` expects, e.g.
     * `{ name, binding }`). Ignored for `"picker"` carriers.
     */
    newItems?: unknown[];
}

type EditorWindow = Window & {
    RED?: REDGlobal;
    $?: (sel: string) => {
        is: (sel: string) => boolean;
        find: (sel: string) => { length: number };
        append: (html: string) => unknown;
        val: (v?: string) => string;
        trigger: (evt: string) => unknown;
        editableList: (...a: unknown[]) => unknown;
    };
};

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
        // The API existing does not mean node-type definitions are registered;
        // wait for the registry to settle so getType()/editor defaults are stable.
        await waitForNodeTypes(this.page);
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

    /**
     * Set the value (and optional type) of an `#node-input-<fieldId>` control
     * that has been turned into a Node-RED `typedInput` widget. After
     * `$(input).typedInput(...)` the original `<input>` is hidden and the widget
     * renders its own visible text box, so a plain `fill()` no longer drives it.
     * The widget's jQuery API (`typedInput("value", ...)`/`"type"`) writes back
     * to the underlying input and fires the change events the editor relies on.
     */
    async fillTypedInput(fieldId: string, value: string, type = "str"): Promise<void> {
        await this.page.evaluate(
            (args: { id: string; value: string; type: string }) => {
                const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
                const el = $(`#node-input-${args.id}`);
                el.typedInput("type", args.type);
                el.typedInput("value", args.value);
            },
            { id: fieldId, value, type }
        );
    }

    /** Read the value of an `#node-input-<fieldId>` `typedInput` widget. */
    async readTypedInput(fieldId: string): Promise<string> {
        return this.page.evaluate((id) => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($(`#node-input-${id}`).typedInput("value") ?? "");
        }, fieldId);
    }

    /** Read the selected type of an `#node-input-<fieldId>` `typedInput` widget. */
    async readTypedInputType(fieldId: string): Promise<string> {
        return this.page.evaluate((id) => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($(`#node-input-${id}`).typedInput("type") ?? "");
        }, fieldId);
    }

    /** The `<option>` values of a `#node-input-<fieldId>` select (empty filtered out). */
    async selectOptionValues(fieldId: string): Promise<string[]> {
        return this.page.evaluate((id) => {
            const select = document.querySelector<HTMLSelectElement>(`#node-input-${id}`);
            return select ? Array.from(select.options).map((o) => o.value).filter((v) => v !== "") : [];
        }, fieldId);
    }

    /**
     * The candidate VALUES a picker preset offers for the live editor graph
     * (P114 / ADR 0009). Reference fields no longer carry their candidates as
     * `<option>`s — the picker dialog renders them from
     * `nodePickerOptionsForPreset(preset)`. Specs that used to read a reference
     * `<select>`'s options assert against this instead.
     */
    async pickerPresetValues(preset: string): Promise<string[]> {
        return this.page.evaluate((p) => {
            const C = (window as unknown as {
                WebappEditorCommon: { nodePickerOptionsForPreset: (preset: string) => Array<{ value: string }> };
            }).WebappEditorCommon;
            return C.nodePickerOptionsForPreset(p).map((o) => o.value);
        }, preset);
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

    // ───────────────────────────────────────────────────────────────────────
    // Editor open→save round-trip harness (ADR 0031 / P215)
    //
    // The editor open→save clobber bug class: a reference/picker/editableList
    // field lives in a hidden `#node-input-<field>` carrier; if `oneditprepare`
    // fails to seed that carrier from the saved config, Node-RED's field-copy on
    // Done writes the empty carrier back over the real property — silently losing
    // the value on the first edit. Runtime/behaviour specs never catch it because
    // they deploy config pre-set via the admin API and never drive the editor.
    //
    // assertEditorRoundTrip drives the FULL round-trip through the real editor so
    // specs do not re-implement open/save/re-read. See ADR 0031 and
    // `.ai/agents/node-testing.md` for the standard this enforces.
    // ───────────────────────────────────────────────────────────────────────

    /** Read the raw string value of the hidden `#node-input-<field>` carrier. */
    private async readCarrier(field: string): Promise<string> {
        return this.page.evaluate((id) => {
            const el = document.querySelector(`#node-input-${id}`) as
                | HTMLInputElement
                | HTMLSelectElement
                | null;
            return el ? String(el.value ?? "") : "";
        }, field);
    }

    /** Read the persisted `RED.nodes.node(id)[field]` value after Done. */
    private async readPersisted(nodeId: string, field: string): Promise<string> {
        return this.page.evaluate(
            (args: { nodeId: string; field: string }) => {
                const node = RED.nodes.node(args.nodeId) as Record<string, unknown> | null;
                const value = node ? node[args.field] : undefined;
                return value == null ? "" : String(value);
            },
            { nodeId, field }
        );
    }

    /**
     * Assert two carrier values are equal. For editableList carriers the value is
     * a serialised JSON object, so compare structurally (key order is irrelevant);
     * pickers compare as plain strings.
     */
    private assertCarrierEquals(
        carrier: RoundTripCarrier,
        actual: string,
        expected: string,
        message: string
    ): void {
        if (carrier === "editableList") {
            expect(JSON.parse(actual || "{}"), message).toEqual(JSON.parse(expected || "{}"));
        } else {
            expect(actual, message).toBe(expected);
        }
    }

    /** Force the open panel dirty via the node's Name field (a field NOT under test). */
    private async forceDirty(): Promise<void> {
        const name = this.page.locator("#node-input-name");
        const current = await name.inputValue().catch(() => "");
        await name.fill(`${current} ~rt`);
    }

    /** Drive a NEW value into a `"picker"` carrier (mirrors the picker dialog's onSelect). */
    private async drivePicker(field: string, value: string): Promise<void> {
        await this.page.evaluate(
            (args: { field: string; value: string }) => {
                const $ = (window as EditorWindow).$;
                if (!$) {
                    return;
                }
                const el = $(`#node-input-${args.field}`);
                // A <select> only holds a value it has an <option> for; the picker
                // template ships option-less, so add the option before selecting.
                if (el.is("select") && args.value && el.find(`option[value="${args.value}"]`).length === 0) {
                    el.append(`<option value="${args.value}">${args.value}</option>`);
                }
                el.val(args.value);
                el.trigger("change");
            },
            { field, value }
        );
    }

    /** Drive a NEW value into an `"editableList"` carrier via the widget's own addItem. */
    private async driveEditableList(field: string, items: unknown[]): Promise<void> {
        await this.page.evaluate(
            (args: { field: string; items: unknown[] }) => {
                const $ = (window as EditorWindow).$;
                if (!$) {
                    return;
                }
                const list = $(`#node-input-${args.field}-list`);
                list.editableList("empty");
                for (const item of args.items) {
                    list.editableList("addItem", item);
                }
            },
            { field, items }
        );
    }

    /**
     * Editor open→save round-trip proof for hidden-carrier reference/picker/
     * editableList fields (ADR 0031). The node must already be deployed with each
     * field pre-set (via the admin API). For every field this call:
     *
     *   (a) seeded-on-open — after `openNode`, fails if `#node-input-<field>` is
     *       EMPTY (proves `oneditprepare` seeded the carrier);
     *   (b) survives Done — forces the panel dirty (Name field), clicks Done, and
     *       asserts the persisted `RED.nodes.node(id)[field]` still equals the
     *       pre-set value (not `""`) — removing the seed logic turns this red;
     *   (c) value-change round-trips — for fields with a `newValue`, drives the new
     *       value through the picker/editableList, saves, reopens, and asserts the
     *       new value persisted (both directions).
     *
     * One call performs the whole round-trip; specs must not re-implement
     * open/save/re-read. `open()` must have been called first.
     */
    async assertEditorRoundTrip(nodeId: string, fields: RoundTripField[]): Promise<void> {
        // ── Phase A: seeded-on-open + survives Done unchanged ──────────────────
        await this.openNode(nodeId);
        for (const f of fields) {
            const carrier = f.carrier ?? "picker";
            const seeded = await this.readCarrier(f.field);
            expect(
                seeded,
                `#node-input-${f.field} must be seeded on open (oneditprepare) — a regression of the open→save clobber makes it empty`
            ).not.toBe("");
            this.assertCarrierEquals(
                carrier,
                seeded,
                f.expected,
                `#node-input-${f.field} must be seeded to the deployed value on open`
            );
        }

        await this.forceDirty();
        await this.save();

        for (const f of fields) {
            const carrier = f.carrier ?? "picker";
            const persisted = await this.readPersisted(nodeId, f.field);
            expect(
                persisted,
                `${f.field} must survive Done (not clobbered to "" by the field-copy)`
            ).not.toBe("");
            this.assertCarrierEquals(
                carrier,
                persisted,
                f.expected,
                `${f.field} must equal the pre-set value after Done`
            );
        }

        // ── Phase B: value-change round-trips (both directions) ────────────────
        const changed = fields.filter((f) => f.newValue !== undefined);
        if (changed.length === 0) {
            return;
        }

        await this.openNode(nodeId);
        for (const f of changed) {
            const carrier = f.carrier ?? "picker";
            if (carrier === "editableList") {
                await this.driveEditableList(f.field, f.newItems ?? []);
            } else {
                await this.drivePicker(f.field, f.newValue as string);
            }
        }
        await this.save();

        for (const f of changed) {
            const carrier = f.carrier ?? "picker";
            const persisted = await this.readPersisted(nodeId, f.field);
            this.assertCarrierEquals(
                carrier,
                persisted,
                f.newValue as string,
                `${f.field} must persist the new value after Done`
            );
        }

        // Reopen: the new value must re-seed the carrier (proves seed-on-open works
        // for the changed value too, i.e. the round-trip closes in both directions).
        await this.openNode(nodeId);
        for (const f of changed) {
            const carrier = f.carrier ?? "picker";
            const reseeded = await this.readCarrier(f.field);
            this.assertCarrierEquals(
                carrier,
                reseeded,
                f.newValue as string,
                `${f.field} must re-seed the carrier with the new value on reopen`
            );
        }
    }
}
