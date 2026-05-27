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
        id: "customerShell",
        title: "Customer shell"
    },
    {
        type: "ui-layout",
        id: "dialogShell",
        title: "Dialog shell"
    },
    {
        type: "ui-layout",
        id: "customersListLayout",
        title: "Customers list content"
    },
    {
        type: "ui-layout",
        id: "customerDetailLayout",
        title: "Customer detail content"
    },
    {
        type: "ui-layout",
        id: "dialogFormLayout",
        title: "Dialog form layout"
    },
    {
        type: "ui-slot",
        id: "headerRegion",
        layoutId: "customerShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-slot",
        id: "contentRegion",
        layoutId: "customerShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-slot",
        id: "footerRegion",
        layoutId: "customerShell",
        name: "footer",
        order: 2
    },
    {
        type: "ui-slot",
        id: "dialogHeaderRegion",
        layoutId: "dialogShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-slot",
        id: "dialogContentRegion",
        layoutId: "dialogShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-slot",
        id: "listToolbarRegion",
        layoutId: "customersListLayout",
        name: "toolbar",
        order: 0
    },
    {
        type: "ui-slot",
        id: "listBodyRegion",
        layoutId: "customersListLayout",
        name: "body",
        order: 0
    },
    {
        type: "ui-slot",
        id: "detailToolbarRegion",
        layoutId: "customerDetailLayout",
        name: "toolbar",
        order: 0
    },
    {
        type: "ui-slot",
        id: "detailBodyRegion",
        layoutId: "customerDetailLayout",
        name: "body",
        order: 1
    },
    {
        type: "ui-slot",
        id: "dialogFieldsRegion",
        layoutId: "dialogFormLayout",
        name: "fields",
        order: 0
    },
    {
        type: "ui-slot",
        id: "dialogActionsRegion",
        layoutId: "dialogFormLayout",
        name: "actions",
        order: 1
    },
    {
        type: "ui-route",
        id: "customers",
        path: "/customers",
        title: "Customers",
        layoutId: "customerShell"
    },
    {
        type: "ui-route",
        id: "customerDetail",
        path: "/customers/:id",
        title: "Customer detail",
        layoutId: "customerShell"
    },
    {
        type: "ui-dialog",
        id: "customerEditor",
        title: "Edit customer",
        layoutId: "dialogShell",
        modal: true
    },
    {
        type: "ui-text",
        id: "pageTitle",
        mount: "customers.header",
        value: {
            kind: "literal",
            value: "Customers"
        }
    },
    {
        type: "ui-container",
        id: "customersContentContainer",
        mount: "route:/customers/content",
        layoutId: "customersListLayout"
    },
    {
        type: "ui-button",
        id: "newCustomerButton",
        mount: "layout:customersListLayout/toolbar",
        label: "New customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        id: "refreshCustomersButton",
        mount: "layout:customersListLayout/toolbar",
        label: "Refresh",
        action: "refreshCustomers"
    },
    {
        type: "ui-text",
        id: "editorStatus",
        mount: "layout:customersListLayout/toolbar",
        value: {
            kind: "literal",
            value: "Editing customer"
        }
    },
    {
        type: "ui-table",
        id: "customersTable",
        mount: "layout:customersListLayout/body",
        columns: ["name", "email", "status"],
        rows: {
            kind: "query",
            path: "customers.list"
        },
        selectAction: "openCustomerDetail"
    },
    {
        type: "ui-container",
        id: "customerEditorContainer",
        mount: "dialog:customerEditor/content",
        layoutId: "dialogFormLayout"
    },
    {
        type: "ui-input",
        id: "customerNameInput",
        mount: "layout:dialogFormLayout/fields",
        label: "Name",
        value: {
            kind: "state",
            path: "draft.customer.name"
        },
        storeId: "draftStore",
        path: "name"
    },
    {
        type: "ui-input",
        id: "customerEmailInput",
        mount: "layout:dialogFormLayout/fields",
        label: "Email",
        value: {
            kind: "state",
            path: "draft.customer.email"
        },
        storeId: "draftStore",
        path: "email"
    },
    {
        type: "ui-button",
        id: "cancelCustomerButton",
        mount: "layout:dialogFormLayout/actions",
        label: "Cancel",
        action: "closeCustomerEditor"
    },
    {
        type: "ui-button",
        id: "saveCustomerButton",
        mount: "layout:dialogFormLayout/actions",
        label: "Save",
        action: "saveCustomer"
    },
    {
        type: "ui-container",
        id: "detailContentContainer",
        mount: "route:/customers/:id/content",
        layoutId: "customerDetailLayout"
    },
    {
        type: "ui-text",
        id: "detailSummary",
        mount: "layout:customerDetailLayout/body",
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
        const contentSlot = findStructureItem(view, "app:customersApp/route:customers/layout:customerShell/slot:content");
        const toolbarSlot = findStructureItem(view, "app:customersApp/route:customers/layout:customerShell/slot:content/component:customersContentContainer/layout:customersListLayout/slot:toolbar");
        const customerDialog = findStructureItem(view, "app:customersApp/dialog:customerEditor");
        const dialogActions = findStructureItem(
            view,
            "app:customersApp/dialog:customerEditor/layout:dialogShell/slot:content/component:customerEditorContainer/layout:dialogFormLayout/slot:actions"
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
        expect(contentSlot?.canvasNodeId).toBe("contentRegion");
        expect(toolbarSlot?.canvasNodeId).toBe("listToolbarRegion");
        expect(toolbarSlot?.children.map((item) => item.label)).toEqual(["newCustomerButton", "refreshCustomersButton", "editorStatus"]);
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
        const structureSelection = selectFromStructure(view, "app:customersApp/route:customers/layout:customerShell/slot:content");

        expect(regionSelection.activeStructureItemId).toBe("app:customersApp/route:customers/layout:customerShell/slot:content");
        expect(regionSelection.matchedStructureItemIds).toEqual([
            "app:customersApp/route:customers/layout:customerShell/slot:content",
            "app:customersApp/route:customerDetail/layout:customerShell/slot:content"
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