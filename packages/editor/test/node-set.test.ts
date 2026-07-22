import { describe, expect, it } from "vitest";

import { emitNodeDefinition, nodeSet, validateEditorNodeConfig } from "../src";

describe("editor node set", () => {
    it("covers the full P4 MVP node catalog", () => {
        expect(Object.keys(nodeSet).sort()).toEqual([
            "ui-accordion",
            "ui-accordion-section",
            "ui-action",
            "ui-alert",
            "ui-app",
            "ui-avatar",
            "ui-badge",
            "ui-breadcrumb",
            "ui-button",
            "ui-checkbox",
            "ui-component-definition",
            "ui-component-instance",
            "ui-container",
            "ui-datepicker",
            "ui-dialog",
            "ui-divider",
            "ui-empty-state",
            "ui-icon",
            "ui-image",
            "ui-input",
            "ui-list",
            "ui-menu",
            "ui-pagination",
            "ui-progress",
            "ui-query",
            "ui-query-action",
            "ui-radio",
            "ui-repeat",
            "ui-route",
            "ui-select",
            "ui-skeleton",
            "ui-slider",
            "ui-stepper",
            "ui-store",
            "ui-store-read",
            "ui-store-action",
            "ui-switch",
            "ui-tab",
            "ui-table",
            "ui-tabs",
            "ui-text",
            "ui-textarea",
            "ui-toast",
            "ui-log"
        ].sort());
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
        // P118 (ADR 0011 §1): an unknown navigate target mode is a per-node error.
        const issues = validateEditorNodeConfig("ui-action", {
            id: "badMode",
            actionType: "navigate",
            targetMode: "bogus" as never
        });

        expect(issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "targetMode"
                })
            ])
        );

        // P118: a wire-mode navigate carries NO `to` — the wired route supplies
        // the path. The per-node validator cannot see the wire, so it never flags
        // a missing `to` (no scan-based deploy check remains).
        const navigateIssues = validateEditorNodeConfig("ui-action", {
            id: "goToCustomers",
            actionType: "navigate",
            targetMode: "wire"
        });

        expect(navigateIssues).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "to"
                })
            ])
        );

        // P66: but a bogus typedInput type or non-object params are per-node
        // shape errors that ARE caught here.
        const badType = validateEditorNodeConfig("ui-action", {
            id: "badNav",
            actionType: "navigate",
            to: "/x",
            toType: "bogus" as never
        });
        expect(badType).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "toType" })])
        );

        const badParams = validateEditorNodeConfig("ui-action", {
            id: "badParams",
            actionType: "navigate",
            params: "[1,2,3]"
        });
        expect(badParams).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "params" })])
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
            emitNodeDefinition("ui-store-action", {
                id: "resetDraft",
                store: "draftStore",
                op: "reset",
                mode: "reference"
            }),
            emitNodeDefinition("ui-action", {
                id: "saveCustomer"
            }),
            emitNodeDefinition("ui-action", {
                id: "hideToolbar",
                actionType: "hide",
                target: "route:/customers/content/toolbar"
            }),
            emitNodeDefinition("ui-action", {
                id: "triggerRefresh",
                actionType: "trigger"
            }),
            // P118: navigate in url mode (a `to` URL built whole).
            emitNodeDefinition("ui-action", {
                id: "goToCustomersAction",
                actionType: "navigate",
                targetMode: "url",
                to: "/customers"
            }),
            // P118: navigate in route mode (routeId + typed params list).
            emitNodeDefinition("ui-action", {
                id: "goToCustomerDetail",
                actionType: "navigate",
                targetMode: "route",
                routeId: "customerDetail",
                params: JSON.stringify([{ name: "id", value: "payload.id", valueType: "msg" }])
            }),
            // P243 (ADR 0040): navigation is a ui-action navigate (url mode) —
            // ui-navigation is retired.
            emitNodeDefinition("ui-action", {
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "url",
                to: "/customers"
            })
        ];

        for (const sample of samples) {
            expect(sample.success).toBe(true);
        }
    });

    // P67: ui-alert message/title are bindings (incl. the new `store` kind).
    it("emits a ui-alert with a store message binding and a literal title binding", () => {
        const emitted = emitNodeDefinition("ui-alert", {
            id: "draftAlert",
            mount: "route:/customers/content",
            message: { kind: "store", path: "draftStore" },
            title: "Heads up"
        });

        expect(emitted.success).toBe(true);

        if (!emitted.success) {
            return;
        }

        expect(emitted.data.message).toEqual({ kind: "store", path: "draftStore" });
        expect(emitted.data.title).toEqual({ kind: "literal", value: "Heads up" });
    });

    // P67: legacy messagePath still maps to a state binding.
    it("maps a legacy ui-alert messagePath to a state binding", () => {
        const emitted = emitNodeDefinition("ui-alert", {
            id: "legacyAlert",
            mount: "route:/customers/content",
            messagePath: "alerts.current"
        });

        expect(emitted.success).toBe(true);

        if (!emitted.success) {
            return;
        }

        expect(emitted.data.message).toEqual({ kind: "state", path: "alerts.current" });
    });

    // P67: an alert with neither a message binding nor a messagePath is blocked.
    it("blocks a ui-alert without a message", () => {
        const issues = validateEditorNodeConfig("ui-alert", {
            id: "emptyAlert",
            mount: "route:/customers/content"
        });

        expect(issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "message" })])
        );
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

        // P109: `name` + `root` replace `title` in the emitted definition.
        expect(emitted.data).toEqual({
            type: "ui-app",
            id: "customersApp",
            name: "Customers CRM",
            root: "customersApp",
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
                    field: "layout"
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
            layout: "vertical"
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
                    field: "layout"
                })
            ])
        );

        const emitted = emitNodeDefinition("ui-container", {
            id: "customersContent",
            mount: "route:/customers/content",
            layoutId: "grid",
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
            layout: "grid",
            order: 2
        });
    });
});