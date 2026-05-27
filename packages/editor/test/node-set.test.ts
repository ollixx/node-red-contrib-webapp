import { describe, expect, it } from "vitest";

import { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "../src";

describe("editor node set", () => {
    it("covers the full P4 MVP node catalog", () => {
        expect(Object.keys(nodeSet).sort()).toEqual([
            "ui-action",
            "ui-app",
            "ui-button",
            "ui-container",
            "ui-dialog",
            "ui-input",
            "ui-layout",
            "ui-navigation",
            "ui-query",
            "ui-route",
            "ui-slot",
            "ui-store",
            "ui-table",
            "ui-text"
        ]);
    });

    it("blocks incomplete required fields before emit", () => {
        const issues = validateEditorNodeConfig("ui-button", {
            id: "newCustomerButton",
            mount: "route:/customers/content/toolbar",
            label: ""
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "label"
                }),
                expect.objectContaining({
                    field: "action"
                })
            ])
        );
    });

    it("blocks invalid typed ui-action combinations before emit", () => {
        const issues = validateEditorNodeConfig("ui-action", {
            id: "hideToolbar",
            actionType: "hide",
            targetMode: "path"
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "target"
                })
            ])
        );

        const navigateIssues = validateEditorNodeConfig("ui-action", {
            id: "goToCustomers",
            actionType: "navigate",
            targetMode: "out-port"
        });

        expect(navigateIssues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "to"
                })
            ])
        );
    });

    it("emits schema-valid definitions for every MVP node type", () => {
        const samples = [
            emitNodeDefinition("ui-app", {
                id: "customersApp",
                title: "Customers CRM"
            }),
            emitNodeDefinition("ui-layout", {
                id: "customerShell",
                title: "Customer shell"
            }),
            emitNodeDefinition("ui-slot", {
                id: "contentRegion",
                layoutId: "customerShell",
                name: "content",
                order: 1
            }),
            emitNodeDefinition("ui-route", {
                id: "customers",
                path: "/customers",
                layoutId: "customerShell"
            }),
            emitNodeDefinition("ui-text", {
                id: "pageTitle",
                mount: "route:/customers/content",
                text: "Customers"
            }),
            emitNodeDefinition("ui-text", {
                id: "draftStatus",
                mount: "layout:dialogFormLayout/fields",
                value: {
                    kind: "state",
                    path: "draft.customer.status"
                }
            }),
            emitNodeDefinition("ui-button", {
                id: "newCustomerButton",
                mount: "route:/customers/content",
                label: "New customer",
                action: "openCustomerEditor"
            }),
            emitNodeDefinition("ui-table", {
                id: "customersTable",
                mount: "route:/customers/content",
                columns: ["name", "email"],
                rowsPath: "customers.list",
                selectAction: "openCustomerDetail"
            }),
            emitNodeDefinition("ui-container", {
                id: "customerEditorContainer",
                mount: "dialog:customerEditor/content",
                layoutId: "dialogFormLayout"
            }),
            emitNodeDefinition("ui-input", {
                id: "customerNameInput",
                mount: "layout:dialogFormLayout/fields",
                label: "Name",
                valuePath: "draft.customer.name",
                storeId: "draftStore",
                path: "name"
            }),
            emitNodeDefinition("ui-dialog", {
                id: "customerEditor",
                layoutId: "dialogShell",
                routeId: "customers"
            }),
            emitNodeDefinition("ui-store", {
                id: "draftStore",
                statePath: "draft.customer"
            }),
            emitNodeDefinition("ui-query", {
                id: "customersQuery",
                queryPath: "customers.list",
                source: "msg.payload"
            }),
            emitNodeDefinition("ui-action", {
                id: "saveCustomer"
            }),
            emitNodeDefinition("ui-action", {
                id: "hideToolbar",
                actionType: "hide",
                targetMode: "path",
                target: "route:/customers/content/toolbar"
            }),
            emitNodeDefinition("ui-action", {
                id: "triggerRefresh",
                actionType: "trigger",
                targetMode: "out-port"
            }),
            emitNodeDefinition("ui-action", {
                id: "goToCustomersAction",
                actionType: "navigate",
                targetMode: "path",
                target: "app",
                to: "/customers"
            }),
            emitNodeDefinition("ui-navigation", {
                id: "goToCustomers",
                to: "/customers"
            })
        ];

        for (const sample of samples) {
            expect(sample.success).toBe(true);
        }
    });
});