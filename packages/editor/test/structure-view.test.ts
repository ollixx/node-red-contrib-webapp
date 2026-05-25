import { describe, expect, it } from "vitest";

import type { UiNodeDefinition } from "@node-red-contrib-webapp/schema";
import { customersCrudAppModelFixture } from "@node-red-contrib-webapp/schema";
import { createContributionsFromAppModel, createRuntimeRegistry } from "@node-red-contrib-webapp/runtime";

import { buildEditorStructureView, findStructureItem, selectFromCanvas, selectFromStructure } from "../src";

const sourceNodes: UiNodeDefinition[] = [
    {
        type: "ui-app",
        id: "customersApp",
        title: "Customers CRM"
    },
    {
        type: "ui-layout",
        appId: "customersApp",
        id: "customerShell",
        title: "Customer shell"
    },
    {
        type: "ui-layout",
        appId: "customersApp",
        id: "dialogShell",
        title: "Dialog shell"
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "headerRegion",
        layoutId: "customerShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "contentRegion",
        layoutId: "customerShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "toolbarRegion",
        layoutId: "customerShell",
        name: "toolbar",
        parentRegionId: "contentRegion",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "bodyRegion",
        layoutId: "customerShell",
        name: "body",
        parentRegionId: "contentRegion",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "footerRegion",
        layoutId: "customerShell",
        name: "footer",
        order: 2
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogHeaderRegion",
        layoutId: "dialogShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogContentRegion",
        layoutId: "dialogShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogFormRegion",
        layoutId: "dialogShell",
        name: "form",
        parentRegionId: "dialogContentRegion",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogFieldsRegion",
        layoutId: "dialogShell",
        name: "fields",
        parentRegionId: "dialogFormRegion",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogActionsRegion",
        layoutId: "dialogShell",
        name: "actions",
        parentRegionId: "dialogFormRegion",
        order: 1
    },
    {
        type: "ui-route",
        appId: "customersApp",
        id: "customers",
        path: "/customers",
        title: "Customers",
        layoutId: "customerShell"
    },
    {
        type: "ui-route",
        appId: "customersApp",
        id: "customerDetail",
        path: "/customers/:id",
        title: "Customer detail",
        layoutId: "customerShell"
    },
    {
        type: "ui-dialog",
        appId: "customersApp",
        id: "customerEditor",
        title: "Edit customer",
        layoutId: "dialogShell",
        modal: true
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "pageTitle",
        mount: "customers.header",
        value: {
            kind: "literal",
            value: "Customers"
        }
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "newCustomerButton",
        mount: "route:/customers/content/toolbar",
        label: "New customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "refreshCustomersButton",
        mount: "route:/customers/content/toolbar",
        label: "Refresh",
        action: "refreshCustomers"
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "editorStatus",
        mount: "route:/customers/content/toolbar",
        value: {
            kind: "literal",
            value: "Editing customer"
        }
    },
    {
        type: "ui-table",
        appId: "customersApp",
        id: "customersTable",
        mount: "route:/customers/content/body",
        columns: ["name", "email", "status"],
        rows: {
            kind: "query",
            path: "customers.list"
        },
        selectAction: "openCustomerDetail"
    },
    {
        type: "ui-form",
        appId: "customersApp",
        id: "customerForm",
        mount: "dialog:customerEditor/content/form/fields",
        fields: ["name", "email", "status"],
        model: {
            kind: "state",
            path: "draft.customer"
        },
        submitAction: "saveCustomer"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "cancelCustomerButton",
        mount: "dialog:customerEditor/content/form/actions",
        label: "Cancel",
        action: "closeCustomerEditor"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "saveCustomerButton",
        mount: "dialog:customerEditor/content/form/actions",
        label: "Save",
        action: "saveCustomer"
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "detailSummary",
        mount: "route:/customers/:id/content/body",
        value: {
            kind: "literal",
            value: "ignored"
        }
    }
];

describe("editor structure view", () => {
    it("builds a sidebar tree from the compiled registry model", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const result = registry.compile("customersApp");
        const view = buildEditorStructureView(result, sourceNodes);
        const customersRoute = findStructureItem(view, "app:customersApp/route:customers");
        const customersLayout = findStructureItem(view, "app:customersApp/route:customers/layout:customerShell");
        const toolbarRegion = findStructureItem(view, "app:customersApp/route:customers/layout:customerShell/region:content/toolbar");
        const customerDialog = findStructureItem(view, "app:customersApp/dialog:customerEditor");
        const dialogActions = findStructureItem(
            view,
            "app:customersApp/dialog:customerEditor/layout:dialogShell/region:content/form/actions"
        );

        expect(result.diagnostics).toEqual([]);
        expect(view.root?.id).toBe("app:customersApp");
        expect(view.root?.children.map((item) => item.id)).toEqual([
            "app:customersApp/route:customers",
            "app:customersApp/route:customerDetail",
            "app:customersApp/dialog:customerEditor"
        ]);
        expect(customersRoute?.meta?.routePath).toBe("/customers");
        expect(customersLayout?.canvasNodeId).toBe("customerShell");
        expect(toolbarRegion?.canvasNodeId).toBe("toolbarRegion");
        expect(toolbarRegion?.children.map((item) => item.label)).toEqual(["newCustomerButton", "refreshCustomersButton", "editorStatus"]);
        expect(customerDialog?.children.map((item) => item.id)).toEqual([
            "app:customersApp/dialog:customerEditor/layout:dialogShell"
        ]);
        expect(dialogActions?.children.map((item) => item.label)).toEqual(["cancelCustomerButton", "saveCustomerButton"]);
    });

    it("syncs selection between canvas node ids and structure items", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const view = buildEditorStructureView(registry.compile("customersApp"), sourceNodes);
        const regionSelection = selectFromCanvas(view, "contentRegion");
        const structureSelection = selectFromStructure(view, "app:customersApp/route:customers/layout:customerShell/region:content");

        expect(regionSelection.activeStructureItemId).toBe("app:customersApp/route:customers/layout:customerShell/region:content");
        expect(regionSelection.matchedStructureItemIds).toEqual([
            "app:customersApp/route:customers/layout:customerShell/region:content",
            "app:customersApp/route:customerDetail/layout:customerShell/region:content"
        ]);
        expect(structureSelection.activeCanvasNodeIds).toEqual(["contentRegion"]);
    });

    it("surfaces orphaned mounts and unresolved slots as structural warnings", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const view = buildEditorStructureView(registry.compile("customersApp"), [
            ...sourceNodes,
            {
                type: "ui-text",
                appId: "customersApp",
                id: "orphanText",
                mount: "dialog:missingDialog/content/actions",
                value: {
                    kind: "literal",
                    value: "Orphan"
                }
            },
            {
                type: "ui-text",
                appId: "customersApp",
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