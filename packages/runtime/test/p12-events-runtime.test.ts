import { createRequire } from "node:module";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateUiNodeDefinition } from "../../schema/src/node-definitions";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        componentStateInputHandler: (node: unknown, msg: unknown, send: (msg: unknown) => void, done?: () => void) => void;
        dialogInputHandler: (node: unknown, msg: unknown, send: (msg: unknown) => void, done?: () => void) => void;
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { componentStateInputHandler, dialogInputHandler, runtimeNodeRegistry } = webapp.__test__;

describe("P12: configurable events — schema compilation", () => {
    it("ui-app with events=[clientConnected] produces a valid definition with that event", () => {
        const config = {
            id: "app1",
            root: "myapp",
            name: "My App",
            layout: "vertical",
            events: ["clientConnected"]
        };
        const def = runtimeNodeRegistry["ui-app"].mapConfig(config);
        const result = validateUiNodeDefinition(def);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe("ui-app");
            expect((result.data as { events?: string[] }).events).toEqual(["clientConnected"]);
        }
    });

    it("ui-app with events=[clientConnected] produces outputs:1 (one event = one port)", () => {
        const config = {
            id: "app1",
            root: "myapp",
            name: "My App",
            layout: "vertical",
            events: ["clientConnected"]
        };
        const def = runtimeNodeRegistry["ui-app"].mapConfig(config) as { events?: string[] };
        expect(def.events).toHaveLength(1);
    });

    it("ui-app with events=[clientConnected, clientDisconnected] produces outputs:2", () => {
        const config = {
            root: "myapp",
            layout: "vertical",
            events: ["clientConnected", "clientDisconnected"]
        };
        const def = runtimeNodeRegistry["ui-app"].mapConfig(config) as { events?: string[] };
        expect(def.events).toHaveLength(2);
    });

    it("ui-route with events=[onEnter, onLeave] produces a valid definition with both events", () => {
        const config = {
            id: "route1",
            path: "/customers",
            layoutId: "vertical",
            events: ["onEnter", "onLeave"]
        };
        const def = runtimeNodeRegistry["ui-route"].mapConfig(config);
        const result = validateUiNodeDefinition(def);

        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as { events?: string[] }).events).toEqual(["onEnter", "onLeave"]);
        }
    });

    it("ui-route with events=[onEnter, onLeave] produces outputs:2", () => {
        const config = {
            id: "route1",
            path: "/customers",
            layoutId: "vertical",
            events: ["onEnter", "onLeave"]
        };
        const def = runtimeNodeRegistry["ui-route"].mapConfig(config) as { events?: string[] };
        expect(def.events).toHaveLength(2);
    });

    it("ui-dialog with events=[onOpen, onClose] produces a valid definition", () => {
        const config = {
            id: "dialog1",
            layoutId: "vertical",
            events: ["onOpen", "onClose"]
        };
        const def = runtimeNodeRegistry["ui-dialog"].mapConfig(config);
        const result = validateUiNodeDefinition(def);

        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as { events?: string[] }).events).toEqual(["onOpen", "onClose"]);
        }
    });

    it("ui-container with events=[onShow, onHide] produces a valid definition", () => {
        const config = {
            id: "container1",
            mount: "route:/customers/content",
            layoutId: "vertical",
            events: ["onShow", "onHide"]
        };
        const def = runtimeNodeRegistry["ui-container"].mapConfig(config);
        const result = validateUiNodeDefinition(def);

        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as { events?: string[] }).events).toEqual(["onShow", "onHide"]);
        }
    });

    it("node without events field compiles without events in definition", () => {
        const config = { root: "myapp", layout: "vertical" };
        const def = runtimeNodeRegistry["ui-app"].mapConfig(config) as { events?: string[] };
        expect(def.events).toBeUndefined();
    });
});

