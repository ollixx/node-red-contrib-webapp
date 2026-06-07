import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture, uiEventMessageSchema } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot, matchRouteLocation } from "../src";

describe("renderer MVP", () => {
    it("renders the customers fixture across routes, slots, and dialogs", () => {
        const app = createRendererApp(customersCrudAppModelFixture, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/",
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

        const homeSnapshot = app.render();
        const pageTitle = findComponentInSnapshot(homeSnapshot, "pageTitle");

        expect(homeSnapshot.route.id).toBe("customersApp");
        expect(pageTitle?.kind).toBe("text");
        expect(pageTitle && "text" in pageTitle ? pageTitle.text : undefined).toBe("Customers");

        const listSnapshot = app.navigate("/customers");
        const newCustomerButton = findComponentInSnapshot(listSnapshot, "newCustomerButton");
        const refreshCustomersButton = findComponentInSnapshot(listSnapshot, "refreshCustomersButton");
        const customersTable = findComponentInSnapshot(listSnapshot, "customersTable");

        expect(listSnapshot.route.id).toBe("customers");
        expect(newCustomerButton?.kind).toBe("button");
        expect(newCustomerButton && "label" in newCustomerButton ? newCustomerButton.label : undefined).toBe("New customer");
        expect(refreshCustomersButton?.kind).toBe("button");
        expect(refreshCustomersButton?.disabled).toBe(false);
        expect(customersTable?.kind).toBe("table");
        expect(customersTable && "rows" in customersTable ? customersTable.rows : []).toHaveLength(1);

        const openDialogDispatch = app.dispatchEvent("newCustomerButton", "click", {
            source: "toolbar"
        });
        const customerNameInput = findComponentInSnapshot(openDialogDispatch.snapshot, "customerNameInput");
        const customerEmailInput = findComponentInSnapshot(openDialogDispatch.snapshot, "customerEmailInput");
        const customerStatusInput = findComponentInSnapshot(openDialogDispatch.snapshot, "customerStatusInput");
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
        expect(customerNameInput?.kind).toBe("input");
        expect(customerNameInput && "value" in customerNameInput ? customerNameInput.value : undefined).toBe("Ada Lovelace");
        expect(customerEmailInput?.kind).toBe("input");
        expect(customerEmailInput && "value" in customerEmailInput ? customerEmailInput.value : undefined).toBe("ada@example.com");
        expect(customerStatusInput?.kind).toBe("input");
        expect(customerStatusInput && "value" in customerStatusInput ? customerStatusInput.value : undefined).toBe("active");
        expect(cancelCustomerButton?.kind).toBe("button");
        expect(saveCustomerButton?.kind).toBe("button");
        expect(saveCustomerButton?.disabled).toBe(false);

        const nameChangeDispatch = app.dispatchEvent("customerNameInput", "change", {
            value: "Grace Hopper"
        });
        const emailChangeDispatch = app.dispatchEvent("customerEmailInput", "change", {
            value: "grace@example.com"
        });
        const statusChangeDispatch = app.dispatchEvent("customerStatusInput", "change", {
            value: "invited"
        });
        const updatedNameInput = findComponentInSnapshot(statusChangeDispatch.snapshot, "customerNameInput");
        const updatedEmailInput = findComponentInSnapshot(statusChangeDispatch.snapshot, "customerEmailInput");
        const updatedStatusInput = findComponentInSnapshot(statusChangeDispatch.snapshot, "customerStatusInput");
        const saveDispatch = app.dispatchEvent("saveCustomerButton", "click");

        expect(uiEventMessageSchema.safeParse(nameChangeDispatch.message).success).toBe(true);
        expect(nameChangeDispatch.message.ui.statePatch).toEqual({
            "draft.customer.name": "Grace Hopper"
        });
        expect(uiEventMessageSchema.safeParse(emailChangeDispatch.message).success).toBe(true);
        expect(emailChangeDispatch.message.ui.statePatch).toEqual({
            "draft.customer.email": "grace@example.com"
        });
        expect(uiEventMessageSchema.safeParse(statusChangeDispatch.message).success).toBe(true);
        expect(statusChangeDispatch.message.ui.statePatch).toEqual({
            "draft.customer.status": "invited"
        });
        expect(updatedNameInput && "value" in updatedNameInput ? updatedNameInput.value : undefined).toBe("Grace Hopper");
        expect(updatedEmailInput && "value" in updatedEmailInput ? updatedEmailInput.value : undefined).toBe("grace@example.com");
        expect(updatedStatusInput && "value" in updatedStatusInput ? updatedStatusInput.value : undefined).toBe("invited");
        expect(uiEventMessageSchema.safeParse(saveDispatch.message).success).toBe(true);
        expect(saveDispatch.message.ui.action).toBe("saveCustomer");
        expect(saveDispatch.message.ui.statePatch).toEqual({});

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
        expect(findComponentInSnapshot(closeDialogDispatch.snapshot, "editorStatus")?.kind).toBe("text");

        const detailDispatch = app.dispatchEvent("customersTable", "select", {
            row: {
                id: "cust-1",
                name: "Ada Lovelace"
            }
        });
        const detailBackButton = findComponentInSnapshot(detailDispatch.snapshot, "backToCustomersButton");
        const detailEditButton = findComponentInSnapshot(detailDispatch.snapshot, "editCustomerButton");
        const detailDeleteButton = findComponentInSnapshot(detailDispatch.snapshot, "deleteCustomerButton");
        const detailCustomerId = findComponentInSnapshot(detailDispatch.snapshot, "detailCustomerId");

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
        expect(detailCustomerId?.kind).toBe("text");
        expect(detailCustomerId && "text" in detailCustomerId ? detailCustomerId.text : undefined).toBe("cust-1");

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
        const detailCustomerIdAfterNavigate = findComponentInSnapshot(detailSnapshot, "detailCustomerId");

        expect(detailSnapshot.route.id).toBe("customerDetail");
        expect(detailSnapshot.params).toEqual({
            id: "cust-1"
        });
        expect(detailCustomerIdAfterNavigate?.kind).toBe("text");
        expect(detailCustomerIdAfterNavigate && "text" in detailCustomerIdAfterNavigate ? detailCustomerIdAfterNavigate.text : undefined).toBe("cust-1");
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
                    mount: "layout:app/footer",
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
            location: "/"
        });

        const snapshot = app.render();
        const footerText = findComponentInSnapshot(snapshot, "globalFooterText");

        expect(footerText?.kind).toBe("text");
        expect(footerText && "text" in footerText ? footerText.text : undefined).toBe("Shared footer");
    });

    it("renders route-param bindings and dialog child layouts on detail routes", () => {
        const app = createRendererApp(customersCrudAppModelFixture, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/cust-42",
            queries: {
                customers: {
                    list: [],
                    current: {
                        id: "cust-42",
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        status: "active"
                    }
                }
            }
        });

        const snapshot = app.render();
        const detailCustomerId = findComponentInSnapshot(snapshot, "detailCustomerId");

        expect(snapshot.route.id).toBe("customerDetail");
        expect(snapshot.params).toEqual({
            id: "cust-42"
        });
        expect(detailCustomerId?.kind).toBe("text");
        expect(detailCustomerId && "text" in detailCustomerId ? detailCustomerId.text : undefined).toBe("cust-42");

        const openDialogDispatch = app.dispatchEvent("editCustomerButton", "click");
        const detailDialogContainer = findComponentInSnapshot(openDialogDispatch.snapshot, "customerEditorContainer");
        const detailDialogNameInput = findComponentInSnapshot(openDialogDispatch.snapshot, "customerNameInput");

        expect(detailDialogContainer?.kind).toBe("container");

        if (!detailDialogContainer || detailDialogContainer.kind !== "container") {
            return;
        }

        expect(detailDialogContainer.layoutId).toBe("grid");
        expect(detailDialogContainer.regions.some((region) => region.name === "content")).toBe(true);
        expect(detailDialogNameInput?.kind).toBe("input");
    });
});

