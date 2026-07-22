import { test } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P215 (ADR 0031) — editor open→save round-trip for the `ui-component-instance`
 * `props` editableList.
 *
 * `props` is a hidden-carrier `editableList` field: the rows live in the
 * `#node-input-props-list` widget and `oneditsave` serialises them into the
 * hidden `#node-input-props` input. The clobber bug: if `oneditprepare` does not
 * seed both the list AND the hidden carrier from the saved `props`, Node-RED's
 * field-copy on Done writes the empty carrier back over `this.props`, wiping the
 * whole props map on the first edit. Runtime specs deploy `props` pre-set and
 * never drive the editor, so the round-trip clobber went uncaught.
 *
 * Removing the carrier-seed in `oneditprepare` (the
 * `$("#node-input-props").val(JSON.stringify(stored))` line) turns this red.
 */

const TAB = "e2e-flow";

function roundTripFlow(): NodeDef[] {
    // A minimal component flow: app + definition (one prop-bound ui-text child) +
    // an instance deployed with props pre-set. The instance keeps the LEGACY
    // `definitionId` reference (P259: proves back-compat; open→save migrates it
    // to the canonical `definition`); the assertion targets the `props` carrier.
    return [
        { id: TAB, type: "tab", label: "Component round-trip", disabled: false, info: "" },
        { type: "ui-app", id: "rtApp", name: "rtApp", title: "rtApp", root: "rtApp", layout: "app", z: TAB, x: 100, y: 100, wires: [[]] },
        { type: "ui-component-definition", id: "rtDef", name: "Card", z: TAB, x: 100, y: 160, wires: [[]] },
        {
            type: "ui-text",
            id: "rtDefTitle",
            name: "Card title",
            mount: "def:rtDef/content",
            order: 0,
            value: { kind: "prop", path: "title" },
            z: TAB,
            x: 100,
            y: 220,
            wires: [[]]
        },
        {
            type: "ui-component-instance",
            id: "rtInst",
            name: "Instance",
            app: "rtApp",
            mount: "rtApp.content",
            order: 0,
            definitionId: "rtDef",
            props: JSON.stringify({ title: { kind: "literal", value: "Alpha" } }),
            z: TAB,
            x: 100,
            y: 280,
            wires: [[]]
        }
    ];
}

test.describe("ui-component-instance — props editableList open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("props survive open→Done and a value-change round-trips", async ({ page, request }) => {
        await deployFlow(request, roundTripFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("rtInst", [
            {
                field: "props",
                carrier: "editableList",
                expected: JSON.stringify({ title: { kind: "literal", value: "Alpha" } }),
                newValue: JSON.stringify({ greeting: { kind: "literal", value: "Hello" } }),
                newItems: [{ name: "greeting", binding: { kind: "literal", value: "Hello" } }]
            }
        ]);
    });
});