describe("P12: component state message handler", () => {
    it("passes through a valid component hide message", () => {
        const send = vi.fn();
        const msg = { ui: { component: { id: "btn1", op: "hide" } } };

        componentStateInputHandler({}, msg, send, undefined);

        expect(send).toHaveBeenCalledWith(msg);
    });

    it("passes through a valid component show message", () => {
        const send = vi.fn();
        const msg = { ui: { component: { id: "input1", op: "show" } } };

        componentStateInputHandler({}, msg, send, undefined);

        expect(send).toHaveBeenCalledWith(msg);
    });

    it("passes through enable and disable ops", () => {
        const sendEnable = vi.fn();
        const sendDisable = vi.fn();

        componentStateInputHandler({}, { ui: { component: { id: "btn1", op: "enable" } } }, sendEnable, undefined);
        componentStateInputHandler({}, { ui: { component: { id: "btn1", op: "disable" } } }, sendDisable, undefined);

        expect(sendEnable).toHaveBeenCalled();
        expect(sendDisable).toHaveBeenCalled();
    });

    it("passes through focus and reset ops for ui-input", () => {
        const sendFocus = vi.fn();
        const sendReset = vi.fn();

        componentStateInputHandler({}, { ui: { component: { id: "input1", op: "focus" } } }, sendFocus, undefined);
        componentStateInputHandler({}, { ui: { component: { id: "input1", op: "reset" } } }, sendReset, undefined);

        expect(sendFocus).toHaveBeenCalled();
        expect(sendReset).toHaveBeenCalled();
    });

    it("discards a component message with unknown op", () => {
        const send = vi.fn();
        const msg = { ui: { component: { id: "btn1", op: "unknown-op" } } };

        componentStateInputHandler({}, msg, send, undefined);

        expect(send).not.toHaveBeenCalled();
    });

    it("discards a component message with missing id", () => {
        const send = vi.fn();
        const msg = { ui: { component: { op: "hide" } } };

        componentStateInputHandler({}, msg, send, undefined);

        expect(send).not.toHaveBeenCalled();
    });

    it("passes through non-component messages unchanged", () => {
        const send = vi.fn();
        const msg = { payload: "hello" };

        componentStateInputHandler({}, msg, send, undefined);

        expect(send).toHaveBeenCalledWith(msg);
    });

    it("calls done after processing", () => {
        const send = vi.fn();
        const done = vi.fn();
        const msg = { ui: { component: { id: "btn1", op: "hide" } } };

        componentStateInputHandler({}, msg, send, done);

        expect(done).toHaveBeenCalled();
    });
});

describe("P12 + P218 (ADR 0033): dialog message handler strips the consumed envelope", () => {
    it("forwards op=open with msg.ui.dialog STRIPPED (consumed = removed)", () => {
        const send = vi.fn();
        const msg = { ui: { dialog: { id: "dialog1", op: "open" } } };

        dialogInputHandler({}, msg, send, undefined);

        expect(send).toHaveBeenCalledTimes(1);
        const out = (send.mock.calls[0] as unknown[])[0] as { ui: Record<string, unknown> };
        expect(out.ui.dialog).toBeUndefined();
        // Never mutate the caller's message.
        expect(msg.ui.dialog).toEqual({ id: "dialog1", op: "open" });
    });

    it("forwards op=close with msg.ui.dialog STRIPPED", () => {
        const send = vi.fn();
        const msg = { ui: { dialog: { id: "dialog1", op: "close" } } };

        dialogInputHandler({}, msg, send, undefined);

        const out = (send.mock.calls[0] as unknown[])[0] as { ui: Record<string, unknown> };
        expect(out.ui.dialog).toBeUndefined();
    });

    it("forwards op=toggle with msg.ui.dialog STRIPPED", () => {
        const send = vi.fn();
        const msg = { ui: { dialog: { id: "dialog1", op: "toggle" } } };

        dialogInputHandler({}, msg, send, undefined);

        const out = (send.mock.calls[0] as unknown[])[0] as { ui: Record<string, unknown> };
        expect(out.ui.dialog).toBeUndefined();
    });

    it("PRESERVES context (clientId + outgoing event) while removing only dialog", () => {
        const send = vi.fn();
        const msg = { ui: { clientId: "c1", event: "onOpen", dialog: { id: "dialog1", op: "open" } } };

        dialogInputHandler({}, msg, send, undefined);

        const out = (send.mock.calls[0] as unknown[])[0] as { ui: Record<string, unknown> };
        expect(out.ui.dialog).toBeUndefined();
        expect(out.ui.clientId).toBe("c1");
        expect(out.ui.event).toBe("onOpen");
    });

    it("apply-once: a second dialog consumer sees NO dialog envelope", () => {
        const send1 = vi.fn();
        const msg = { ui: { dialog: { id: "dialog1", op: "open" } } };
        dialogInputHandler({}, msg, send1, undefined);
        const forwarded = (send1.mock.calls[0] as unknown[])[0];

        const send2 = vi.fn();
        dialogInputHandler({}, forwarded, send2, undefined);
        // The second consumer has no dialog.op → it treats it as a foreign
        // pass-through (still sends once), applying nothing.
        expect(send2).toHaveBeenCalledTimes(1);
        const out2 = (send2.mock.calls[0] as unknown[])[0] as { ui: Record<string, unknown> };
        expect(out2.ui.dialog).toBeUndefined();
    });

    it("discards dialog messages with unknown op", () => {
        const send = vi.fn();
        const msg = { ui: { dialog: { id: "dialog1", op: "unknown" } } };

        dialogInputHandler({}, msg, send, undefined);

        expect(send).not.toHaveBeenCalled();
    });

    it("passes through non-dialog messages unchanged", () => {
        const send = vi.fn();
        const msg = { payload: "data" };

        dialogInputHandler({}, msg, send, undefined);

        expect(send).toHaveBeenCalledWith(msg);
    });
});
