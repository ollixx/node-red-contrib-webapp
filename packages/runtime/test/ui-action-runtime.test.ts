import { createRequire } from "node:module";

import { beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const registerWebappNodes = require("../../../nodes/webapp.js") as {
    __test__: {
        applyPreviewAction: (RED: PreviewRedStub, appId: string, actionId: string, parameters: Record<string, string>, definitions: PreviewDefinition[]) => PreviewActionResult;
        applyStoreOperation: (currentState: Record<string, unknown>, storeDefinition: PreviewStoreDefinition, operation: PreviewStoreOperation) => PreviewStoreResult;
        getPreviewMessages: (appId: string) => Array<{ at: string; message: { ui: Record<string, unknown> } }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: PreviewDefinition[]) => { status: number; body: string };
        resetPreview: (appId: string) => void;
    };
};
const customersCrudDefinitions = require("../../../examples/customers-crud/flow.json") as PreviewDefinition[];

interface PreviewDefinition {
    id: string;
    type: string;
    [key: string]: unknown;
}

interface PreviewActionResult {
    success: boolean;
    status?: number;
    body?: string;
    redirectLocation?: string;
    dialogId?: string;
    message?: {
        ui: {
            action?: string;
            componentId?: string;
            dialog?: {
                id: string;
                open: boolean;
            };
            navigation?: {
                id: string;
                to: string;
            };
            queries?: Array<{
                id: string;
                queryPath: string;
                mode: string;
            }>;
            payload?: {
                values?: Record<string, string>;
            };
            statePatch?: Record<string, unknown>;
        };
    };
}

interface PreviewNodeStub {
    send: ReturnType<typeof vi.fn>;
}

interface PreviewStoreDefinition {
    id: string;
    statePath: string;
    initialValue?: unknown;
}

interface PreviewStoreOperation {
    id: string;
    op: "set" | "patch" | "delete" | "replace" | "reset";
    path?: string;
    value?: unknown;
}

interface PreviewStoreResult {
    nextState: Record<string, unknown>;
    notification: {
        ui: {
            store: {
                id: string;
                event: "changed";
                op: string;
                path?: string;
                fullPath: string;
                value?: unknown;
                previousValue?: unknown;
                origin: "node-red" | "client";
            };
        };
    };
}

interface PreviewRedStub {
    nodes: {
        getNode: (id: string) => PreviewNodeStub | undefined;
    };
}

function createPreviewRedStub(nodeIds: string[]): { RED: PreviewRedStub; nodes: Map<string, PreviewNodeStub> } {
    const nodes = new Map<string, PreviewNodeStub>(
        nodeIds.map((id) => [id, { send: vi.fn() }])
    );

    return {
        RED: {
            nodes: {
                getNode(id: string) {
                    return nodes.get(id);
                }
            }
        },
        nodes
    };
}

function cloneDefinitions(): PreviewDefinition[] {
    return JSON.parse(JSON.stringify(customersCrudDefinitions)) as PreviewDefinition[];
}

