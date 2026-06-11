import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P47 — minimal editor-panel coverage for every remaining node type not given a
 * dedicated focus spec. Per the P47 scope: each "opens without crash, has the
 * expected core fields". Editor-only: no webapp URL is ever visited.
 *
 * The node is injected into a route via the admin API, its editor panel is
 * opened (RED.editor.edit), and we assert (a) the panel opened — i.e. the
 * mount/parent reference field its category uses is present — and (b) the node
 * exposes the expected input-port count.
 */

type Case = {
    type: string;
    /** `#node-input-<fieldId>` controls that must exist in the panel. */
    fields: string[];
    /** Expected input-port count (1 for interactive/most view nodes, 0 otherwise). */
    inputs: number;
    /** Extra config overrides so the injected node is well-formed. */
    overrides?: Record<string, unknown>;
};

// Stateless / display / interactive view nodes. All mount into a route, so the
// FlowBuilder default supplies `mount`; the panel exposes `#node-input-mount`.
const VIEW_CASES: Case[] = [
    { type: "ui-text", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-button", fields: ["name", "mount", "label"], inputs: 1 },
    { type: "ui-textarea", fields: ["name", "mount", "label"], inputs: 1 },
    { type: "ui-radio", fields: ["name", "mount", "label"], inputs: 1 },
    { type: "ui-switch", fields: ["name", "mount", "label"], inputs: 1 },
    { type: "ui-datepicker", fields: ["name", "mount", "labelBinding"], inputs: 1 },
    { type: "ui-slider", fields: ["name", "mount", "label"], inputs: 1 },
    { type: "ui-alert", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-avatar", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-badge", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-breadcrumb", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-empty-state", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-icon", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-image", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-progress", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-skeleton", fields: ["name", "mount"], inputs: 1 },
    // P139 (ADR 0015): ui-divider is the base-field reference node — the
    // injected "Allgemein" group adds visible/disabled/color/size controls
    // (disabled + size rendered N/A). Dedicated coverage: base-fields.spec.ts.
    // P150: label typedInput added — lives on #node-input-label.
    { type: "ui-divider", fields: ["name", "mount", "label", "visibleBinding", "disabledBinding", "colorBinding", "size"], inputs: 0 },
    // Composite / layout nodes.
    { type: "ui-container", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-accordion", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-list", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-menu", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-pagination", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-stepper", fields: ["name", "mount"], inputs: 1 },
    { type: "ui-tabs", fields: ["name", "mount"], inputs: 1 }
];

test.describe("editor panels — minimal coverage (P47)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    for (const testCase of VIEW_CASES) {
        test(`${testCase.type} — opens without crash, has expected fields`, async ({ page, request }) => {
            const nodeId = `${testCase.type}-ed`;
            const flow = new FlowBuilder()
                .app({ id: "covApp", root: "covApp", name: "Coverage App" })
                .node(testCase.type, { id: nodeId, ...(testCase.overrides ?? {}) })
                .build();
            await deployFlow(request, flow);

            const editor = new NodeEditorPage(page);
            await editor.open();
            await editor.openNode(nodeId);

            await editor.expectFields(testCase.fields);
            expect(await editor.inputPortCount(nodeId)).toBe(testCase.inputs);
        });
    }

    // ui-toast mounts via `parent` (app-scoped), not a route slot.
    // NOTE: ui-toast's editor wires its App selector through
    // installReferenceSelectors({ parent: "ui-app" }), but that helper has no
    // `parent` branch, so the select is never populated with app options (a
    // pre-existing editor bug, not a P47 deliverable). The minimal P47 contract
    // is "opens without crash, has the expected fields", which this asserts.
    test("ui-toast — opens without crash, has expected fields", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp", root: "toastApp", name: "Toast App" })
            .node("ui-toast", { id: "toastEd" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("toastEd");

        await editor.expectFields(["name", "parent"]);
        // The node's stored parent reference is intact even though the selector
        // does not enumerate it (see note above).
        const parent = await page.evaluate(() => {
            const n = (window as unknown as { RED: { nodes: { node: (id: string) => { parent?: string } | null } } }).RED.nodes.node("toastEd");
            return n?.parent;
        });
        expect(parent).toBe("toastApp");
    });
});
