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
            "openCustomerEditor",
            "refreshCustomers",
            "saveCustomer"
        ]);
        expect(assembly.data.integration.navigations.map((navigation) => navigation.id)).toEqual([
            "deleteCustomer",
            "goToCustomers",
            "openCustomerDetail"
        ]);

        const registry = createRuntimeRegistry();
        registry.registerMany(assembly.data.contributions);

        const compiled = registry.compile("customersApp");

        expect(compiled.diagnostics).toEqual([]);
        expect(compiled.model?.routes.map((route) => route.id)).toEqual(["customers", "customerDetail"]);
        expect(compiled.model?.dialogs.map((dialog) => dialog.id)).toEqual(["customerEditor"]);
        expect(compiled.model?.components.map((component) => component.id)).toEqual(
            expect.arrayContaining([
                "pageTitle",
                "newCustomerButton",
                "refreshCustomersButton",
                "customersTable",
                "editorStatus",
                "backToCustomersButton",
                "editCustomerButton",
                "deleteCustomerButton",
                "detailRouteTitle",
                "detailCustomerId",
                "customerForm",
                "cancelCustomerButton",
                "saveCustomerButton"
            ])
        );
        expect(compiled.model?.components).toHaveLength(13);
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