import { describe, expect, it } from "vitest";

import { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "../src";

describe("editor node set", () => {
    it("covers the full P4 MVP node catalog", () => {
        expect(Object.keys(nodeSet).sort()).toEqual([
            "ui-action",
            "ui-alert",
            "ui-app",
            "ui-badge",
            "ui-button",
            "ui-checkbox",
            "ui-container",
            "ui-datepicker",
            "ui-dialog",
            "ui-empty-state",
            "ui-input",
            "ui-navigation",
            "ui-progress",
            "ui-query",
            "ui-radio",
            "ui-route",
            "ui-select",
            "ui-skeleton",
            "ui-slider",
            "ui-store",
            "ui-switch",
            "ui-table",
            "ui-text",
            "ui-textarea",
            "ui-toast"
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
                root: "customersApp",
                name: "Customers CRM",
                layout: "vertical"
            }),
            emitNodeDefinition("ui-route", {
                id: "customers",
                path: "/customers",
                layoutId: "vertical"
            }),
            emitNodeDefinition("ui-text", {
                id: "pageTitle",
                mount: "route:/customers/content",
                text: "Customers"
            }),
            emitNodeDefinition("ui-text", {
                id: "draftStatus",
                mount: "layout:grid/content",
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
                layoutId: "grid"
            }),
            emitNodeDefinition("ui-input", {
                id: "customerNameInput",
                mount: "layout:grid/content",
                label: "Name",
                valuePath: "draft.customer.name",
                storeId: "draftStore",
                path: "name"
            }),
            emitNodeDefinition("ui-dialog", {
                id: "customerEditor",
                layoutId: "vertical",
                routeId: "customers"
            }),
            emitNodeDefinition("ui-store", {
                id: "draftStore",
                statePath: "draft.customer"
            }),
            emitNodeDefinition("ui-query", {
                id: "customersQuery",
                queryPath: "customers.list"
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

    it("validates and emits ui-app definitions with root-to-id mapping", () => {
        const issues = validateEditorNodeConfig("ui-app", {
            root: "customersApp"
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "layout"
                })
            ])
        );

        const emitted = emitNodeDefinition("ui-app", {
            root: "customersApp",
            name: "Customers CRM",
            layout: "vertical"
        });

        expect(emitted.success).toBe(true);

        if (!emitted.success) {
            return;
        }

        expect(emitted.data).toEqual({
            type: "ui-app",
            id: "customersApp",
            title: "Customers CRM",
            layout: "vertical"
        });
    });

    it("validates and emits ui-route definitions with optional title", () => {
        const issues = validateEditorNodeConfig("ui-route", {
            id: "customers",
            path: "/customers"
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "layoutId"
                })
            ])
        );

        const emitted = emitNodeDefinition("ui-route", {
            id: "customers",
            path: "/customers/:id",
            title: "Customer detail",
            layoutId: "vertical"
        });

        expect(emitted.success).toBe(true);

        if (!emitted.success) {
            return;
        }

        expect(emitted.data).toEqual({
            type: "ui-route",
            id: "customers",
            path: "/customers/:id",
            title: "Customer detail",
            layoutId: "vertical"
        });
    });

    it("validates and emits ui-container definitions with optional metadata", () => {
        const issues = validateEditorNodeConfig("ui-container", {
            id: "customersContent",
            mount: "route:/customers/content"
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "layoutId"
                })
            ])
        );

        const emitted = emitNodeDefinition("ui-container", {
            id: "customersContent",
            mount: "route:/customers/content",
            layoutId: "grid",
            title: "Customers content",
            order: 2
        });

        expect(emitted.success).toBe(true);

        if (!emitted.success) {
            return;
        }

        expect(emitted.data).toEqual({
            type: "ui-container",
            id: "customersContent",
            mount: "route:/customers/content",
            layoutId: "grid",
            title: "Customers content",
            order: 2
        });
    });
});