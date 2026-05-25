import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture, uiEventMessageSchema } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot, matchRouteLocation } from "../src";

describe("renderer MVP", () => {
    it("renders the customers fixture across routes, slots, and dialogs", () => {
        const app = createRendererApp(customersCrudAppModelFixture, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            state: {
                draft: {
                    customer: {
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        status: "active"
                    },
                    isSaving: false
                }
            },
            queries: {
                customers: {
                    list: [
                        {
                            id: "cust-1",
                            name: "Ada Lovelace",
                            email: "ada@example.com",
                            status: "active"
                        }
                    ],
                    current: {
                        id: "cust-1",
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        status: "active"
                    }
                }
            }
        });

        const listSnapshot = app.render();
        const pageTitle = findComponentInSnapshot(listSnapshot, "pageTitle");
        const newCustomerButton = findComponentInSnapshot(listSnapshot, "newCustomerButton");
        const refreshCustomersButton = findComponentInSnapshot(listSnapshot, "refreshCustomersButton");
        const customersTable = findComponentInSnapshot(listSnapshot, "customersTable");

        expect(listSnapshot.route.id).toBe("customers");
        expect(pageTitle?.kind).toBe("text");
        expect(pageTitle && "text" in pageTitle ? pageTitle.text : undefined).toBe("Customers");
        expect(newCustomerButton?.kind).toBe("button");
        expect(newCustomerButton && "label" in newCustomerButton ? newCustomerButton.label : undefined).toBe("New customer");
        expect(refreshCustomersButton?.kind).toBe("button");
        expect(refreshCustomersButton?.disabled).toBe(false);
        expect(customersTable?.kind).toBe("table");
        expect(customersTable && "rows" in customersTable ? customersTable.rows : []).toHaveLength(1);

        const openDialogDispatch = app.dispatchEvent("newCustomerButton", "click", {
            source: "toolbar"
        });
        const customerForm = findComponentInSnapshot(openDialogDispatch.snapshot, "customerForm");
        const editorStatus = findComponentInSnapshot(openDialogDispatch.snapshot, "editorStatus");
        const cancelCustomerButton = findComponentInSnapshot(openDialogDispatch.snapshot, "cancelCustomerButton");
        const saveCustomerButton = findComponentInSnapshot(openDialogDispatch.snapshot, "saveCustomerButton");

        expect(uiEventMessageSchema.safeParse(openDialogDispatch.message).success).toBe(true);
        expect(openDialogDispatch.message.ui.action).toBe("openCustomerEditor");
        expect(openDialogDispatch.message.ui.dialog).toEqual({
            id: "customerEditor",
            open: true
        });
        expect(openDialogDispatch.message.ui.statePatch).toEqual({
            "ui.dialogs.customerEditor.open": true
        });
        expect(openDialogDispatch.snapshot.dialogs.map((dialog) => dialog.id)).toEqual(["customerEditor"]);
        expect(editorStatus?.kind).toBe("text");
        expect(editorStatus && "text" in editorStatus ? editorStatus.text : undefined).toBe("Editing customer");
        expect(customerForm?.kind).toBe("form");
        expect(customerForm && "fields" in customerForm ? customerForm.fields : []).toEqual([
            { name: "name", value: "Ada Lovelace" },
            { name: "email", value: "ada@example.com" },
            { name: "status", value: "active" }
        ]);
        expect(cancelCustomerButton?.kind).toBe("button");
        expect(saveCustomerButton?.kind).toBe("button");
        expect(saveCustomerButton?.disabled).toBe(false);

        const submitDispatch = app.dispatchEvent("customerForm", "submit", {
            values: {
                name: "Grace Hopper",
                email: "grace@example.com",
                status: "invited"
            }
        });
        const updatedForm = findComponentInSnapshot(submitDispatch.snapshot, "customerForm");

        expect(uiEventMessageSchema.safeParse(submitDispatch.message).success).toBe(true);
        expect(submitDispatch.message.ui.action).toBe("saveCustomer");
        expect(submitDispatch.message.ui.statePatch).toEqual({
            "draft.customer": {
                name: "Grace Hopper",
                email: "grace@example.com",
                status: "invited"
            }
        });
        expect(updatedForm && "fields" in updatedForm ? updatedForm.fields : []).toEqual([
            { name: "name", value: "Grace Hopper" },
            { name: "email", value: "grace@example.com" },
            { name: "status", value: "invited" }
        ]);

        const refreshDispatch = app.dispatchEvent("refreshCustomersButton", "click");

        expect(uiEventMessageSchema.safeParse(refreshDispatch.message).success).toBe(true);
        expect(refreshDispatch.message.ui.action).toBe("refreshCustomers");
        expect(refreshDispatch.message.ui.queries).toEqual([
            {
                id: "customersQuery",
                queryPath: "customers.list",
                mode: "refresh"
            }
        ]);
        expect(refreshDispatch.message.ui.statePatch).toEqual({
            "ui.queries.customersQuery.loading": true,
            "ui.queries.customersQuery.status": "refreshing"
        });
        expect(findComponentInSnapshot(refreshDispatch.snapshot, "refreshCustomersButton")?.disabled).toBe(true);

        const refreshedSnapshot = app.replaceQueries({
            customers: {
                list: [
                    {
                        id: "cust-1",
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        status: "active"
                    },
                    {
                        id: "cust-2",
                        name: "Grace Hopper",
                        email: "grace@example.com",
                        status: "invited"
                    }
                ],
                current: {
                    id: "cust-1",
                    name: "Ada Lovelace",
                    email: "ada@example.com",
                    status: "active"
                }
            }
        });

        expect(findComponentInSnapshot(refreshedSnapshot, "refreshCustomersButton")?.disabled).toBe(false);

        const closeDialogDispatch = app.dispatchEvent("cancelCustomerButton", "click");

        expect(uiEventMessageSchema.safeParse(closeDialogDispatch.message).success).toBe(true);
        expect(closeDialogDispatch.message.ui.dialog).toEqual({
            id: "customerEditor",
            open: false
        });
        expect(closeDialogDispatch.snapshot.dialogs).toEqual([]);
        expect(findComponentInSnapshot(closeDialogDispatch.snapshot, "editorStatus")).toBeUndefined();

        const detailDispatch = app.dispatchEvent("customersTable", "select", {
            row: {
                id: "cust-1",
                name: "Ada Lovelace"
            }
        });
        const detailBackButton = findComponentInSnapshot(detailDispatch.snapshot, "backToCustomersButton");
        const detailEditButton = findComponentInSnapshot(detailDispatch.snapshot, "editCustomerButton");
        const detailDeleteButton = findComponentInSnapshot(detailDispatch.snapshot, "deleteCustomerButton");
        const detailSummaryAfterSelect = findComponentInSnapshot(detailDispatch.snapshot, "detailSummary");

        expect(uiEventMessageSchema.safeParse(detailDispatch.message).success).toBe(true);
        expect(detailDispatch.message.ui.navigation).toEqual({
            id: "openCustomerDetail",
            to: "/customers/cust-1"
        });
        expect(detailDispatch.snapshot.route.id).toBe("customerDetail");
        expect(detailDispatch.snapshot.params).toEqual({
            id: "cust-1"
        });
        expect(detailBackButton?.kind).toBe("button");
        expect(detailEditButton?.kind).toBe("button");
        expect(detailDeleteButton?.kind).toBe("button");
        expect(detailSummaryAfterSelect?.kind).toBe("card");
        expect(detailSummaryAfterSelect && "data" in detailSummaryAfterSelect ? detailSummaryAfterSelect.data : undefined).toEqual({
            id: "cust-1",
            name: "Ada Lovelace",
            email: "ada@example.com",
            status: "active"
        });

        const backDispatch = app.dispatchEvent("backToCustomersButton", "click");

        expect(uiEventMessageSchema.safeParse(backDispatch.message).success).toBe(true);
        expect(backDispatch.message.ui.navigation).toEqual({
            id: "goToCustomers",
            to: "/customers"
        });
        expect(backDispatch.snapshot.route.id).toBe("customers");

        app.navigate("/customers/cust-1");

        const editFromDetailDispatch = app.dispatchEvent("editCustomerButton", "click");

        expect(uiEventMessageSchema.safeParse(editFromDetailDispatch.message).success).toBe(true);
        expect(editFromDetailDispatch.message.ui.dialog).toEqual({
            id: "customerEditor",
            open: true
        });
        expect(editFromDetailDispatch.snapshot.dialogs.map((dialog) => dialog.id)).toEqual(["customerEditor"]);

        const closeDetailDialogDispatch = app.dispatchEvent("cancelCustomerButton", "click");

        expect(uiEventMessageSchema.safeParse(closeDetailDialogDispatch.message).success).toBe(true);
        expect(closeDetailDialogDispatch.snapshot.dialogs).toEqual([]);

        const deleteDispatch = app.dispatchEvent("deleteCustomerButton", "click", {
            row: {
                id: "cust-1"
            }
        });

        expect(uiEventMessageSchema.safeParse(deleteDispatch.message).success).toBe(true);
        expect(deleteDispatch.message.ui.navigation).toEqual({
            id: "deleteCustomer",
            to: "/customers"
        });
        expect(deleteDispatch.snapshot.route.id).toBe("customers");

        const detailSnapshot = app.navigate("/customers/cust-1");
        const detailSummaryAfterNavigate = findComponentInSnapshot(detailSnapshot, "detailSummary");

        expect(detailSnapshot.route.id).toBe("customerDetail");
        expect(detailSnapshot.params).toEqual({
            id: "cust-1"
        });
        expect(detailSummaryAfterNavigate?.kind).toBe("card");
        expect(detailSummaryAfterNavigate && "data" in detailSummaryAfterNavigate ? detailSummaryAfterNavigate.data : undefined).toEqual({
            id: "cust-1",
            name: "Ada Lovelace",
            email: "ada@example.com",
            status: "active"
        });
    });

    it("matches parameterized routes deterministically", () => {
        const match = matchRouteLocation("/customers/cust-42", customersCrudAppModelFixture);

        expect(match.route.id).toBe("customerDetail");
        expect(match.params).toEqual({
            id: "cust-42"
        });
    });

    it("renders layout-scoped components alongside route-scoped content", () => {
        const app = createRendererApp({
            ...customersCrudAppModelFixture,
            components: [
                ...customersCrudAppModelFixture.components,
                {
                    id: "globalFooterText",
                    kind: "text",
                    mount: "layout:customerShell/footer",
                    bind: {
                        value: {
                            kind: "literal",
                            value: "Shared footer"
                        }
                    },
                    props: {},
                    events: []
                }
            ]
        }, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers"
        });

        const snapshot = app.render();
        const footerText = findComponentInSnapshot(snapshot, "globalFooterText");

        expect(footerText?.kind).toBe("text");
        expect(footerText && "text" in footerText ? footerText.text : undefined).toBe("Shared footer");
    });
});