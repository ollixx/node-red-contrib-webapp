import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

interface NodeStub {
    id: string;
    send: ReturnType<typeof vi.fn>;
}

const registerWebappNodes = require("../../../nodes/webapp.js") as {
    __test__: {
        applyStoreOperation: (currentState: Record<string, unknown>, storeDefinition: StoreDefinition, operation: StoreOperation) => StoreResult;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: NodeDefinition[]) => { status: number; body: string };
        buttonInputHandler: (node: NodeStub, msg: unknown, send: ReturnType<typeof vi.fn>, done: ReturnType<typeof vi.fn>) => void;
        actionInputHandler: (node: NodeStub, msg: unknown, send: ReturnType<typeof vi.fn>, done: ReturnType<typeof vi.fn>) => void;
        runtimeState: { RED: unknown };
    };
};

interface NodeDefinition {
    id: string;
    type: string;
    [key: string]: unknown;
}

interface StoreDefinition {
    id: string;
    statePath: string;
    initialValue?: unknown;
}

interface StoreOperation {
    id: string;
    op: "set" | "patch" | "delete" | "replace" | "reset";
    path?: string;
    value?: unknown;
}

interface StoreResult {
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

describe("renderAppPage: layout rendering", () => {
    it("renders the app root page from the app base layout preset", () => {
        const page = registerWebappNodes.__test__.renderAppPage("ordersApp", "/", undefined, [
            {
                type: "ui-app",
                id: "ordersApp",
                title: "Orders",
                layout: "app"
            },
            {
                type: "ui-text",
                id: "ordersHeader",
                mount: "ordersApp.header",
                value: {
                    kind: "literal",
                    value: "Orders home"
                }
            },
            {
                type: "ui-text",
                id: "ordersBody",
                mount: "ordersApp.content",
                value: {
                    kind: "literal",
                    value: "Start here"
                }
            }
        ]);

        expect(page.status).toBe(200);
        expect(page.body).toContain("Orders home");
        expect(page.body).toContain("Start here");
        expect(page.body).toContain("webapp-layout webapp-layout--app");
        expect(page.body).toContain("webapp-slot webapp-slot--header");
        expect(page.body).toContain("webapp-slot webapp-slot--content");
    });

    it("renders horizontal and vertical preset bodies with different orientations", () => {
        const definitions = [
            {
                type: "ui-app",
                id: "layoutApp",
                title: "Layout demo",
                layout: "vertical"
            },
            {
                type: "ui-text",
                id: "verticalText",
                mount: "layoutApp.content",
                value: {
                    kind: "literal",
                    value: "Top text"
                }
            },
            {
                type: "ui-route",
                id: "horizontalRoute",
                path: "/horizontal",
                layout: "horizontal"
            },
            {
                type: "ui-text",
                id: "leftText",
                mount: "route:/horizontal/content",
                value: {
                    kind: "literal",
                    value: "Left"
                }
            },
            {
                type: "ui-text",
                id: "rightText",
                mount: "route:/horizontal/content",
                value: {
                    kind: "literal",
                    value: "Right"
                }
            }
        ];

        const verticalPage = registerWebappNodes.__test__.renderAppPage("layoutApp", "/", undefined, definitions);
        const horizontalPage = registerWebappNodes.__test__.renderAppPage("layoutApp", "/horizontal", undefined, definitions);

        expect(verticalPage.status).toBe(200);
        expect(verticalPage.body).toContain("webapp-slot-body webapp-slot-body--vertical");
        expect(verticalPage.body).toContain("Top text");
        expect(horizontalPage.status).toBe(200);
        expect(horizontalPage.body).toContain("webapp-slot-body webapp-slot-body--horizontal");
        expect(horizontalPage.body).toContain("Left");
        expect(horizontalPage.body).toContain("Right");
    });
});

describe("P20a: ui-button click and ui-action wiring", () => {
    it("ui-button emits a click event on its output port when triggered", () => {
        const node: NodeStub = { id: "saveBtn", send: vi.fn() };
        const send = vi.fn();
        const done = vi.fn();

        registerWebappNodes.__test__.buttonInputHandler(node, { ui: { clientId: "client-1" } }, send, done);

        expect(send).toHaveBeenCalledTimes(1);
        const emitted = send.mock.calls[0][0] as { ui: { event: string; sourceId: string; clientId: string } };
        expect(emitted.ui.event).toBe("click");
        expect(emitted.ui.sourceId).toBe("saveBtn");
        expect(emitted.ui.clientId).toBe("client-1");
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("ui-button emits a click event without clientId when none is present in msg", () => {
        const node: NodeStub = { id: "myButton", send: vi.fn() };
        const send = vi.fn();
        const done = vi.fn();

        registerWebappNodes.__test__.buttonInputHandler(node, {}, send, done);

        expect(send).toHaveBeenCalledTimes(1);
        const emitted = send.mock.calls[0][0] as { ui: { event: string; sourceId: string; clientId: unknown } };
        expect(emitted.ui.event).toBe("click");
        expect(emitted.ui.sourceId).toBe("myButton");
        expect(emitted.ui.clientId).toBeUndefined();
    });

    it("ui-action forwards msg to wired output port when no targetId override", () => {
        const node: NodeStub = { id: "openDialogAction", send: vi.fn() };
        const send = vi.fn();
        const done = vi.fn();
        const msg = { ui: { action: { type: "trigger" } } };

        registerWebappNodes.__test__.actionInputHandler(node, msg, send, done);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("ui-action with msg.ui.action.targetId overrides wired target and sends directly to target node", () => {
        const node: NodeStub = { id: "openDialogAction", send: vi.fn() };
        const targetNode: NodeStub = { id: "customerDialog", send: vi.fn() };
        const send = vi.fn();
        const done = vi.fn();

        // Temporarily inject a minimal RED stub
        const savedRED = registerWebappNodes.__test__.runtimeState.RED;
        registerWebappNodes.__test__.runtimeState.RED = {
            nodes: {
                getNode: (id: string) => id === "customerDialog" ? targetNode : undefined
            }
        };

        const msg = { ui: { action: { type: "open", targetId: "customerDialog" } } };

        registerWebappNodes.__test__.actionInputHandler(node, msg, send, done);

        // Should NOT use the wired output (send not called)
        expect(send).not.toHaveBeenCalled();
        // Should send directly to the target node
        expect(targetNode.send).toHaveBeenCalledTimes(1);
        expect(done).toHaveBeenCalledTimes(1);

        registerWebappNodes.__test__.runtimeState.RED = savedRED;
    });
});

describe("ui-store runtime", () => {
    it("applies set, patch, delete, replace and reset operations relative to the store root", () => {
        const storeDefinition: StoreDefinition = {
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
