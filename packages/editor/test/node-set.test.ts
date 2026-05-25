import { describe, expect, it } from "vitest";

import { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "../src";

describe("editor node set", () => {
    it("covers the full P4 MVP node catalog", () => {
        expect(Object.keys(nodeSet).sort()).toEqual([
            "ui-action",
            "ui-app",
            "ui-button",
            "ui-dialog",
            "ui-form",
            "ui-layout",
            "ui-navigation",
            "ui-query",
            "ui-region",
            "ui-route",
            "ui-store",
            "ui-table",
            "ui-text"
        ]);
    });

    it("blocks incomplete required fields before emit", () => {
        const issues = validateEditorNodeConfig("ui-button", {
            appId: "customersApp",
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

    it("emits schema-valid definitions for every MVP node type", () => {
        const samples = [
            emitNodeDefinition("ui-app", {
                id: "customersApp",
                title: "Customers CRM"
            }),
            emitNodeDefinition("ui-layout", {
                appId: "customersApp",
                id: "customerShell",
                title: "Customer shell"
            }),
            emitNodeDefinition("ui-region", {
                appId: "customersApp",
                id: "contentRegion",
                layoutId: "customerShell",
                name: "content",
                order: 1
            }),
            emitNodeDefinition("ui-route", {
                appId: "customersApp",
                id: "customers",
                path: "/customers",
                layoutId: "customerShell"
            }),
            emitNodeDefinition("ui-text", {
                appId: "customersApp",
                id: "pageTitle",
                mount: "route:/customers/content",
                text: "Customers"
            }),
            emitNodeDefinition("ui-button", {
                appId: "customersApp",
                id: "newCustomerButton",
                mount: "route:/customers/content",
                label: "New customer",
                action: "openCustomerEditor"
            }),
            emitNodeDefinition("ui-table", {
                appId: "customersApp",
                id: "customersTable",
                mount: "route:/customers/content",
                columns: ["name", "email"],
                rowsPath: "customers.list",
                selectAction: "openCustomerDetail"
            }),
            emitNodeDefinition("ui-form", {
                appId: "customersApp",
                id: "customerForm",
                mount: "dialog:customerEditor/content/form/fields",
                fields: ["name", "email"],
                modelPath: "draft.customer",
                submitAction: "saveCustomer"
            }),
            emitNodeDefinition("ui-dialog", {
                appId: "customersApp",
                id: "customerEditor",
                layoutId: "dialogShell",
                routeId: "customers"
            }),
            emitNodeDefinition("ui-store", {
                appId: "customersApp",
                id: "draftStore",
                statePath: "draft.customer"
            }),
            emitNodeDefinition("ui-query", {
                appId: "customersApp",
                id: "customersQuery",
                queryPath: "customers.list",
                source: "msg.payload"
            }),
            emitNodeDefinition("ui-action", {
                appId: "customersApp",
                id: "saveCustomer"
            }),
            emitNodeDefinition("ui-navigation", {
                appId: "customersApp",
                id: "goToCustomers",
                to: "/customers"
            })
        ];

        for (const sample of samples) {
            expect(sample.success).toBe(true);
        }
    });
});