// P67: the renderer resolves a `store` binding to the referenced store's
// current value via that store's statePath.
describe("P67: store bindings", () => {
    function textBoundToStore(storeId: string) {
        return {
            ...customersCrudAppModelFixture,
            components: [
                ...customersCrudAppModelFixture.components,
                {
                    id: "storeBoundText",
                    kind: "text" as const,
                    mount: "layout:app/footer",
                    bind: {
                        value: { kind: "store" as const, path: storeId }
                    },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("resolves a store binding to the store's value via its statePath", () => {
        const app = createRendererApp(textBoundToStore("draftStore"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/",
            state: { draft: { customer: "Ada Lovelace" } }
        });

        const text = findComponentInSnapshot(app.render(), "storeBoundText");

        expect(text?.kind).toBe("text");
        expect(text && "text" in text ? text.text : undefined).toBe("Ada Lovelace");
    });

    it("is robust to statePath renames — the binding references the store id, not the path", () => {
        const renamedIntegration = {
            ...customersCrudRuntimeIntegrationFixture,
            stores: customersCrudRuntimeIntegrationFixture.stores.map((store) =>
                store.id === "draftStore" ? { ...store, statePath: "drafts.active.customer", initialValue: undefined } : store
            )
        };

        const app = createRendererApp(textBoundToStore("draftStore"), {
            integration: renamedIntegration,
            location: "/",
            state: { drafts: { active: { customer: "Grace Hopper" } } }
        });

        const text = findComponentInSnapshot(app.render(), "storeBoundText");

        expect(text && "text" in text ? text.text : undefined).toBe("Grace Hopper");
    });

    it("resolves to undefined (empty text) when the store id is unknown", () => {
        const app = createRendererApp(textBoundToStore("noSuchStore"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/",
            state: { draft: { customer: "ignored" } }
        });

        const text = findComponentInSnapshot(app.render(), "storeBoundText");

        expect(text && "text" in text ? text.text : undefined).toBe("");
    });
});