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
        getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
        runtimeState: {
            liveState: Map<string, Record<string, unknown>>;
            streamClients: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
        };
    };
};

const { runtimeNodeRegistry, applyInputWriteBack, getClientState, runtimeState } = webapp.__test__;

const APP = "app1";
const storeDef = { type: "ui-store", id: "draftStore", statePath: "draft", initialValue: {} };
const definitions = [{ type: "ui-app", id: APP, root: APP, layout: "app" }, storeDef];

// The seven controls P204 rolls the write-back out to, with their client param shape.
const ROLLOUT: Array<{ type: string; params: Record<string, unknown>; expected: unknown }> = [
    { type: "ui-select", params: { value: "b" }, expected: "b" },
    { type: "ui-checkbox", params: { checked: true }, expected: true },
    { type: "ui-switch", params: { checked: false }, expected: false },
    { type: "ui-textarea", params: { value: "hello" }, expected: "hello" },
    { type: "ui-slider", params: { value: "42" }, expected: "42" },
    { type: "ui-radio", params: { value: "opt2" }, expected: "opt2" },
    { type: "ui-datepicker", params: { value: "2026-07-09" }, expected: "2026-07-09" }
];

function node(type: string, writeTo: unknown, writeTrigger?: string) {
    return {
        webappDefinition: { type, id: "n1", writeTo, writeTrigger },
        context() {
            return { flow: { set() {}, get() {} }, global: { set() {}, get() {} } };
        }
    };
}

describe("P204 (ADR 0027): input write-back rolled out to the remaining seven controls", () => {
    beforeEach(() => {
        runtimeState.liveState.clear();
        runtimeState.clientStateMap.clear();
        runtimeState.streamClients.clear();
    });

    describe.each(ROLLOUT)("$type", ({ type, params, expected }) => {
        it("persists the interaction value/checked into the store slice (per-client)", () => {
            applyInputWriteBack(
                null,
                APP,
                node(type, { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } }, "change"),
                params,
                "c1",
                definitions
            );
            expect(getClientState(APP, "c1")?.state).toMatchObject({ draft: { k: expected } });
        });

        it("mapConfig carries writeTo + writeTrigger through", () => {
            const def = runtimeNodeRegistry[type].mapConfig({
                id: "n1",
                parent: "app1/route1/content",
                value: { kind: "state", path: "v" },
                label: "L",
                writeTo: { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } },
                writeTrigger: "change"
            }) as Record<string, unknown>;
            expect(def.writeTo).toEqual({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } });
            expect(def.writeTrigger).toBe("change");
        });

        it("mapConfig migrates a legacy storeId/path pair into a writeTo store binding", () => {
            const def = runtimeNodeRegistry[type].mapConfig({
                id: "n1",
                parent: "app1/route1/content",
                value: { kind: "state", path: "v" },
                label: "L",
                storeId: "draftStore",
                path: "k"
            }) as Record<string, unknown>;
            expect(def.writeTo).toEqual({ kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } });
        });
    });

    it("guard: applyInputWriteBack is a no-op for a non-input node type", () => {
        applyInputWriteBack(
            null,
            APP,
            node("ui-text", { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } }, "change"),
            { value: "x" },
            "c1",
            definitions
        );
        expect(getClientState(APP, "c1")).toBeNull();
    });
});
