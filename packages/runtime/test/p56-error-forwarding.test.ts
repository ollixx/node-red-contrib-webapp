import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P56 — runtime structured logging + opt-in backend→frontend error forwarding
 * (ADR 0006). The runtime logs every framework failure WITH CONTEXT via
 * node.error / node.warn (structured shape), and — when the owning ui-app opts in
 * (forwardErrorsToClient) — forwards errors at/above its severity threshold to
 * connected clients over a new SSE "error" event, redacted. Default OFF.
 *
 * These tests drive the real webapp.js helpers directly. A fake SSE `res` records
 * every frame written so the forwarded "error" frames can be inspected.
 */

const require = createRequire(import.meta.url);

interface FakeRes {
    frames: string[];
    write(chunk: string): void;
    events(): Array<{ event: string; data: unknown }>;
}

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => Record<string, unknown>;
                options: { inputHandler: (node: unknown, msg: unknown, send: unknown, done: unknown) => void };
            }
        >;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
            streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            RED: unknown;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
        reportRuntimeError: (
            node: unknown,
            opts: { severity: string; code: string; message: string; context?: Record<string, unknown>; clientId?: string }
        ) => Record<string, unknown>;
        pushErrorToClients: (appId: string, clientId: string | undefined, err: Record<string, unknown>) => boolean;
        resolveAppForwardConfig: (appId: string) => { enabled: boolean; minSeverity: string };
        redactErrorMessage: (message: string) => string;
        makeStructuredError: (
            severity: string,
            code: string,
            message: string,
            context: Record<string, unknown>
        ) => Record<string, unknown>;
    };
};

const {
    runtimeNodeRegistry,
    runtimeState,
    addStreamClient,
    reportRuntimeError,
    pushErrorToClients,
    resolveAppForwardConfig,
    redactErrorMessage,
    makeStructuredError
} = webapp.__test__;

const APP_ID = "errApp";

function makeFakeRes(): FakeRes {
    const frames: string[] = [];
    return {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        events() {
            return frames
                .join("")
                .split("\n\n")
                .filter((block) => block.includes("event:"))
                .map((block) => {
                    const lines = block.split("\n");
                    const eventLine = lines.find((l) => l.startsWith("event: "))!;
                    const dataLine = lines.find((l) => l.startsWith("data: "))!;
                    return {
                        event: eventLine.slice("event: ".length),
                        data: JSON.parse(dataLine.slice("data: ".length))
                    };
                });
        }
    };
}

// Register the ui-app with the given forwarding config so resolveAppForwardConfig
// and the push gate read a real definition.
function registerApp(forward: { forwardErrorsToClient?: boolean; forwardErrorMinSeverity?: string }) {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID,
        root: APP_ID,
        name: "Err App",
        layout: "app",
        ...forward
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function fakeNode() {
    return {
        id: "node1",
        errors: [] as string[],
        warns: [] as string[],
        error(msg: string) {
            this.errors.push(msg);
        },
        warn(msg: string) {
            this.warns.push(msg);
        }
    };
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
    runtimeState.definitions.clear();
    runtimeState.RED = { log: { error: vi.fn(), warn: vi.fn() } };
});

afterEach(() => {
    runtimeState.RED = undefined;
});

describe("P56: structured runtime logging (ADR 0006)", () => {
    it("logs a runtime failure as node.error with the context inline", () => {
        registerApp({});
        const node = fakeNode();
        const structured = reportRuntimeError(node, {
            severity: "error",
            code: "server.store.operation-failed",
            message: "ui-store operation failed: boom",
            context: { appId: APP_ID, nodeId: "node1", op: "store:set" }
        });

        // node.error received a single, context-rich line.
        expect(node.errors).toHaveLength(1);
        expect(node.errors[0]).toContain("ui-store operation failed: boom");
        expect(node.errors[0]).toContain("appId=" + APP_ID);
        expect(node.errors[0]).toContain("nodeId=node1");
        expect(node.errors[0]).toContain("op=store:set");
        expect(node.errors[0]).toContain("server.store.operation-failed");

        // The returned structured error matches the ADR 0006 shape.
        expect(structured.severity).toBe("error");
        expect(structured.code).toBe("server.store.operation-failed");
        expect(structured.origin).toBe("server");
        expect(structured.context).toEqual({ appId: APP_ID, nodeId: "node1", op: "store:set" });
        expect(typeof structured.timestamp).toBe("string");
    });

    it("routes warn severity to node.warn, not node.error", () => {
        registerApp({});
        const node = fakeNode();
        reportRuntimeError(node, {
            severity: "warn",
            code: "server.snapshot.build-failed",
            message: "Snapshot build failed",
            context: { appId: APP_ID, op: "buildAppSnapshot" }
        });
        expect(node.warns).toHaveLength(1);
        expect(node.errors).toHaveLength(0);
    });
});

