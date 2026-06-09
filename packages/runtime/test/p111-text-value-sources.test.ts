import { describe, expect, it } from "vitest";

/**
 * P111 — ui-text value sources are sharpened into three concepts:
 *   • reactive bindings (literal/state/store/query/routeParam)
 *   • server-resolved one-shot values (flow/global/env) → resolved to a literal
 *     at render time by resolveContextBindingsForDef (the renderer is backend-
 *     neutral and cannot read Node-RED context)
 *   • Message mode (kind "msg") → driven by the input handler, never a render
 *     binding
 *
 * This pins the server-side resolution + the editor→definition mapping for the
 * new value kinds. The renderer-side "msg renders empty" behaviour is pinned in
 * packages/renderer/test/renderer.test.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;
const resolveContextBindingsForDef = webappTest.resolveContextBindingsForDef as (
    def: Record<string, unknown>,
    RED: unknown
) => Record<string, unknown>;
const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

// Minimal RED mock: a single node whose flow/global context + env are scripted.
function makeRED(opts: {
    flow?: Record<string, unknown>;
    global?: Record<string, unknown>;
    env?: Record<string, unknown>;
    nodeId?: string;
}) {
    const nodeId = opts.nodeId ?? "txt1";
    const node = {
        id: nodeId,
        context() {
            return {
                flow: { get: (path: string) => (opts.flow ? opts.flow[path] : undefined) },
                global: { get: (path: string) => (opts.global ? opts.global[path] : undefined) }
            };
        }
    };
    return {
        nodes: { getNode: (id: string) => (id === nodeId ? node : undefined) },
        util: {
            evaluateNodeProperty: (path: string, type: string) =>
                type === "env" && opts.env ? opts.env[path] : undefined
        }
    };
}

describe("P111: server-side resolution of flow/global/env value bindings", () => {
    it("resolves a flow binding into a literal from flow context", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "flow", path: "greeting" } };
        const out = resolveContextBindingsForDef(def, makeRED({ flow: { greeting: "Hi flow" } }));
        expect(out.value).toEqual({ kind: "literal", value: "Hi flow" });
    });

    it("resolves a global binding into a literal from global context", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "global", path: "appName" } };
        const out = resolveContextBindingsForDef(def, makeRED({ global: { appName: "Acme" } }));
        expect(out.value).toEqual({ kind: "literal", value: "Acme" });
    });

    it("resolves an env binding into a literal via evaluateNodeProperty", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "env", path: "VERSION" } };
        const out = resolveContextBindingsForDef(def, makeRED({ env: { VERSION: "1.2.3" } }));
        expect(out.value).toEqual({ kind: "literal", value: "1.2.3" });
    });

    it("an unresolved context value falls back (→ literal undefined → renders '?')", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "flow", path: "missing" } };
        const out = resolveContextBindingsForDef(def, makeRED({ flow: {} }));
        expect(out.value).toEqual({ kind: "literal", value: undefined });
    });

    it("leaves a msg (Message-mode) binding untouched", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "msg", path: "payload" } };
        const out = resolveContextBindingsForDef(def, makeRED({}));
        expect(out.value).toEqual({ kind: "msg", path: "payload" });
    });

    it("leaves literal/state/store bindings untouched", () => {
        for (const value of [
            { kind: "literal", value: "x" },
            { kind: "state", path: "a.b" },
            { kind: "store", path: "store1" }
        ]) {
            const def = { type: "ui-text", id: "txt1", value };
            const out = resolveContextBindingsForDef(def, makeRED({}));
            expect(out.value).toEqual(value);
        }
    });

    it("returns the input unchanged when no binding field needs resolution", () => {
        const def = { type: "ui-text", id: "txt1", value: { kind: "literal", value: "x" } };
        const out = resolveContextBindingsForDef(def, makeRED({}));
        expect(out).toBe(def);
    });
});

describe("P111: ui-text mapConfig carries the sharpened value bindings", () => {
    const mapConfig = runtimeNodeRegistry["ui-text"].mapConfig;

    it("passes a store binding through unchanged", () => {
        const def = mapConfig({ id: "t", mount: "route:/x/content", value: { kind: "store", path: "store1" } });
        expect(def.value).toEqual({ kind: "store", path: "store1" });
    });

    it("passes a Message-mode (msg) binding through unchanged", () => {
        const def = mapConfig({ id: "t", mount: "route:/x/content", value: { kind: "msg", path: "payload" } });
        expect(def.value).toEqual({ kind: "msg", path: "payload" });
    });

    it("passes flow/global/env bindings through (resolution happens later)", () => {
        for (const value of [
            { kind: "flow", path: "g" },
            { kind: "global", path: "g" },
            { kind: "env", path: "G" }
        ]) {
            const def = mapConfig({ id: "t", mount: "route:/x/content", value });
            expect(def.value).toEqual(value);
        }
    });
});
