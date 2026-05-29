import { describe, expect, it } from "vitest";

import type { UiNodeDefinition } from "@node-red-contrib-webapp/schema";
import { customersCrudAppModelFixture, customersCrudNodeSetFixture } from "@node-red-contrib-webapp/schema";
import { createContributionsFromAppModel, createRuntimeRegistry } from "@node-red-contrib-webapp/runtime";

import { buildEditorStructureView, findStructureItem, selectFromCanvas, selectFromStructure } from "../src";

const sourceNodes: UiNodeDefinition[] = customersCrudNodeSetFixture;

describe("editor structure view", () => {
    it("builds a sidebar tree from the compiled registry model", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const result = registry.compile("customersApp");
        const view = buildEditorStructureView(result, sourceNodes);
        const customersRoute = findStructureItem(view, "app:customersApp/route:customers");
        const customersLayout = findStructureItem(view, "app:customersApp/route:customers/layout:vertical");
        const contentSlot = findStructureItem(view, "app:customersApp/route:customers/layout:vertical/slot:content");
        const customerDialog = findStructureItem(view, "app:customersApp/dialog:customerEditor");
        const dialogActions = findStructureItem(
            view,
            "app:customersApp/dialog:customerEditor/layout:vertical/slot:content/component:customerEditorContainer/layout:grid/slot:content"
        );

        expect(result.diagnostics).toEqual([]);
        expect(view.root?.id).toBe("app:customersApp");
        expect(view.root?.children.map((item) => item.id)).toEqual([
            "app:customersApp/route:customersApp",
            "app:customersApp/route:customers",
            "app:customersApp/route:customerDetail",
            "app:customersApp/dialog:customerEditor"
        ]);
        expect(customersRoute?.meta?.routePath).toBe("/customers");
        expect(customersLayout?.canvasNodeId).toBeUndefined();
        expect(contentSlot?.canvasNodeId).toBeUndefined();
        expect(contentSlot?.children.map((item) => item.label)).toEqual(["newCustomerButton", "refreshCustomersButton", "editorStatus", "customersTable"]);
        expect(customerDialog?.children.map((item) => item.id)).toEqual([
            "app:customersApp/dialog:customerEditor/layout:vertical"
        ]);
        expect(dialogActions?.children.map((item) => item.label)).toEqual([
            "cancelCustomerButton",
            "customerEmailInput",
            "customerNameInput",
            "customerStatusInput",
            "saveCustomerButton"
        ]);
    });

    it("syncs selection between canvas node ids and structure items", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const view = buildEditorStructureView(registry.compile("customersApp"), sourceNodes);
        const buttonSelection = selectFromCanvas(view, "newCustomerButton");
        const structureSelection = selectFromStructure(view, "app:customersApp/route:customers/layout:vertical/slot:content/component:newCustomerButton");

        expect(buttonSelection.activeStructureItemId).toBe("app:customersApp/route:customers/layout:vertical/slot:content/component:newCustomerButton");
        expect(buttonSelection.matchedStructureItemIds).toEqual([
            "app:customersApp/route:customers/layout:vertical/slot:content/component:newCustomerButton"
        ]);
        expect(structureSelection.activeCanvasNodeIds).toEqual(["newCustomerButton"]);
    });

    it("surfaces orphaned mounts and unresolved slots as structural warnings", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const view = buildEditorStructureView(registry.compile("customersApp"), [
            ...sourceNodes,
            {
                type: "ui-text",
                id: "orphanText",
                mount: "dialog:missingDialog/content",
                value: {
                    kind: "literal",
                    value: "Orphan"
                }
            },
            {
                type: "ui-text",
                id: "sidebarText",
                mount: "customers.sidebar",
                value: {
                    kind: "literal",
                    value: "Sidebar"
                }
            }
        ]);

        expect(view.diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: "orphaned-mount",
                    canvasNodeIds: ["orphanText"]
                }),
                expect.objectContaining({
                    code: "unresolved-slot",
                    canvasNodeIds: ["sidebarText"]
                })
            ])
        );
    });
});