describe("P56: backend→frontend error forwarding (ADR 0006 §4)", () => {
    it("does NOT forward when the app has forwarding OFF (secure default)", () => {
        registerApp({}); // absent → OFF
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const delivered = pushErrorToClients(
            APP_ID,
            undefined,
            makeStructuredError("error", "server.x.y", "boom", { appId: APP_ID })
        );

        expect(delivered).toBe(false);
        expect(res.events().some((e) => e.event === "error")).toBe(false);
        expect(resolveAppForwardConfig(APP_ID)).toEqual({ enabled: false, minSeverity: "error" });
    });

    it("forwards an at-threshold error as an SSE 'error' frame when enabled", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "error" });
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const delivered = pushErrorToClients(
            APP_ID,
            undefined,
            makeStructuredError("error", "server.x.y", "boom", { appId: APP_ID, nodeId: "n1", op: "o1" })
        );

        expect(delivered).toBe(true);
        const errorFrames = res.events().filter((e) => e.event === "error");
        expect(errorFrames).toHaveLength(1);
        const payload = errorFrames[0].data as { error: Record<string, unknown> };
        expect(payload.error.origin).toBe("server");
        expect(payload.error.severity).toBe("error");
        expect(payload.error.code).toBe("server.x.y");
        expect(payload.error.context).toEqual({ appId: APP_ID, nodeId: "n1", op: "o1" });
    });

    it("does NOT forward an error below the configured severity threshold", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "error" });
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const delivered = pushErrorToClients(
            APP_ID,
            undefined,
            makeStructuredError("warn", "server.x.y", "soft", { appId: APP_ID })
        );

        expect(delivered).toBe(false);
        expect(res.events().some((e) => e.event === "error")).toBe(false);
    });

    it("forwards a warn when the threshold is lowered to warn", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "warn" });
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const delivered = pushErrorToClients(
            APP_ID,
            undefined,
            makeStructuredError("warn", "server.x.y", "soft", { appId: APP_ID })
        );

        expect(delivered).toBe(true);
        expect(res.events().filter((e) => e.event === "error")).toHaveLength(1);
    });

    it("redacts file paths and stack traces from the forwarded message", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "error" });
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        pushErrorToClients(
            APP_ID,
            undefined,
            makeStructuredError(
                "error",
                "server.crash",
                "Failed in /Users/secret/repo/nodes/webapp.js:1234:5\n    at foo (/Users/secret/x.js:1:1)",
                { appId: APP_ID }
            )
        );

        const payload = res.events().filter((e) => e.event === "error")[0].data as { error: { message: string } };
        expect(payload.error.message).not.toContain("/Users/secret");
        expect(payload.error.message).not.toContain("at foo");
        expect(payload.error.message).toContain("<path>");
    });

    it("redactErrorMessage leaves a clean message untouched", () => {
        expect(redactErrorMessage("ui-store operation failed: unknown op")).toBe(
            "ui-store operation failed: unknown op"
        );
    });

    it("targets a single client via clientId (P15) and never another", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "error" });
        const resA = makeFakeRes();
        const resB = makeFakeRes();
        addStreamClient(APP_ID, "cA", resA, "/");
        addStreamClient(APP_ID, "cB", resB, "/");

        pushErrorToClients(APP_ID, "cA", makeStructuredError("error", "server.x", "boom", { appId: APP_ID }));

        expect(resA.events().filter((e) => e.event === "error")).toHaveLength(1);
        expect(resB.events().filter((e) => e.event === "error")).toHaveLength(0);
    });
});

describe("P56: store handler emits a structured error on a bad operation", () => {
    it("a ui-store input with an unknown op reports a structured error and does not throw", () => {
        registerApp({ forwardErrorsToClient: true, forwardErrorMinSeverity: "error" });
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const storeDef = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "store1",
            parent: APP_ID,
            statePath: "x"
        });
        const node = { ...fakeNode(), webappDefinition: storeDef };

        const doneErr = vi.fn();
        // An explicit unknown store operation triggers applyStoreOperation to throw.
        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node,
            { ui: { store: { id: "store1", op: "explode" } } },
            () => undefined,
            doneErr
        );

        // The failure was reported as a structured node.error (not a bare throw).
        expect(node.errors.some((e) => e.includes("ui-store operation failed") && e.includes("server.store.operation-failed"))).toBe(true);
        // done() received the error (Node-RED catch-node contract), no uncaught throw.
        expect(doneErr).toHaveBeenCalledWith(expect.any(Error));
        // And, forwarding being ON, the client received an SSE error frame.
        expect(res.events().filter((e) => e.event === "error")).toHaveLength(1);
    });
});
