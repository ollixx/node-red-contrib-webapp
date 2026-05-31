import { describe, expect, it } from "vitest";

import { createRendererApp } from "@node-red-contrib-webapp/renderer";
import type { AppModel, RenderSnapshot, RenderedComponent, RenderedRegion } from "@node-red-contrib-webapp/renderer";

/**
 * P22 — Snapshot transport.
 *
 *  - the JSON snapshot endpoint must return the same region/component tree the
 *    HTML adapter renders for a given app + route + state.
 *  - dispatching an event through the client-runtime contract must return an
 *    updated snapshot reflecting the state change.
 *
 * These tests drive the webapp.js helpers directly (no HTTP server) so they pin
 * the contract without a browser. The Playwright specs cover the DOM round-trip.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; status: number; snapshot?: RenderSnapshot; model?: AppModel };

const renderAppPage = webappTest.renderAppPage as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { status: number; body: string };

const getAppModelResult = webappTest.getAppModelResult as (
    appId: string,
    definitions: unknown[]
) => { success: boolean; model?: AppModel };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

function flattenSnapshotComponents(regions: RenderedRegion[]): RenderedComponent[] {
    return regions.flatMap((region) =>
        region.components.flatMap((component) =>
            component.kind === "container" ? [component, ...flattenSnapshotComponents(component.regions)] : [component]
        )
    );
}

const rawNodes = [
    { type: "ui-app", id: "transportApp", name: "Transport App", root: "transportApp", layout: "app", z: "flow1" },
    { type: "ui-store", id: "greeting", name: "Greeting", parent: "transportApp", statePath: "greeting", initialValue: "Hello", z: "flow1" },
    { type: "ui-text", id: "heading", name: "Heading", mount: "transportApp.content", value: { kind: "state", path: "greeting" }, order: 1, z: "flow1" },
    { type: "ui-table", id: "peopleTable", name: "People", mount: "transportApp.content", rows: { kind: "literal", value: [{ id: "1", name: "Ada" }] }, columns: [{ key: "name", label: "Name" }], order: 2, z: "flow1" }
];

const definitions = buildDefinitions(rawNodes);

const applyPreviewAction = webappTest.applyPreviewAction as (
    RED: unknown,
    appId: string,
    actionId: string,
    parameters: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean; status?: number; redirectLocation?: string; dialogId?: string; message?: unknown };

const resetPreview = webappTest.resetPreview as (appId: string) => void;

const stubRED = { nodes: { getNode: () => undefined } };

// A flow with a dialog and a typed action that opens it. Dispatching the action
// through the contract must return a snapshot whose dialog set now includes it.
const dialogRawNodes = [
    { type: "ui-app", id: "dialogApp", name: "Dialog App", root: "dialogApp", layout: "app", z: "flow2" },
    { type: "ui-route", id: "home", name: "Home", parent: "dialogApp", path: "/", title: "Home", layoutId: "app", z: "flow2" },
    { type: "ui-dialog", id: "editor", name: "Editor", parent: "dialogApp", title: "Editor", layoutId: "vertical", z: "flow2" },
    { type: "ui-action", id: "openEditor", name: "Open Editor", parent: "dialogApp", actionType: "show", targetMode: "path", target: "dialog:editor", z: "flow2" },
    { type: "ui-text", id: "field", name: "Field", mount: "dialog:editor/content", value: { kind: "literal", value: "Inside" }, z: "flow2" }
];

const dialogDefinitions = buildDefinitions(dialogRawNodes).map((definition) =>
    (definition as { type?: string }).type === "ui-action"
        // targetMode/target are deprecated since P20a and dropped by mapConfig, but the
        // preview's typed show/hide branch still honours them — re-attach so this test
        // exercises a real state-changing dispatch through applyPreviewAction.
        ? { ...definition, targetMode: "path", target: "dialog:editor" }
        : definition
);

describe("P22: JSON snapshot transport", () => {
    it("returns the same region/component tree the HTML adapter renders", () => {
        const built = buildAppSnapshot("transportApp", "/", undefined, definitions);

        expect(built.success).toBe(true);
        const endpointSnapshot = built.snapshot as RenderSnapshot;

        // Reference snapshot from the renderer, exactly as the HTML route builds it.
        const modelResult = getAppModelResult("transportApp", definitions);
        expect(modelResult.success).toBe(true);
        const referenceSnapshot = createRendererApp(modelResult.model as AppModel, { location: "/" }).render();

        const endpointIds = flattenSnapshotComponents(endpointSnapshot.regions).map((component) => component.id).sort();
        const referenceIds = flattenSnapshotComponents(referenceSnapshot.regions).map((component) => component.id).sort();

        expect(endpointIds).toEqual(referenceIds);
        expect(endpointIds).toEqual(["heading", "peopleTable"]);

        // The HTML route serializes the same tree: the heading text and the table
        // row appear in the rendered HTML body too.
        const page = renderAppPage("transportApp", "/", undefined, definitions);
        expect(page.body).toContain("Hello");
        expect(page.body).toContain(">Ada<");
    });

    it("dispatching an event returns an updated snapshot reflecting the state change", () => {
        resetPreview("dialogApp");

        // Before: no dialog is open.
        const before = buildAppSnapshot("dialogApp", "/", undefined, dialogDefinitions);
        expect(before.success).toBe(true);
        expect((before.snapshot as RenderSnapshot).dialogs).toHaveLength(0);

        // Dispatch the open-editor event through the contract.
        const applied = applyPreviewAction(stubRED, "dialogApp", "openEditor", { location: "/", sourceId: "openEditor", event: "click" }, dialogDefinitions);
        expect(applied.success).toBe(true);

        // After: the returned snapshot now contains the open dialog with its content.
        const after = buildAppSnapshot("dialogApp", applied.redirectLocation ?? "/", applied.dialogId, dialogDefinitions);
        expect(after.success).toBe(true);
        const afterSnapshot = after.snapshot as RenderSnapshot;
        expect(afterSnapshot.dialogs).toHaveLength(1);
        expect(afterSnapshot.dialogs[0].id).toBe("editor");

        const dialogComponents = flattenSnapshotComponents(afterSnapshot.dialogs[0].regions);
        expect(dialogComponents.map((component) => component.id)).toContain("field");

        resetPreview("dialogApp");
    });
});
