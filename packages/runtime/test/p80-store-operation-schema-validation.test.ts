import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P80 — Bugfix: Store operations must be validated at runtime against
 * storeOperationSchema before applyStoreOperation is called.
 *
 * Before this fix, normalizeStoreOperationMessage would return an operation
 * object, and it would be passed directly to applyStoreOperation without any
 * schema validation. This meant:
 *   - "set" without a value → runs with value=undefined silently
 *   - "patch" without a path → silently corrupts state (patching root)
 *   - "delete" without a path → silently corrupts state
 *
 * After the fix, the handler calls storeOperationSchema.safeParse(operation)
 * before applyStoreOperation. On failure it reports a structured error
 * { severity: "error", code: "server.store.invalid-operation" } with the
 * first Zod message (e.g. "Store operation 'set' requires a value."), calls
 * done(err), and does NOT send/apply anything.
 *
 * Pass-through for unrelated messages (no ui.store / wrong id) is unchanged.
 */

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => unknown;
                options: {
                    inputHandler: (
                        node: unknown,
                        msg: unknown,
                        send: (msg: unknown) => void,
                        done: (err?: Error) => void
                    ) => void;
                };
            }
        >;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, Map<string, { state: unknown; timestamp: number }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            streamClients: Map<string, unknown>;
            RED: unknown;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
    };
};

const { runtimeNodeRegistry, runtimeState } = webapp.__test__;

const APP_ID = "testApp80";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID,
        root: APP_ID,
        name: "Test App",
        layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def as Record<string, unknown> });
}

function makeStoreNode(id: string, statePath: string) {
    const def = runtimeNodeRegistry["ui-store"].mapConfig({
        id,
        parent: APP_ID,
        statePath
    });
    return {
        id,
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(msg: string) { this.errors.push(msg); },
        warn(msg: string) { this.warns.push(msg); }
    };
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.RED = { log: { error: vi.fn(), warn: vi.fn() } };
});

// ---------------------------------------------------------------------------
// P80: storeOperationSchema validation in the runtime input handler
// ---------------------------------------------------------------------------

describe("P80: store-operation schema validation — invalid operations are rejected with structured error", () => {
    it("set without value reports server.store.invalid-operation with first Zod message", () => {
        registerApp();
        const node = makeStoreNode("store1", "items");
        const send = vi.fn();
        const done = vi.fn();

        // "set" requires a path AND a value; omitting value should trigger the validation
        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store1", op: "set", path: "items.0" } } }, // value missing
            send,
            done
        );

        // Must NOT apply the operation (send must NOT have been called with a store notification)
        expect(send).not.toHaveBeenCalled();

        // Must report a structured error with the correct code
        const errorMessages = node.errors.join("\n");
        expect(errorMessages).toContain("server.store.invalid-operation");
        // Must include a human-readable message from the schema
        expect(errorMessages).toContain("requires a value");

        // done() must have been called with an Error (Node-RED catch-node contract)
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("patch without path reports server.store.invalid-operation", () => {
        registerApp();
        const node = makeStoreNode("store2", "draft");
        const send = vi.fn();
        const done = vi.fn();

        // "patch" requires path; omitting it should fail validation
        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store2", op: "patch", value: { name: "Alice" } } } }, // path missing
            send,
            done
        );

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.invalid-operation");
        expect(node.errors.join("\n")).toContain("requires a path");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("delete without path reports server.store.invalid-operation", () => {
        registerApp();
        const node = makeStoreNode("store3", "draft");
        const send = vi.fn();
        const done = vi.fn();

        // "delete" requires path
        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store3", op: "delete" } } }, // path missing
            send,
            done
        );

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.invalid-operation");
        expect(node.errors.join("\n")).toContain("requires a path");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("replace without value reports server.store.invalid-operation", () => {
        registerApp();
        const node = makeStoreNode("store4", "draft");
        const send = vi.fn();
        const done = vi.fn();

        // "replace" requires value; no path required
        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store4", op: "replace" } } }, // value missing
            send,
            done
        );

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.invalid-operation");
        expect(node.errors.join("\n")).toContain("requires a value");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });
});

describe("P80: valid operations are NOT rejected", () => {
    it("valid set operation (path + value) proceeds without error", () => {
        registerApp();
        const node = makeStoreNode("store5", "draft");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store5", op: "set", path: "draft.name", value: "Alice" } } },
            send,
            done
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
        // done() may be called with no arguments (success path)
        if (done.mock.calls.length > 0) {
            expect(done).toHaveBeenCalledWith(); // no error arg
        }
    });

    it("valid replace operation (value, no path required) proceeds without error", () => {
        registerApp();
        const node = makeStoreNode("store6", "draft");
        const send = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store6", op: "replace", value: { name: "Bob" } } } },
            send,
            vi.fn()
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });

    it("valid reset operation (no path, no value required) proceeds without error", () => {
        registerApp();
        const node = makeStoreNode("store7", "draft");
        const send = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store7", op: "reset" } } },
            send,
            vi.fn()
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });
});

describe("P80: pass-through for non-store messages is unchanged", () => {
    it("message without ui.store is passed through unchanged", () => {
        registerApp();
        const node = makeStoreNode("store8", "data");
        const send = vi.fn();

        const msg = { payload: "hello" };
        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        expect(send).toHaveBeenCalledWith(msg);
        expect(node.errors).toHaveLength(0);
    });

    it("message with ui.store for a different store id is passed through unchanged", () => {
        registerApp();
        const node = makeStoreNode("store9", "data");
        const send = vi.fn();

        const msg = { ui: { store: { id: "other-store", op: "set", path: "x", value: 1 } } };
        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        expect(send).toHaveBeenCalledWith(msg);
        expect(node.errors).toHaveLength(0);
    });
});
