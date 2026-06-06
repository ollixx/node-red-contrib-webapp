import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P59 (ADR 0007 §2/§3) — per-node interaction handlers.
 *
 * The central SSE push moved OUT of ui-action and INTO the target node, via the
 * shared `interactionInputHandler(ownedVerbs)` factory. ui-action is now a pure
 * typed emitter. These tests drive the real webapp.js handlers with a fake SSE
 * `res` recording every frame the runtime writes.
 */

const require = createRequire(import.meta.url);

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            { options: { inputHandler: (node: unknown, msg: unknown, send: unknown, done: unknown) => void } }
        >;
        interactionInputHandler: (
            ownedVerbs: string[],
            next?: (node: unknown, msg: unknown, send: unknown, done: unknown) => void
        ) => (node: unknown, msg: unknown, send: unknown, done: unknown) => void;
        INTERACTION_VERBS_BY_TYPE: Record<string, string[]>;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
            streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            RED: unknown;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
    };
};

const {
    runtimeNodeRegistry,
    interactionInputHandler,
    INTERACTION_VERBS_BY_TYPE,
    runtimeState,
    addStreamClient
} = webapp.__test__;

const APP_ID = "p59App";

function makeFakeRes() {
    const frames: string[] = [];
    return {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        events(): Array<{ event: string; data: unknown }> {
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

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
    runtimeState.definitions.clear();
    runtimeState.definitions.set(APP_ID, {
        nodeId: APP_ID,
        appId: APP_ID,
        definition: { type: "ui-app", id: APP_ID }
    });
    runtimeState.RED = { nodes: { getNode: () => undefined } };
});

afterEach(() => {
    runtimeState.RED = undefined;
});

describe("P59: ui-dialog interaction handler (owns open/close)", () => {
    it("ui-dialog receiving msg.ui.action.type=open pushes { type:open, target:<dialog-id> } and passes msg through unchanged", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const dialogHandler = runtimeNodeRegistry["ui-dialog"].options.inputHandler;
        const dialogNode = { id: "editDialog", z: undefined, webappDefinition: { type: "ui-dialog", id: "editDialog" } };
        const incoming = { payload: { keep: 7 }, ui: { clientId: "c1", action: { type: "open" } } };
        const send = vi.fn();
        const done = vi.fn();

        dialogHandler(dialogNode, incoming, send, done);

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "open", target: "editDialog" } });

        // msg is passed through untouched on the output port.
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(incoming);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("an explicit msg.ui.action.target overrides the node's own id", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const dialogHandler = runtimeNodeRegistry["ui-dialog"].options.inputHandler;
        const dialogNode = { id: "editDialog", z: undefined, webappDefinition: { type: "ui-dialog", id: "editDialog" } };

        dialogHandler(
            dialogNode,
            { ui: { clientId: "c1", action: { type: "open", target: "otherDialog" } } },
            vi.fn(),
            vi.fn()
        );

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands[0].data).toMatchObject({ command: { type: "open", target: "otherDialog" } });
    });
});

describe("P59: a node receiving a verb it does NOT own is a pure pass-through", () => {
    it("ui-dialog (owns open/close) ignores a `show` verb — no push, msg passed through", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const dialogHandler = runtimeNodeRegistry["ui-dialog"].options.inputHandler;
        const dialogNode = { id: "editDialog", z: undefined, webappDefinition: { type: "ui-dialog", id: "editDialog" } };
        const incoming = { ui: { clientId: "c1", action: { type: "show" } } };
        const send = vi.fn();
        const done = vi.fn();

        dialogHandler(dialogNode, incoming, send, done);

        // No interaction command pushed for an unowned verb.
        expect(res.events().filter((e) => e.event === "command")).toHaveLength(0);
        // Pure pass-through: the message still leaves the output port.
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(incoming);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe("P59: verb ownership table", () => {
    it("ui-app and ui-route own navigate + reset (app-global)", () => {
        expect(INTERACTION_VERBS_BY_TYPE["ui-app"]).toEqual(expect.arrayContaining(["navigate", "reset"]));
        expect(INTERACTION_VERBS_BY_TYPE["ui-route"]).toEqual(expect.arrayContaining(["navigate", "reset"]));
    });

    it("ui-input owns show/hide, enable/disable, focus/reset", () => {
        expect(INTERACTION_VERBS_BY_TYPE["ui-input"]).toEqual(
            expect.arrayContaining(["show", "hide", "enable", "disable", "focus", "reset"])
        );
    });

    it("single-active containers (tabs/stepper/menu) own select", () => {
        expect(INTERACTION_VERBS_BY_TYPE["ui-tabs"]).toContain("select");
        expect(INTERACTION_VERBS_BY_TYPE["ui-stepper"]).toContain("select");
        expect(INTERACTION_VERBS_BY_TYPE["ui-menu"]).toContain("select");
    });
});

describe("P59: interactionInputHandler factory delegation", () => {
    it("delegates to the `next` handler when the message carries no action verb", () => {
        const next = vi.fn();
        const handler = interactionInputHandler(["open"], next);
        const node = { id: "n", z: undefined };
        const msg = { payload: 1 };
        const send = vi.fn();
        const done = vi.fn();

        handler(node, msg, send, done);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toBe(node);
        expect(next.mock.calls[0][1]).toBe(msg);
    });
});
