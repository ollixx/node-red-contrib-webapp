import { describe, expect, it } from "vitest";

import { assembleNodeSet, createRuntimeRegistry } from "../src";

describe("runtime node set assembly", () => {
    it("assembles node definitions into registry contributions and a valid compiled model", () => {
        const assembly = assembleNodeSet([
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
                type: "ui-layout",
                appId: "customersApp",
                id: "dialogShell",
                title: "Dialog shell"
            },
            {
                type: "ui-region",
                appId: "customersApp",
                id: "dialogContent",
                layoutId: "dialogShell",
                name: "content",
                order: 0
            },
            {
                type: "ui-region",
                appId: "customersApp",
                id: "dialogForm",
                layoutId: "dialogShell",
                name: "form",
                parentRegionId: "dialogContent",
                order: 0
            },
            {
                type: "ui-region",
                appId: "customersApp",
                id: "dialogFields",
                layoutId: "dialogShell",
                name: "fields",
                parentRegionId: "dialogForm",
                order: 0
            },
            {
                type: "ui-route",
                appId: "customersApp",
                id: "customers",
                path: "/customers",
                layoutId: "customerShell"
            },
            {
                type: "ui-dialog",
                appId: "customersApp",
                id: "customerEditor",
                layoutId: "dialogShell",
                routeId: "customers",
                modal: true
            },
            {
                type: "ui-text",
                appId: "customersApp",
                id: "pageTitle",
                mount: "route:/customers/header",
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
                type: "ui-table",
                appId: "customersApp",
                id: "customersTable",
                mount: "route:/customers/content/body",
                columns: ["name", "email"],
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
                fields: ["name", "email"],
                model: {
                    kind: "state",
                    path: "draft.customer"
                },
                submitAction: "saveCustomer"
            },
            {
                type: "ui-store",
                appId: "customersApp",
                id: "draftStore",
                statePath: "draft.customer"
            },
            {
                type: "ui-query",
                appId: "customersApp",
                id: "customersQuery",
                queryPath: "customers.list"
            },
            {
                type: "ui-action",
                appId: "customersApp",
                id: "saveCustomer"
            },
            {
                type: "ui-navigation",
                appId: "customersApp",
                id: "goToCustomers",
                to: "/customers"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        expect(assembly.data.passiveDefinitions.map((definition) => definition.type).sort()).toEqual([
            "ui-action",
            "ui-navigation",
            "ui-query",
            "ui-store"
        ]);
        expect(assembly.data.integration).toEqual({
            stores: [
                {
                    id: "draftStore",
                    statePath: "draft.customer",
                    initialValue: undefined
                }
            ],
            queries: [
                {
                    id: "customersQuery",
                    queryPath: "customers.list",
                    source: undefined,
                    refreshAction: undefined
                }
            ],
            actions: [
                {
                    id: "saveCustomer",
                    description: undefined
                }
            ],
            navigations: [
                {
                    id: "goToCustomers",
                    to: "/customers"
                }
            ]
        });

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const result = registry.compile("customersApp");

        expect(result.diagnostics).toEqual([]);
        expect(result.model?.layouts.map((layout) => layout.id)).toEqual(["customerShell", "dialogShell"]);
        expect(result.model?.components.map((component) => component.id)).toEqual([
            "customerForm",
            "customersTable",
            "newCustomerButton",
            "pageTitle"
        ]);
    });

    it("fails assembly when a region references a missing parent", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM"
            },
            {
                type: "ui-layout",
                appId: "customersApp",
                id: "customerShell"
            },
            {
                type: "ui-region",
                appId: "customersApp",
                id: "contentRegion",
                layoutId: "customerShell",
                name: "content",
                parentRegionId: "missingRegion"
            }
        ]);

        expect(assembly.success).toBe(false);

        if (assembly.success) {
            return;
        }

        expect(assembly.error).toContain("missing parent region");
    });
});