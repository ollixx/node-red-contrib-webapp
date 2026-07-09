import { describe, expect, it } from "vitest";

import { createRendererApp } from "@node-red-contrib-webapp/renderer";
import type { AppModel, RenderSnapshot, RenderedComponent, RenderedRegion } from "@node-red-contrib-webapp/renderer";

/**
 * P21 — webapp.js renders exclusively from the RenderSnapshot produced by
 * packages/renderer. These tests pin the consolidation:
 *
 *  - the HTML output's component set matches the snapshot's region/component tree
 *    (no component dropped, none duplicated)
 *  - mount resolution (container:/route:/dialog:/layout:) lives only in the renderer
 *    — webapp.js no longer defines a second mount matcher or slot-tree walker.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

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
    { type: "ui-app", id: "renderApp", name: "Render App", root: "renderApp", layout: "app", z: "flow1" },
    { type: "ui-text", id: "heading", name: "Heading", mount: "renderApp.content", value: { kind: "literal", value: "Customers" }, order: 1, z: "flow1" },
    { type: "ui-button", id: "newButton", name: "New", mount: "renderApp.content", label: "New", action: "newButton", order: 2, z: "flow1" },
    { type: "ui-table", id: "peopleTable", name: "People", mount: "renderApp.content", rows: { kind: "literal", value: [{ id: "1", name: "Ada" }, { id: "2", name: "Linus" }] }, columns: [{ key: "name", label: "Name" }], order: 3, z: "flow1" },
    { type: "ui-container", id: "formContainer", name: "Form", mount: "renderApp.content", layoutId: "vertical", order: 4, z: "flow1" },
    { type: "ui-input", id: "nameInput", name: "Name", mount: "container:formContainer/content", label: "Name", writeTo: { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } }, value: { kind: "literal", value: "Ada" }, z: "flow1" },
    { type: "ui-text", id: "nested", name: "Nested", mount: "container:formContainer/content", value: { kind: "literal", value: "Nested text" }, z: "flow1" }
];

const definitions = buildDefinitions(rawNodes);

function buildSnapshot(): RenderSnapshot {
    const modelResult = getAppModelResult("renderApp", definitions);

    expect(modelResult.success).toBe(true);

    if (!modelResult.model) {
        throw new Error("expected a compiled model");
    }

    return createRendererApp(modelResult.model, { location: "/" }).render();
}

describe("P21: webapp HTML output matches the RenderSnapshot tree", () => {
    it("renders every snapshot component exactly once and adds none", () => {
        const result = renderAppPage("renderApp", "/", undefined, definitions);
        const snapshot = buildSnapshot();

        expect(result.status).toBe(200);

        const components = flattenSnapshotComponents(snapshot.regions);
        const componentIds = components.map((component) => component.id).sort();

        // Component set: the renderer placed the same components the HTML serializes.
        expect(componentIds).toEqual(["formContainer", "heading", "nameInput", "nested", "newButton", "peopleTable"]);

        // Each component's identifying output appears exactly once — nothing dropped, nothing duplicated.
        const occurrences = (needle: string) => result.body.split(needle).length - 1;

        expect(occurrences("Customers")).toBe(1); // heading text
        expect(occurrences(">New<")).toBe(1); // button label
        expect(occurrences("<table class=\"webapp-table\">")).toBe(1); // table
        expect(occurrences("<form class=\"webapp-form\"")).toBe(1); // exactly one container <form>
        expect(occurrences("Nested text")).toBe(1); // nested text inside container
        // P203 (ADR 0027): the legacy storeId/path write-target pair is gone; the
        // input's form-field `name` now falls back to the node id.
        expect(occurrences("name=\"nameInput\"")).toBe(1); // input inside container

        // Table rows from the snapshot are all present.
        const peopleTable = components.find((component) => component.id === "peopleTable");
        expect(peopleTable?.kind).toBe("table");

        if (peopleTable?.kind === "table") {
            expect(peopleTable.rows).toHaveLength(2);
        }

        expect(occurrences(">Ada<")).toBe(1); // table row cell
        expect(occurrences(">Linus<")).toBe(1);
        expect(occurrences("value=\"Ada\"")).toBe(1); // input value attribute

        // No internal slot name leaks as a heading (regression guard kept from rendering-bugs).
        expect(result.body).not.toMatch(/<h2[^>]*>\s*content\s*<\/h2>/i);
    });

    it("resolves container:id/slot children through the renderer, not a webapp matcher", () => {
        const snapshot = buildSnapshot();
        const container = flattenSnapshotComponents(snapshot.regions).find((component) => component.id === "formContainer");

        expect(container?.kind).toBe("container");

        if (container?.kind === "container") {
            const childIds = flattenSnapshotComponents(container.regions).map((component) => component.id).sort();
            expect(childIds).toEqual(["nameInput", "nested"]);
        }
    });
});
