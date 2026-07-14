import { expect, test, type Page } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { gotoEditor } from "../../../helpers/editor-ready";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P228 (ADR 0038) — reference-field naming normalization with back-compat.
 *
 * The owning-app / layout / route / definition references were renamed to the
 * canonical bare names `app` / `layout` / `route` / `definition` (from the legacy
 * `parent` / `layoutId` / `routeId` / `definitionId`). The rename is
 * back-compatible: the runtime reads the canonical field with a legacy fallback,
 * and the editor lifts the legacy value into the canonical field on open and
 * drops the legacy alias on save (`withUiIdMigration` in editor-common.js).
 *
 * This spec deploys a fully PRE-RENAME flow (every reference uses the legacy
 * field name) and proves the two acceptance guarantees:
 *   1. it RENDERS UNCHANGED (the runtime resolves the legacy fields), and
 *   2. opening + saving each node MIGRATES it to the canonical field and drops
 *      the legacy alias (open→Done round-trip).
 */

const TAB = "e2e-flow";
const APP = "fnApp";

/** A pre-rename flow: parent / layoutId / routeId / definitionId throughout. */
function legacyFlow(): NodeDef[] {
    return [
        { id: TAB, type: "tab", label: "P228 field-naming", disabled: false, info: "" },
        { type: "ui-app", id: APP, uiId: APP, name: "Legacy App", title: "Legacy App", root: APP, layout: "app", z: TAB, x: 100, y: 80, wires: [[]] },
        // ui-route: legacy parent + layoutId
        { type: "ui-route", id: "fnRoute", uiId: "fnRoute", name: "Page", parent: APP, path: "/page", title: "Page", layoutId: "vertical", events: "[]", outputs: 0, z: TAB, x: 100, y: 160, wires: [] },
        // ui-container: legacy parent + layoutId
        { type: "ui-container", id: "fnContainer", uiId: "fnContainer", name: "Card", parent: APP, mount: "route:/page/content", layoutId: "vertical", z: TAB, x: 100, y: 220, wires: [[]] },
        // view node (ui-text): legacy parent, no picker UI for app
        { type: "ui-text", id: "fnText", uiId: "fnText", name: "Text", parent: APP, mount: "container:fnContainer/content", text: "Legacy renders", z: TAB, x: 100, y: 280, wires: [[]] },
        // ui-dialog: legacy parent + layoutId + routeId
        { type: "ui-dialog", id: "fnDialog", uiId: "fnDialog", name: "Dialog", parent: APP, title: "Dialog", layoutId: "vertical", routeId: "fnRoute", modal: true, closable: true, events: "[]", outputs: 0, z: TAB, x: 100, y: 340, wires: [] },
        // ui-navigation: legacy parent + routeId (route mode)
        { type: "ui-navigation", id: "fnNav", uiId: "fnNav", name: "Nav", parent: APP, targetMode: "route", routeId: "fnRoute", z: TAB, x: 100, y: 400, wires: [[]] },
        // ui-component-definition + instance: legacy parent + definitionId
        { type: "ui-component-definition", id: "fnDef", uiId: "fnDef", name: "Widget", z: TAB, x: 400, y: 80, wires: [[]] },
        { type: "ui-text", id: "fnDefText", uiId: "fnDefText", name: "DefText", parent: APP, mount: "def:fnDef/content", text: "widget body", z: TAB, x: 400, y: 140, wires: [[]] },
        { type: "ui-component-instance", id: "fnInst", uiId: "fnInst", name: "Instance", parent: APP, mount: "route:/page/content", definitionId: "fnDef", props: {}, z: TAB, x: 100, y: 460, wires: [[]] }
    ];
}

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

test.describe("P228 — reference-field naming: back-compat load + migrate-on-save", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a pre-rename flow (parent/layoutId/routeId/definitionId) renders unchanged", async ({ page, request }) => {
        await deployFlow(request, legacyFlow());

        const webapp = new WebappPage(page, APP);
        await webapp.navigate("/page");
        // The runtime resolved the legacy `parent`/`layoutId`/`mount` chain and
        // rendered the mounted ui-text — no migration required at runtime.
        await expect(webapp.root()).toContainText("Legacy renders");
    });

    test("opening + saving migrates each renamed reference to the canonical field", async ({ page, request }) => {
        await deployFlow(request, legacyFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        // ── ui-route: parent → app, layoutId → layout ──────────────────────────
        await editor.openNode("fnRoute");
        await editor.save();
        {
            const n = await readNode(page, "fnRoute", ["app", "layout", "parent", "layoutId"]);
            expect(n.app, "route parent → app").toBe(APP);
            expect(n.layout, "route layoutId → layout").toBe("vertical");
            expect(n.parent, "legacy parent dropped").toBeUndefined();
            expect(n.layoutId, "legacy layoutId dropped").toBeUndefined();
        }

        // ── ui-container: parent → app, layoutId → layout ──────────────────────
        await editor.openNode("fnContainer");
        await editor.save();
        {
            const n = await readNode(page, "fnContainer", ["app", "layout", "parent", "layoutId"]);
            expect(n.app).toBe(APP);
            expect(n.layout).toBe("vertical");
            expect(n.parent).toBeUndefined();
            expect(n.layoutId).toBeUndefined();
        }

        // ── ui-dialog: parent → app, layoutId → layout, routeId → route ────────
        await editor.openNode("fnDialog");
        await editor.save();
        {
            const n = await readNode(page, "fnDialog", ["app", "layout", "route", "parent", "layoutId", "routeId"]);
            expect(n.app).toBe(APP);
            expect(n.layout).toBe("vertical");
            expect(n.route, "dialog routeId → route").toBe("fnRoute");
            expect(n.parent).toBeUndefined();
            expect(n.layoutId).toBeUndefined();
            expect(n.routeId).toBeUndefined();
        }

        // ── ui-navigation: routeId → route ─────────────────────────────────────
        await editor.openNode("fnNav");
        await editor.save();
        {
            const n = await readNode(page, "fnNav", ["app", "route", "parent", "routeId"]);
            expect(n.app).toBe(APP);
            expect(n.route, "navigation routeId → route").toBe("fnRoute");
            expect(n.parent).toBeUndefined();
            expect(n.routeId).toBeUndefined();
        }

        // ── ui-component-instance: parent → app, definitionId → definition ─────
        await editor.openNode("fnInst");
        await editor.save();
        {
            const n = await readNode(page, "fnInst", ["app", "definition", "parent", "definitionId"]);
            expect(n.app).toBe(APP);
            expect(n.definition, "instance definitionId → definition").toBe("fnDef");
            expect(n.parent).toBeUndefined();
            expect(n.definitionId).toBeUndefined();
        }

        // ── view node (ui-text) with no App picker: parent → app still migrates ─
        await editor.openNode("fnText");
        await editor.save();
        {
            const n = await readNode(page, "fnText", ["app", "parent"]);
            expect(n.app, "view-node parent → app (no UI selector)").toBe(APP);
            expect(n.parent).toBeUndefined();
        }
    });
});
