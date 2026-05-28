import { describe, expect, it } from "vitest";

import { assembleNodeSet, createRuntimeRegistry } from "../src";

describe("runtime node set assembly", () => {
    it("assembles node definitions into registry contributions and a valid compiled model", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "vertical"
            },
            {
                type: "ui-layout",
                id: "customerShell",
                title: "Customer shell"
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
                type: "ui-layout",
                id: "customersContentLayout",
                title: "Customers content"
            },
            {
                type: "ui-slot",
                id: "toolbarSlot",
                layoutId: "customersContentLayout",
                name: "toolbar",
                order: 0
            },
            {
                type: "ui-slot",
                id: "bodySlot",
                layoutId: "customersContentLayout",
                name: "body",
                order: 1
            },
            {
                type: "ui-layout",
                id: "dialogShell",
                title: "Dialog shell"
            },
            {
                type: "ui-slot",
                id: "dialogContent",
                layoutId: "dialogShell",
                name: "content",
                order: 0
            },
            {
                type: "ui-layout",
                id: "dialogFormLayout",
                title: "Dialog form"
            },
            {
                type: "ui-slot",
                id: "dialogFields",
                layoutId: "dialogFormLayout",
                name: "fields",
                order: 0
            },
            {
                type: "ui-slot",
                id: "dialogActions",
                layoutId: "dialogFormLayout",
                name: "actions",
                order: 1
            },
            {
                type: "ui-route",
                id: "customers",
                path: "/customers",
                layoutId: "customerShell"
            },
            {
                type: "ui-dialog",
                id: "customerEditor",
                layoutId: "dialogShell",
                routeId: "customers",
                modal: true
            },
            {
                type: "ui-text",
                id: "pageTitle",
                mount: "route:/customers/header",
                value: {
                    kind: "literal",
                    value: "Customers"
                }
            },
            {
                type: "ui-container",
                id: "customersContentContainer",
                mount: "route:/customers/content",
                layoutId: "customersContentLayout"
            },
            {
                type: "ui-button",
                id: "newCustomerButton",
                mount: "layout:customersContentLayout/toolbar",
                label: "New customer",
                action: "openCustomerEditor"
            },
            {
                type: "ui-table",
                id: "customersTable",
                mount: "layout:customersContentLayout/body",
                columns: ["name", "email"],
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
                type: "ui-store",
                id: "draftStore",
                statePath: "draft.customer"
            },
            {
                type: "ui-query",
                id: "customersQuery",
                queryPath: "customers.list"
            },
            {
                type: "ui-action",
                id: "saveCustomer"
            },
            {
                type: "ui-navigation",
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
                    actionType: "navigate",
                    description: undefined,
                    id: "goToCustomers",
                    target: undefined,
                    targetMode: "out-port",
                    to: "/customers"
                },
                {
                    actionType: undefined,
                    id: "saveCustomer",
                    target: undefined,
                    targetMode: undefined,
                    to: undefined,
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
        expect(result.model?.layouts.map((layout) => layout.id)).toEqual(["customersContentLayout", "customerShell", "dialogFormLayout", "dialogShell", "vertical"]);
        expect(result.model?.routes).toEqual([
            {
                id: "customersApp",
                path: "/",
                title: "Customers CRM",
                layoutId: "vertical"
            },
            {
                id: "customers",
                path: "/customers",
                title: undefined,
                layoutId: "customerShell"
            }
        ]);
        expect(result.model?.components.map((component) => component.id)).toEqual([
            "customerEditorContainer",
            "customersTable",
            "newCustomerButton",
            "customerEmailInput",
            "customerNameInput",
            "customersContentContainer",
            "pageTitle"
        ]);
    });

    it("mirrors ui-navigation nodes into typed navigate actions while keeping navigation integration", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "vertical"
            },
            {
                type: "ui-navigation",
                id: "goToCustomers",
                to: "/customers"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        expect(assembly.data.integration.actions).toEqual([
            {
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "out-port",
                target: undefined,
                to: "/customers",
                description: undefined
            }
        ]);
        expect(assembly.data.integration.navigations).toEqual([
            {
                id: "goToCustomers",
                to: "/customers"
            }
        ]);
    });

    it("keeps typed navigate ui-actions in legacy navigation integration for compatibility", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "vertical"
            },
            {
                type: "ui-action",
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "path",
                target: "app",
                to: "/customers"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        expect(assembly.data.integration.actions).toEqual([
            {
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "path",
                target: "app",
                to: "/customers",
                description: undefined
            }
        ]);
        expect(assembly.data.integration.navigations).toEqual([
            {
                id: "goToCustomers",
                to: "/customers"
            }
        ]);
    });

    it("fails assembly when a component targets a nested slot path", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "vertical"
            },
            {
                type: "ui-layout",
                id: "customerShell"
            },
            {
                type: "ui-slot",
                id: "contentRegion",
                layoutId: "customerShell",
                name: "content"
            },
            {
                type: "ui-button",
                id: "invalidButton",
                mount: "layout:customerShell/content/toolbar",
                label: "Invalid",
                action: "go"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const result = registry.compile("customersApp");

        expect(result.diagnostics[0]?.message).toContain("Nested slot paths are not supported");
    });

    it("keeps ui-route metadata and ui-container props in the compiled model", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "vertical"
            },
            {
                type: "ui-layout",
                id: "customerShell",
                title: "Customer shell"
            },
            {
                type: "ui-slot",
                id: "contentRegion",
                layoutId: "customerShell",
                name: "content"
            },
            {
                type: "ui-layout",
                id: "customersContentLayout",
                title: "Customers content"
            },
            {
                type: "ui-slot",
                id: "bodySlot",
                layoutId: "customersContentLayout",
                name: "body"
            },
            {
                type: "ui-route",
                id: "customerDetail",
                path: "/customers/:id",
                title: "Customer detail",
                layoutId: "customerShell"
            },
            {
                type: "ui-container",
                id: "detailContainer",
                mount: "route:/customers/:id/content",
                layoutId: "customersContentLayout",
                title: "Detail content",
                order: 3
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const result = registry.compile("customersApp");

        expect(result.diagnostics).toEqual([]);
        expect(result.model?.routes).toEqual([
            {
                id: "customersApp",
                path: "/",
                title: "Customers CRM",
                layoutId: "vertical"
            },
            {
                id: "customerDetail",
                path: "/customers/:id",
                title: "Customer detail",
                layoutId: "customerShell"
            }
        ]);
        expect(result.model?.components).toEqual([
            {
                id: "detailContainer",
                kind: "container",
                mount: "route:/customers/:id/content",
                order: 3,
                bind: {},
                props: {
                    layoutId: "customersContentLayout",
                    title: "Detail content"
                },
                events: []
            }
        ]);
    });

    it("materializes referenced standard layouts for routes and containers without custom ui-layout nodes", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "ordersApp",
                title: "Orders",
                layout: "app"
            },
            {
                type: "ui-route",
                id: "orders",
                path: "/orders",
                layoutId: "vertical"
            },
            {
                type: "ui-container",
                id: "ordersShell",
                mount: "route:/orders/content",
                layoutId: "horizontal"
            },
            {
                type: "ui-text",
                id: "rootHeader",
                mount: "ordersApp.header",
                value: {
                    kind: "literal",
                    value: "Orders home"
                }
            },
            {
                type: "ui-text",
                id: "ordersBody",
                mount: "layout:horizontal/content",
                value: {
                    kind: "literal",
                    value: "Orders list"
                }
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const result = registry.compile("ordersApp");

        expect(result.diagnostics).toEqual([]);
        expect(result.model?.layouts).toEqual([
            {
                id: "app",
                title: "App",
                slots: [{ name: "header" }, { name: "navbar" }, { name: "content" }, { name: "footer" }]
            },
            {
                id: "horizontal",
                title: "Horizontal",
                slots: [{ name: "content" }]
            },
            {
                id: "vertical",
                title: "Vertical",
                slots: [{ name: "content" }]
            }
        ]);
        expect(result.model?.routes).toEqual([
            {
                id: "ordersApp",
                path: "/",
                title: "Orders",
                layoutId: "app"
            },
            {
                id: "orders",
                path: "/orders",
                title: undefined,
                layoutId: "vertical"
            }
        ]);
    });
});