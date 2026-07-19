import { describe, expect, it } from "vitest";

import { assembleNodeSet, createRuntimeRegistry } from "../src";

describe("runtime node set assembly", () => {
    it("assembles node definitions into registry contributions and a valid compiled model", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                name: "Customers CRM",
                root: "customersApp",
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
                // P243 (ADR 0040): navigation is a ui-action navigate (url mode).
                type: "ui-action",
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "url",
                to: "/customers"
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        expect(assembly.data.passiveDefinitions.map((definition) => definition.type).sort()).toEqual([
            "ui-action",
            "ui-action",
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
                    routeId: undefined,
                    target: undefined,
                    targetMode: "url",
                    params: undefined,
                    to: "/customers"
                },
                {
                    actionType: undefined,
                    id: "saveCustomer",
                    routeId: undefined,
                    target: undefined,
                    targetMode: undefined,
                    params: undefined,
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

    it("P243: a route-mode ui-action navigate (no `to`) assembles and is excluded from the to-keyed navigations list", () => {
        // ADR 0011 §5 / ADR 0040: navigation is a ui-action navigate. A route-mode
        // navigate addresses via routeId and carries no `to`, so it is excluded
        // from the url-`to`-keyed navigations list (it has no concrete URL).
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                name: "Customers CRM",
                root: "customersApp",
                layout: "vertical"
            },
            {
                type: "ui-action",
                id: "goToDetail",
                actionType: "navigate",
                targetMode: "route",
                routeId: "customers"
                // route mode: no `to` (the route reference supplies the path).
            }
        ]);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        // It still mirrors into a navigate action (url mode by the node-set rule)…
        expect(assembly.data.integration.actions).toContainEqual(
            expect.objectContaining({ id: "goToDetail", actionType: "navigate" })
        );
        // …but with no concrete `to`, it is NOT a url-target navigation.
        expect(assembly.data.integration.navigations).toEqual([]);
    });

    it("keeps typed navigate ui-actions in legacy navigation integration for compatibility", () => {
        const assembly = assembleNodeSet([
            {
                type: "ui-app",
                id: "customersApp",
                name: "Customers CRM",
                root: "customersApp",
                layout: "vertical"
            },
            {
                type: "ui-action",
                id: "goToCustomers",
                actionType: "navigate",
                targetMode: "url",
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
                targetMode: "url",
                routeId: undefined,
                target: undefined,
                to: "/customers",
                params: undefined,
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
                name: "Customers CRM",
                root: "customersApp",
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
                name: "Customers CRM",
                root: "customersApp",
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
                name: "Orders",
                root: "ordersApp",
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
            { type: "ui-app", id: "testApp", name: "Test", root: "testApp", layout: "app" },
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
            { type: "ui-app", id: "testApp", name: "Test", root: "testApp", layout: "app" },
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
            { type: "ui-app", id: "myApp", name: "My App", root: "myApp", layout: "vertical" },
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
            { type: "ui-app", id: "testApp", name: "Test", root: "testApp", layout: "app" },
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
            { type: "ui-app", id: "testApp", name: "Test", root: "testApp", layout: "app" },
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

    // P221 (ADR 0035): the ui-text form-field presentation mode + its label are
    // carried into the compiled component props (the render source reads them).
    it("carries ui-text display:formField + label into component props", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app", name: "A", root: "app", layout: "app" },
            { type: "ui-route", id: "home", path: "/home", layout: "vertical" },
            {
                type: "ui-text",
                id: "idField",
                mount: "route:/home/content",
                display: "formField",
                label: "Entity ID",
                value: { kind: "literal", value: "abc-123" }
            }
        ]);

        expect(assembly.success).toBe(true);
        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);
        const result = registry.compile("app");
        const text = result.model?.components.find((c) => c.id === "idField");
        expect(text?.props.display).toBe("formField");
        expect(text?.props.label).toBe("Entity ID");
    });

    it("omits the form-field props for a default free-text ui-text", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app", name: "A", root: "app", layout: "app" },
            { type: "ui-route", id: "home", path: "/home", layout: "vertical" },
            {
                type: "ui-text",
                id: "plain",
                mount: "route:/home/content",
                value: { kind: "literal", value: "hi" }
            }
        ]);

        expect(assembly.success).toBe(true);
        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);
        const result = registry.compile("app");
        const text = result.model?.components.find((c) => c.id === "plain");
        expect(text).toBeDefined();
        expect(text?.props.display).toBeUndefined();
        expect(text?.props.label).toBeUndefined();
    });
});