import { createRequire } from "node:module";

import { beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        applyInputWriteBack: (
            RED: unknown,
            appId: string,
            node: unknown,
            params: Record<string, unknown>,
            clientId: string | undefined,
            definitions: unknown[]
        ) => void;
        legacyStoreWriteTo: (storeId?: string, path?: string) => unknown;
        getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
        setClientState: (appId: string, clientId: string, state: unknown, ts: number) => void;
        runtimeState: {
            liveState: Map<string, Record<string, unknown>>;
            streamClients: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
            RED: unknown;
        };
    };
};

const {
    runtimeNodeRegistry,
    applyInputWriteBack,
    legacyStoreWriteTo,
    getClientState,
    runtimeState
} = webapp.__test__;

const APP = "app1";
const storeDef = { type: "ui-store", id: "draftStore", statePath: "draft", initialValue: {} };
const definitions = [{ type: "ui-app", id: APP, root: APP, layout: "app" }, storeDef];

function inputNode(writeTo: unknown, writeTrigger?: string, ctx?: { flow?: Map<string, unknown>; global?: Map<string, unknown> }) {
    return {
        webappDefinition: { type: "ui-input", id: "in1", writeTo, writeTrigger },
        context() {
            return {
                flow: { set: (k: string, v: unknown) => ctx?.flow?.set(k, v), get: (k: string) => ctx?.flow?.get(k) },
                global: { set: (k: string, v: unknown) => ctx?.global?.set(k, v), get: (k: string) => ctx?.global?.get(k) }
            };
        }
    };
}

describe("P203 (ADR 0027): ui-input runtime write-back", () => {
    beforeEach(() => {
        runtimeState.liveState.clear();
        runtimeState.clientStateMap.clear();
        runtimeState.streamClients.clear();
    });

    describe("legacyStoreWriteTo migration", () => {
        it("maps storeId + path → writeTo store binding with literal subPath", () => {
            expect(legacyStoreWriteTo("draftStore", "name")).toEqual({
                kind: "store",
                path: "draftStore",
                subPath: { kind: "literal", value: "name" }
            });
        });

        it("maps storeId alone → whole-slice store binding (no subPath)", () => {
            expect(legacyStoreWriteTo("draftStore", "")).toEqual({ kind: "store", path: "draftStore" });
        });

        it("returns undefined when no storeId is set", () => {
            expect(legacyStoreWriteTo("", "name")).toBeUndefined();
            expect(legacyStoreWriteTo(undefined, undefined)).toBeUndefined();
        });
    });

    describe("mapConfig writeTo/writeTrigger + legacy migration", () => {
        it("carries a new writeTo binding + writeTrigger through", () => {
            const def = runtimeNodeRegistry["ui-input"].mapConfig({
                id: "in1",
                parent: "app1/route1/content",
                label: "Name",
                writeTo: { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } },
                writeTrigger: "change"
            }) as Record<string, unknown>;
            expect(def.writeTo).toEqual({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } });
            expect(def.writeTrigger).toBe("change");
        });

        it("migrates a legacy storeId/path config into a writeTo store binding", () => {
            const def = runtimeNodeRegistry["ui-input"].mapConfig({
                id: "in1",
                parent: "app1/route1/content",
                label: "Name",
                storeId: "draftStore",
                path: "name"
            }) as Record<string, unknown>;
            expect(def.writeTo).toEqual({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } });
        });
    });

    describe("store write-back (per-client op:set)", () => {
        it("writes the field value at statePath + subPath into per-client state", () => {
            applyInputWriteBack(
                null,
                APP,
                inputNode({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } }, "submit"),
                { value: "Ada" },
                "c1",
                definitions
            );
            expect(getClientState(APP, "c1")?.state).toMatchObject({ draft: { name: "Ada" } });
        });

        it("replaces the whole slice when there is no subPath", () => {
            applyInputWriteBack(
                null,
                APP,
                inputNode({ kind: "store", path: "draftStore" }, "submit"),
                { value: "whole" },
                "c1",
                definitions
            );
            expect(getClientState(APP, "c1")?.state).toMatchObject({ draft: "whole" });
        });

        it("writes to broadcast liveState when there is no clientId", () => {
            applyInputWriteBack(
                null,
                APP,
                inputNode({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } }, "submit"),
                { value: "Bcast" },
                undefined,
                definitions
            );
            expect(runtimeState.liveState.get(APP)).toMatchObject({ draft: { name: "Bcast" } });
        });

        it("is a no-op when the writeTo store is unknown", () => {
            applyInputWriteBack(
                null,
                APP,
                inputNode({ kind: "store", path: "ghostStore", subPath: { kind: "literal", value: "x" } }, "submit"),
                { value: "z" },
                "c1",
                definitions
            );
            expect(getClientState(APP, "c1")).toBeNull();
        });
    });

    describe("flow / global write-back (server-side context)", () => {
        it("writes into flow context", () => {
            const flow = new Map<string, unknown>();
            applyInputWriteBack(null, APP, inputNode({ kind: "flow", path: "draftName" }, "submit", { flow }), { value: "Fx" }, "c1", definitions);
            expect(flow.get("draftName")).toBe("Fx");
        });

        it("writes into global context", () => {
            const global = new Map<string, unknown>();
            applyInputWriteBack(null, APP, inputNode({ kind: "global", path: "draftName" }, "submit", { global }), { value: "Gx" }, "c1", definitions);
            expect(global.get("draftName")).toBe("Gx");
        });

        it("does not touch per-client store state for a flow write (no re-render path)", () => {
            const flow = new Map<string, unknown>();
            applyInputWriteBack(null, APP, inputNode({ kind: "flow", path: "k" }, "submit", { flow }), { value: "v" }, "c1", definitions);
            expect(getClientState(APP, "c1")).toBeNull();
        });
    });

    describe("guard rails", () => {
        it("does nothing when the node has no writeTo", () => {
            applyInputWriteBack(null, APP, inputNode(undefined, "submit"), { value: "x" }, "c1", definitions);
            expect(getClientState(APP, "c1")).toBeNull();
        });
    });
});