describe("ui-action preview runtime", () => {
    beforeEach(() => {
        registerWebappNodes.__test__.resetPreview("customersApp");
    });

    it("opens the customer editor dialog for the legacy open action and records the UI message", () => {
        const { RED, nodes } = createPreviewRedStub(["openCustomerEditor"]);

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "openCustomerEditor",
            {
                location: "/customers",
                sourceId: "newCustomerButton",
                event: "click"
            },
            cloneDefinitions()
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers");
        expect(applied.dialogId).toBe("customerEditor");
        expect(applied.message?.ui.action).toBe("openCustomerEditor");
        expect(applied.message?.ui.componentId).toBe("newCustomerButton");
        expect(applied.message?.ui.dialog).toEqual({
            id: "customerEditor",
            open: true
        });
        expect(applied.message?.ui.statePatch).toEqual(expect.objectContaining({
            "ui.dialogs.customerEditor.open": true,
            "draft.customerId": ""
        }));
        expect(nodes.get("openCustomerEditor")?.send).toHaveBeenCalledTimes(1);
        expect(registerWebappNodes.__test__.getPreviewMessages("customersApp")).toHaveLength(1);

        const page = registerWebappNodes.__test__.renderAppPage("customersApp", "/customers", "customerEditor", cloneDefinitions());

        expect(page.status).toBe(200);
        expect(page.body).toContain("Edit customer");
    });

    it("persists form values through the legacy save action and closes the dialog", () => {
        const { RED, nodes } = createPreviewRedStub(["saveCustomer"]);

        registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "openCustomerEditor",
            {
                location: "/customers/c-200",
                sourceId: "editCustomerButton",
                event: "click",
                id: "c-200"
            },
            cloneDefinitions()
        );

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "saveCustomer",
            {
                location: "/customers/c-200",
                sourceId: "customerForm",
                event: "submit",
                name: "Grace Hopper",
                email: "grace+updated@example.com",
                status: "active"
            },
            cloneDefinitions()
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers");
        expect(applied.dialogId).toBeUndefined();
        expect(applied.message?.ui.action).toBe("saveCustomer");
        expect(applied.message?.ui.payload?.values).toEqual({
            name: "Grace Hopper",
            email: "grace+updated@example.com",
            status: "active"
        });
        expect(applied.message?.ui.dialog).toEqual({
            id: "customerEditor",
            open: false
        });
        expect(applied.message?.ui.statePatch).toEqual(expect.objectContaining({
            "draft.customerId": "c-200",
            "ui.dialogs.customerEditor.open": false
        }));
        expect(nodes.get("saveCustomer")?.send).toHaveBeenCalledTimes(1);
        expect(registerWebappNodes.__test__.getPreviewMessages("customersApp")).toHaveLength(2);

        const page = registerWebappNodes.__test__.renderAppPage("customersApp", "/customers", undefined, cloneDefinitions());

        expect(page.status).toBe(200);
        expect(page.body).toContain("grace+updated@example.com");
    });

    it("resolves the legacy detail navigation action against the selected row", () => {
        const { RED, nodes } = createPreviewRedStub(["openCustomerDetail"]);

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "openCustomerDetail",
            {
                location: "/customers",
                sourceId: "customersTable",
                event: "select",
                rowId: "c-200"
            },
            cloneDefinitions()
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers/c-200");
        expect(applied.message?.ui.action).toBe("openCustomerDetail");
        expect(applied.message?.ui.navigation).toEqual({
            id: "openCustomerDetail",
            to: "/customers/c-200"
        });
        expect(nodes.get("openCustomerDetail")?.send).toHaveBeenCalledTimes(1);
        expect(registerWebappNodes.__test__.getPreviewMessages("customersApp")).toHaveLength(1);

        const page = registerWebappNodes.__test__.renderAppPage("customersApp", "/customers/c-200", undefined, cloneDefinitions());

        expect(page.status).toBe(200);
        expect(page.body).toContain("Grace Hopper");
    });

    it("executes typed navigate actions with path targeting directly in the preview", () => {
        const { RED, nodes } = createPreviewRedStub(["typedOpenCustomerDetail"]);
        const definitions = cloneDefinitions();

        definitions.push({
            type: "ui-action",
            id: "typedOpenCustomerDetail",
            actionType: "navigate",
            targetMode: "path",
            target: "app",
            to: "/customers/:id"
        });

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedOpenCustomerDetail",
            {
                location: "/customers",
                sourceId: "customersTable",
                event: "select",
                id: "c-300"
            },
            definitions
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers/c-300");
        expect(applied.message?.ui.action).toBe("typedOpenCustomerDetail");
        expect(applied.message?.ui.navigation).toEqual({
            id: "typedOpenCustomerDetail",
            to: "/customers/c-300"
        });
        expect(nodes.get("typedOpenCustomerDetail")?.send).toHaveBeenCalledTimes(1);
    });

    it("keeps typed out-port navigate actions on the current page and only emits the action message", () => {
        const { RED, nodes } = createPreviewRedStub(["typedGoToCustomers"]);
        const definitions = cloneDefinitions();

        definitions.push({
            type: "ui-action",
            id: "typedGoToCustomers",
            actionType: "navigate",
            targetMode: "out-port",
            to: "/customers"
        });

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedGoToCustomers",
            {
                location: "/customers/c-200",
                sourceId: "backToCustomersButton",
                event: "click"
            },
            definitions
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers/c-200");
        expect(applied.message?.ui.action).toBe("typedGoToCustomers");
        expect(applied.message?.ui.navigation).toBeUndefined();
        expect(nodes.get("typedGoToCustomers")?.send).toHaveBeenCalledTimes(1);
    });

    it("treats typed out-port trigger actions as message-only actions", () => {
        const { RED, nodes } = createPreviewRedStub(["typedRefreshCustomers"]);
        const definitions = cloneDefinitions();

        definitions.push({
            type: "ui-action",
            id: "typedRefreshCustomers",
            actionType: "trigger",
            targetMode: "out-port"
        });

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedRefreshCustomers",
            {
                location: "/customers",
                sourceId: "refreshCustomersButton",
                event: "click"
            },
            definitions
        );

        expect(applied.success).toBe(true);
        expect(applied.redirectLocation).toBe("/customers");
        expect(applied.dialogId).toBeUndefined();
        expect(applied.message?.ui.action).toBe("typedRefreshCustomers");
        expect(applied.message?.ui.navigation).toBeUndefined();
        expect(applied.message?.ui.dialog).toBeUndefined();
        expect(nodes.get("typedRefreshCustomers")?.send).toHaveBeenCalledTimes(1);
    });

    it("derives preview query refreshes from ui-query refreshAction references", () => {
        const { RED, nodes } = createPreviewRedStub(["refreshCustomers", "customersQuery"]);

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "refreshCustomers",
            {
                location: "/customers",
                sourceId: "refreshCustomersButton",
                event: "click"
            },
            cloneDefinitions()
        );

        expect(applied.success).toBe(true);
        expect(applied.message?.ui.action).toBe("refreshCustomers");
        expect(applied.message?.ui.queries).toEqual([
            {
                id: "customersQuery",
                queryPath: "customers.list",
                mode: "refresh"
            }
        ]);
        expect(applied.message?.ui.statePatch).toEqual(expect.objectContaining({
            "ui.queries.customersQuery.loading": false,
            "ui.queries.customersQuery.status": "success"
        }));
        expect(nodes.get("refreshCustomers")?.send).toHaveBeenCalledTimes(1);
        expect(nodes.get("customersQuery")?.send).toHaveBeenCalledTimes(1);
    });

    it("shows a dialog for typed show actions with dialog targets", () => {
        const { RED, nodes } = createPreviewRedStub(["typedOpenCustomerEditor"]);
        const definitions = cloneDefinitions();

        definitions.push({
            type: "ui-action",
            id: "typedOpenCustomerEditor",
            actionType: "show",
            targetMode: "path",
            target: "dialog:customerEditor"
        });

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedOpenCustomerEditor",
            {
                location: "/customers",
                sourceId: "newCustomerButton",
                event: "click"
            },
            definitions
        );

        expect(applied.success).toBe(true);
        expect(applied.dialogId).toBe("customerEditor");
        expect(applied.message?.ui.dialog).toEqual({
            id: "customerEditor",
            open: true
        });
        expect(nodes.get("typedOpenCustomerEditor")?.send).toHaveBeenCalledTimes(1);
    });

    it("hides a dialog for typed hide actions with dialog targets", () => {
        const { RED, nodes } = createPreviewRedStub(["typedCloseCustomerEditor"]);
        const definitions = cloneDefinitions();

        definitions.push({
            type: "ui-action",
            id: "typedCloseCustomerEditor",
            actionType: "hide",
            targetMode: "path",
            target: "dialog:customerEditor"
        });

        registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedCloseCustomerEditor",
            {
                location: "/customers",
                sourceId: "cancelCustomerButton",
                event: "click"
            },
            definitions
        );

        const applied = registerWebappNodes.__test__.applyPreviewAction(
            RED,
            "customersApp",
            "typedCloseCustomerEditor",
            {
                location: "/customers",
                sourceId: "cancelCustomerButton",
                event: "click"
            },
            definitions
        );

        expect(applied.success).toBe(true);
        expect(applied.dialogId).toBeUndefined();
        expect(applied.message?.ui.dialog).toEqual({
            id: "customerEditor",
            open: false
        });
        expect(nodes.get("typedCloseCustomerEditor")?.send).toHaveBeenCalledTimes(2);
    });
});

