import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
        getDefinitionBuckets: (appId: string, definitions: unknown[]) => { components: Array<{ type: string; id: string }> };
        dispatchClientEvent: (appId: string, location: string, payload: Record<string, unknown>, definitions: unknown[]) => unknown;
    };
};

const { runtimeNodeRegistry, renderAppPage, getDefinitionBuckets } = webapp.__test__;

// Build raw flow nodes through each type's mapConfig (mirroring the deploy path),
// keeping z / id so getDefinitionBuckets buckets them into the app.
function build(rawNodes: Record<string, unknown>[]): Record<string, unknown>[] {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig
            ? { ...reg.mapConfig(node), z: node.z, id: node.id, uiId: node.id }
            : { ...node };
    });
}

/**
 * P179 (ADR 0020) — ui-component node registration + runtime bucketing + render.
 *
 * A `ui-component-definition` with two `ui-text` children (`text = prop.title` /
 * `prop.body`); two `ui-component-instance`s at different mounts with different
 * props render their own two lines with the instance-specific values. An inner
 * node's id carries the instance identity (`<instanceId>#<innerNodeId>`).
 */
describe("P179: ui-component definition/instance — registration + render", () => {
    function componentFlow() {
        return build([
            { type: "ui-app", id: "P179App", name: "Components", root: "P179App", layout: "app", z: "f1" },
            { type: "ui-route", id: "home", parent: "P179App", path: "/home", layoutId: "vertical", z: "f1" },
            { type: "ui-route", id: "about", parent: "P179App", path: "/about", layoutId: "vertical", z: "f1" },
            // Off-canvas definition: two text children bind to prop.title / prop.body.
            { type: "ui-component-definition", id: "Card", name: "Card", z: "f1" },
            {
                type: "ui-text", id: "tTitle", mount: "def:Card/content", order: 0,
                value: { kind: "prop", path: "title" }, z: "f1"
            },
            {
                type: "ui-text", id: "tBody", mount: "def:Card/content", order: 1,
                value: { kind: "prop", path: "body" }, z: "f1"
            },
            // Two instances at DIFFERENT mounts (different routes), different props.
            {
                type: "ui-component-instance", id: "inst1", mount: "route:/home/content",
                definitionId: "Card", order: 0,
                props: { title: { kind: "literal", value: "Alpha" }, body: { kind: "literal", value: "First" } },
                z: "f1"
            },
            {
                type: "ui-component-instance", id: "inst2", mount: "route:/about/content",
                definitionId: "Card", order: 1,
                props: { title: { kind: "literal", value: "Beta" }, body: { kind: "literal", value: "Second" } },
                z: "f1"
            }
        ]);
    }

    it("registers both node types in the runtime registry", () => {
        expect(runtimeNodeRegistry["ui-component-definition"]).toBeDefined();
        expect(runtimeNodeRegistry["ui-component-instance"]).toBeDefined();
    });

    it("buckets the definition, its children, and the instances into the app", () => {
        const buckets = getDefinitionBuckets("P179App", componentFlow());
        const types = buckets.components.map((c) => c.type).sort();
        expect(types).toContain("ui-component-definition");
        expect(types.filter((t) => t === "ui-component-instance")).toHaveLength(2);
        expect(types.filter((t) => t === "ui-text")).toHaveLength(2);
    });

    it("renders each instance's two lines with its instance-specific prop values", () => {
        const home = renderAppPage("P179App", "/home", undefined, componentFlow());
        expect(home.status).toBe(200);
        expect(home.body).toContain("Alpha");
        expect(home.body).toContain("First");
        // The other instance's values do not bleed into this route.
        expect(home.body).not.toContain("Beta");

        const about = renderAppPage("P179App", "/about", undefined, componentFlow());
        expect(about.status).toBe(200);
        expect(about.body).toContain("Beta");
        expect(about.body).toContain("Second");
        expect(about.body).not.toContain("Alpha");
    });

    it("re-ids inner nodes as <instanceId>#<innerNodeId> (instance identity)", () => {
        const home = renderAppPage("P179App", "/home", undefined, componentFlow());
        expect(home.body).toContain("inst1#tTitle");
        expect(home.body).toContain("inst1#tBody");

        const about = renderAppPage("P179App", "/about", undefined, componentFlow());
        expect(about.body).toContain("inst2#tTitle");
        expect(about.body).toContain("inst2#tBody");
    });

    it("the off-canvas definition never renders on its own (no def: leakage)", () => {
        const result = renderAppPage("P179App", "/home", undefined, componentFlow());
        expect(result.body).not.toContain("def:Card");
    });

    it("a missing/unknown definitionId renders nothing for that instance", () => {
        const flow = build([
            { type: "ui-app", id: "P179App2", name: "C2", root: "P179App2", layout: "app", z: "f2" },
            { type: "ui-route", id: "home2", parent: "P179App2", path: "/home", layoutId: "vertical", z: "f2" },
            {
                type: "ui-component-instance", id: "ghost", mount: "route:/home/content",
                definitionId: "DoesNotExist", order: 0, props: {}, z: "f2"
            }
        ]);
        const result = renderAppPage("P179App2", "/home", undefined, flow);
        expect(result.status).toBe(200);
        // No crash; nothing rendered for the dangling instance.
        expect(result.body).not.toContain("ghost#");
    });

    it("a prop bound to a store resolves the store value into the instance", () => {
        const flow = build([
            { type: "ui-app", id: "P179App3", name: "C3", root: "P179App3", layout: "app", z: "f3" },
            { type: "ui-route", id: "home3", parent: "P179App3", path: "/home", layoutId: "vertical", z: "f3" },
            { type: "ui-store", id: "store3", statePath: "view", initialValue: JSON.stringify({ greeting: "Hello-from-store" }), z: "f3" },
            { type: "ui-component-definition", id: "Greeter", name: "Greeter", z: "f3" },
            {
                type: "ui-text", id: "gText", mount: "def:Greeter/content", order: 0,
                value: { kind: "prop", path: "msg" }, z: "f3"
            },
            {
                type: "ui-component-instance", id: "g1", mount: "route:/home/content",
                definitionId: "Greeter", order: 0,
                props: { msg: { kind: "state", path: "view.greeting" } },
                z: "f3"
            }
        ]);
        const result = renderAppPage("P179App3", "/home", undefined, flow);
        expect(result.status).toBe(200);
        // The store-bound prop resolves through the propScope into the inner text.
        expect(result.body).toContain("Hello-from-store");
        expect(result.body).toContain("g1#gText");
    });

    it("an inner interactive node's id carries the instance identity (event sourceId)", () => {
        // A button inside the definition is re-id'd <instanceId>#<innerNodeId>; an
        // emitted event therefore carries that id as its sourceId — the instance is
        // recoverable from the id prefix. The rendered button id IS the event source.
        const flow = build([
            { type: "ui-app", id: "P179App4", name: "C4", root: "P179App4", layout: "app", z: "f4" },
            { type: "ui-route", id: "home4", parent: "P179App4", path: "/home", layoutId: "vertical", z: "f4" },
            { type: "ui-component-definition", id: "Clicker", name: "Clicker", z: "f4" },
            {
                type: "ui-button", id: "btn", mount: "def:Clicker/content", order: 0,
                label: "Go", z: "f4"
            },
            {
                type: "ui-component-instance", id: "c1", mount: "route:/home/content",
                definitionId: "Clicker", order: 0, props: {}, z: "f4"
            }
        ]);
        const result = renderAppPage("P179App4", "/home", undefined, flow);
        expect(result.status).toBe(200);
        expect(result.body).toContain("c1#btn");
    });
});
