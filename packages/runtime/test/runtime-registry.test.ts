import { describe, expect, it } from "vitest";

import { appModelSchema, customersCrudAppModelFixture } from "@node-red-contrib-webapp/schema";

import { createRuntimeApi, createContributionsFromAppModel, createRuntimeRegistry } from "../src";

describe("runtime registry", () => {
    it("keeps multiple apps isolated even when their internal ids overlap", () => {
        const registry = createRuntimeRegistry();
        const customersOnlyRegistry = createRuntimeRegistry();
        const ordersOnlyRegistry = createRuntimeRegistry();
        const secondAppFixture = {
            ...customersCrudAppModelFixture,
            id: "ordersApp",
            title: "Orders CRM"
        };

        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "customers-fixture"));
        registry.registerMany(createContributionsFromAppModel(secondAppFixture, "orders-fixture"));
        customersOnlyRegistry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "customers-fixture"));
        ordersOnlyRegistry.registerMany(createContributionsFromAppModel(secondAppFixture, "orders-fixture"));

        const customersResult = registry.compile("customersApp");
        const ordersResult = registry.compile("ordersApp");
        const customersBaseline = customersOnlyRegistry.compile("customersApp");
        const ordersBaseline = ordersOnlyRegistry.compile("ordersApp");

        expect(customersResult.diagnostics).toEqual([]);
        expect(ordersResult.diagnostics).toEqual([]);
        expect(customersResult).toEqual(customersBaseline);
        expect(ordersResult).toEqual(ordersBaseline);
    });

    it("compiles a deterministic normalized app model from registrations", () => {
        const contributions = createContributionsFromAppModel(customersCrudAppModelFixture, "fixture");
        const registryA = createRuntimeRegistry();
        const registryB = createRuntimeRegistry();

        registryA.registerMany(contributions);
        registryB.registerMany([...contributions].reverse());

        const resultA = registryA.compile(customersCrudAppModelFixture.id);
        const resultB = registryB.compile(customersCrudAppModelFixture.id);

        expect(resultA.diagnostics).toEqual([]);
        expect(resultB.diagnostics).toEqual([]);
        expect(resultA.model).toEqual(resultB.model);
        expect(appModelSchema.safeParse(resultA.model).success).toBe(true);
        expect(resultA.model?.components.map((component) => component.id)).toEqual([
            "detailRouteTitle",
            "pageTitle",
            "customerEditorContainer",
            "detailCustomerId",
            "backToCustomersButton",
            "editCustomerButton",
            "deleteCustomerButton",
            "customersTable",
            "newCustomerButton",
            "refreshCustomersButton",
            "editorStatus",
            "cancelCustomerButton",
            "saveCustomerButton",
            "customerNameInput",
            "customerEmailInput",
            "customerStatusInput",
            "detailContentContainer",
            "customersContentContainer"
        ]);
    });

    it("reports duplicate IDs and keeps the deterministic winner", () => {
        const registry = createRuntimeRegistry();

        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));
        registry.register({
            kind: "component",
            appId: customersCrudAppModelFixture.id,
            registrationId: "fixture:component:newCustomerButton:duplicate",
            definition: {
                id: "newCustomerButton",
                kind: "button",
                mount: "route:/customers/content/body",
                props: {
                    label: "Duplicate"
                },
                bind: {},
                events: []
            }
        });

        const result = registry.compile(customersCrudAppModelFixture.id);

        expect(result.model?.components.find((component) => component.id === "newCustomerButton")?.mount).toBe(
            "layout:customersListLayout/toolbar"
        );
        expect(result.diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: "duplicate-id",
                    registrationIds: ["fixture:component:newCustomerButton", "fixture:component:newCustomerButton:duplicate"]
                })
            ])
        );
    });

    it("reports invalid mounts and excludes invalid components from the compiled model", () => {
        const registry = createRuntimeRegistry();

        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));
        registry.register({
            kind: "component",
            appId: customersCrudAppModelFixture.id,
            registrationId: "fixture:component:broken",
            definition: {
                id: "brokenButton",
                kind: "button",
                mount: "dialog:missingDialog/content/actions",
                props: {
                    label: "Broken"
                },
                bind: {},
                events: []
            }
        });

        const result = registry.compile(customersCrudAppModelFixture.id);

        expect(result.model?.components.some((component) => component.id === "brokenButton")).toBe(false);
        expect(result.diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: "invalid-mount",
                    registrationIds: ["fixture:component:broken"]
                })
            ])
        );
    });
});

describe("runtime api", () => {
    it("serves multiple registered apps without cross-app leakage", () => {
        const registry = createRuntimeRegistry();
        const secondAppFixture = {
            ...customersCrudAppModelFixture,
            id: "ordersApp",
            title: "Orders CRM"
        };

        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "customers-fixture"));
        registry.registerMany(createContributionsFromAppModel(secondAppFixture, "orders-fixture"));

        const api = createRuntimeApi(registry);
        const customersResponse = api.handle({
            method: "GET",
            path: "/apps/customersApp/model"
        });
        const ordersResponse = api.handle({
            method: "GET",
            path: "/apps/ordersApp/model"
        });

        expect(customersResponse.status).toBe(200);
        expect(ordersResponse.status).toBe(200);

        if ("error" in customersResponse.body || "error" in ordersResponse.body) {
            return;
        }

        expect(customersResponse.body.diagnostics).toEqual([]);
        expect(ordersResponse.body.diagnostics).toEqual([]);
        expect(customersResponse.body.model?.id).toBe("customersApp");
        expect(ordersResponse.body.model?.id).toBe("ordersApp");
        expect(customersResponse.body.model?.title).toBe("Customers CRM");
        expect(ordersResponse.body.model?.title).toBe("Orders CRM");
    });

    it("exposes compiled app models through the runtime API surface", () => {
        const registry = createRuntimeRegistry();
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));

        const api = createRuntimeApi(registry);
        const response = api.handle({
            method: "GET",
            path: "/apps/customersApp/model"
        });

        expect(response.status).toBe(200);
        expect("error" in response.body).toBe(false);

        if ("error" in response.body) {
            return;
        }

        expect(response.body.appId).toBe("customersApp");
        expect(response.body.model).toEqual(registry.compile("customersApp").model);
        expect(response.body.diagnostics).toEqual([]);
    });
});