describe("ui-store preview runtime", () => {
    it("applies set, patch, delete, replace and reset operations relative to the store root", () => {
        const storeDefinition: PreviewStoreDefinition = {
            id: "draftStore",
            statePath: "draft",
            initialValue: {
                customer: {
                    name: "Ada",
                    email: "ada@example.com",
                    status: "active"
                }
            }
        };

        const setResult = registerWebappNodes.__test__.applyStoreOperation({}, storeDefinition, {
            id: "draftStore",
            op: "set",
            path: "customer.name",
            value: "Grace"
        });

        expect(setResult.nextState).toEqual({
            draft: {
                customer: {
                    name: "Grace"
                }
            }
        });
        expect(setResult.notification.ui.store).toEqual(expect.objectContaining({
            id: "draftStore",
            op: "set",
            fullPath: "draft.customer.name",
            value: "Grace",
            previousValue: undefined,
            origin: "node-red"
        }));

        const patchResult = registerWebappNodes.__test__.applyStoreOperation(setResult.nextState, storeDefinition, {
            id: "draftStore",
            op: "patch",
            path: "customer",
            value: {
                email: "grace@example.com",
                status: "vip"
            }
        });

        expect(patchResult.nextState).toEqual({
            draft: {
                customer: {
                    name: "Grace",
                    email: "grace@example.com",
                    status: "vip"
                }
            }
        });

        const deleteResult = registerWebappNodes.__test__.applyStoreOperation(patchResult.nextState, storeDefinition, {
            id: "draftStore",
            op: "delete",
            path: "customer.status"
        });

        expect(deleteResult.nextState).toEqual({
            draft: {
                customer: {
                    name: "Grace",
                    email: "grace@example.com"
                }
            }
        });

        const replaceResult = registerWebappNodes.__test__.applyStoreOperation(deleteResult.nextState, storeDefinition, {
            id: "draftStore",
            op: "replace",
            value: {
                customer: {
                    name: "Katherine"
                },
                flags: {
                    isSaving: true
                }
            }
        });

        expect(replaceResult.nextState).toEqual({
            draft: {
                customer: {
                    name: "Katherine"
                },
                flags: {
                    isSaving: true
                }
            }
        });

        const resetResult = registerWebappNodes.__test__.applyStoreOperation(replaceResult.nextState, storeDefinition, {
            id: "draftStore",
            op: "reset"
        });

        expect(resetResult.nextState).toEqual({
            draft: {
                customer: {
                    name: "Ada",
                    email: "ada@example.com",
                    status: "active"
                }
            }
        });
        expect(resetResult.notification.ui.store).toEqual(expect.objectContaining({
            op: "reset",
            fullPath: "draft",
            value: storeDefinition.initialValue
        }));
    });
});