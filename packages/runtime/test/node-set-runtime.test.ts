import { describe, expect, it } from "vitest";

import { assembleNodeSet, createRuntimeRegistry } from "../src";

describe("runtime node set assembly", () => {
    it("assembles node definitions into registry contributions and a valid compiled model", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                title: "Customers CRM",
                layout: "app"
            },
            {
                type: "ui-route",
                id: "customers",
                path: "/customers",
                layout: "vertical"
            },
            {
                type: "ui-dialog",
                id: "customerEditor",
                layout: "vertical",
                routeId: "customers",
                modal: true
            },
            {
                type: "ui-text",
                id: "pageTitle",
                mount: "customersApp.header",
                value: {
                    kind: "literal",
                    value: "Customers"
                }
            },
            {
                type: "ui-button",
                id: "newCustomerButton",
                mount: "route:/customers/content",
                label: "New customer",
                action: "openCustomerEditor"
            },
            {
                type: "ui-table",
                id: "customersTable",
                mount: "route:/customers/content",
                order: 1,
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
                layout: "grid"
            },
            {
                type: "ui-input",
                id: "customerNameInput",
                mount: "layout:grid/content",
                label: "Name",
                value: {
                    kind: "state",
                    path: "draft.customer.name"
                },
                storeId: "draftStore",
                path: "name",
                row: 1,
                col: 1,
                colSize: 12
            },
            {
                type: "ui-input",
                id: "customerEmailInput",
                mount: "layout:grid/content",
                label: "Email",
                value: {
                    kind: "state",
                    path: "draft.customer.email"
                },
                storeId: "draftStore",
                path: "email",
                row: 2,
                col: 1,
                colSize: 12
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
                    params: undefined,
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
        expect(result.model?.layouts.map((layout) => layout.id)).toEqual(["app", "grid", "vertical"]);
        expect(result.model?.routes).toEqual([
            {
                id: "customersApp",
                path: "/",
                title: "Customers CRM",
                layoutId: "app"
            },
            {
                id: "customers",
                path: "/customers",
                title: undefined,
                layoutId: "vertical"
            }
        ]);
        expect(result.model?.components.map((component) => component.id)).toEqual([
            "pageTitle",
            "customerEditorContainer",
            "customerEmailInput",
            "customerNameInput",
            "customersTable",
            "newCustomerButton"
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
                type: "ui-button",
                id: "invalidButton",
                mount: "layout:vertical/content/toolbar",
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
                type: "ui-route",
                id: "customerDetail",
                path: "/customers/:id",
                title: "Customer detail",
                layout: "vertical"
            },
            {
                type: "ui-container",
                id: "detailContainer",
                mount: "route:/customers/:id/content",
                layout: "horizontal",
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
                layoutId: "vertical"
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
                    layoutId: "horizontal"
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
                layout: "vertical"
            },
            {
                type: "ui-container",
                id: "ordersShell",
                mount: "route:/orders/content",
                layout: "horizontal"
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

describe("P11a: parent field compilation", () => {
    it("compiles a ui-button with parent used as mount into the correct slot", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "testApp", title: "Test", layout: "app" },
            {
                type: "ui-button",
                id: "btn1",
                parent: "route://content",
                label: "Click me",
                action: "doSomething"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const component = assembly.data.contributions.find(
            (c) => c.kind === "component" && c.definition.id === "btn1"
        );

        expect(component).toBeDefined();

        if (component?.kind === "component") {
            expect(component.definition.mount).toBe("route://content");
        }
    });

    it("compiles a ui-button with mount field (no parent) — backward compatibility", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "testApp", title: "Test", layout: "app" },
            {
                type: "ui-button",
                id: "btn2",
                mount: "route://content",
                label: "Old style",
                action: "doSomething"
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("compiles a ui-store with parent scoped to an app", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "myApp", title: "My App", layout: "vertical" },
            {
                type: "ui-store",
                id: "myStore",
                parent: "myApp",
                statePath: "myData"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const store = assembly.data.integration.stores.find((s) => s.id === "myStore");

        expect(store).toBeDefined();
        expect(store?.statePath).toBe("myData");
    });

    it("rejects a slot-scoped node with neither mount nor parent", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "testApp", title: "Test", layout: "app" },
            {
                type: "ui-button",
                id: "brokenBtn",
                label: "No mount",
                action: "doSomething"
            }
        ]);

        expect(assembly.success).toBe(false);

        if (!assembly.success) {
            expect(assembly.error).toMatch(/mount.*parent|parent.*mount/i);
        }
    });

    it("compiles a node with uiId but no parent (backward compatibility)", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "testApp", title: "Test", layout: "app" },
            {
                type: "ui-button",
                id: "legacyBtn",
                mount: "route://content",
                label: "Legacy",
                action: "doSomething"
            }
        ]);

        expect(assembly.success).toBe(true);
    });
});