import { describe, expect, it } from "vitest";

import { customersCrudExampleFlowFixture } from "@node-red-contrib-webapp/schema";

import { assembleNodeSet, createRuntimeApi, createRuntimeRegistry } from "../src";

describe("customers CRUD example flow", () => {
    it("assembles the shipped flow into a valid compiled app and integration model", () => {
        const assembly = assembleNodeSet(customersCrudExampleFlowFixture);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        expect(assembly.data.integration.actions.map((action) => action.id)).toEqual([
            "closeCustomerEditor",
            "deleteCustomer",
            "goToCustomers",
            "navToCustomers",
            "openCustomerDetail",
            "openCustomerEditor",
            "refreshCustomers",
            "saveCustomer"
        ]);
        expect(assembly.data.integration.actions.filter((action) => action.actionType === "navigate").map((action) => action.id)).toEqual([
            "goToCustomers",
            "navToCustomers",
            "openCustomerDetail"
        ]);
        expect(assembly.data.integration.navigations.map((navigation) => navigation.id)).toEqual([
            "goToCustomers",
            "navToCustomers",
            "openCustomerDetail"
        ]);

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const compiled = registry.compile("customersApp");

        expect(compiled.diagnostics).toEqual([]);
        expect(compiled.model?.routes.map((route) => route.id)).toEqual(["routeHome", "customers", "customerDetail"]);
        expect(compiled.model?.dialogs.map((dialog) => dialog.id)).toEqual(["customerEditor"]);
        expect(compiled.model?.components.map((component) => component.id)).toEqual(
            expect.arrayContaining([
                "pageTitle",
                "homeWelcomeHeading",
                "homeWelcomeBody",
                "homeGoToCustomersButton",
                "homeTipAlert",
                "newCustomerButton",
                "refreshCustomersButton",
                "customersTable",
                "editorStatus",
                "backToCustomersButton",
                "editCustomerButton",
                "deleteCustomerButton",
                "detailRouteTitle",
                "detailCustomerId",
                "customerStatusBadge",
                "customerEditorContainer",
                "customerNameInput",
                "customerEmailInput",
                "customerStatusInput",
                "cancelCustomerButton",
                "saveCustomerButton"
            ])
        );
        expect(compiled.model?.components).toHaveLength(21);
    });

    it("home route (/) renders non-empty content — all regions are not empty", () => {
        const assembly = assembleNodeSet(customersCrudExampleFlowFixture);
        expect(assembly.success).toBe(true);
        if (!assembly.success) return;

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);
        const compiled = registry.compile("customersApp");
        expect(compiled.diagnostics).toEqual([]);

        const homeRoute = compiled.model?.routes.find((r) => r.id === "routeHome");
        expect(homeRoute).toBeDefined();
        // The home route must have at least one component mounted under it.
        // Components on home route use named mount "routeHome.content".
        const homeComponents = compiled.model?.components.filter(
            (c) => String(c.mount ?? "").startsWith("routeHome.")
        );
        expect(homeComponents?.length).toBeGreaterThan(0);
    });

    it("serves the compiled example flow through the runtime API", () => {
        const assembly = assembleNodeSet(customersCrudExampleFlowFixture);

        expect(assembly.success).toBe(true);

        if (!assembly.success) {
            return;
        }

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

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

        expect(response.body.diagnostics).toEqual([]);
        expect(response.body.model?.title).toBe("Customers CRM");
    });
});