import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P95 — ui-breadcrumb Definitionsmodell + Click-Events (Redesign)
 *
 * Verifies:
 * 1. Schema accepts: string array, {label,action?,active?} objects, binding.
 * 2. Serializer: ALL items carry data-webapp-breadcrumb-action (no selectivity).
 * 3. Serializer: active items carry aria-current="page" AND are still clickable.
 * 4. Serializer: string items use string as both label and action.
 * 5. Serializer: item without action defaults to label.
 * 6. Serializer: breadcrumb layout mode (child slots) renders items from regions.
 * 7. mapConfig: items from array, JSON string, itemsJson, binding; events=["click"].
 * 8. Client: data-webapp-breadcrumb-action handler dispatches { event:"click", params:{action} }.
 * 9. Dispatch routing: click event lands on breadcrumb node output port.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const clientSource = readFileSync(
    fileURLToPath(new URL("../../../resources/lib/webapp-client.js", import.meta.url)),
    "utf8"
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;
const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;
const dispatchClientEvent = webappTest.dispatchClientEvent as (
    RED: unknown,
    appId: string,
    body: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean; status?: number; message?: { ui: Record<string, unknown> } };

function makeComponent(kind: string, id: string, extra: Record<string, unknown> = {}) {
    return { kind, id, value: undefined, props: {}, events: [], ...extra };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Serializer — modes (a) and (b)
// ──────────────────────────────────────────────────────────────────────────────
describe("P95: serializer — object items {label, action?, active?}", () => {
    it("renders sl-breadcrumb with sl-breadcrumb-item per item", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc1", { props: { items: [{ label: "Home", action: "/" }, { label: "Details" }] } }),
            "app", { appId: "app" }
        );
        expect(html).toContain("<sl-breadcrumb");
        expect(html).toContain("<sl-breadcrumb-item");
    });

    it("all items carry data-webapp-source + data-webapp-breadcrumb-action", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc2", {
                props: { items: [{ label: "A", action: "a" }, { label: "B", action: "b" }, { label: "C", action: "c" }] }
            }),
            "app", { appId: "app" }
        );
        expect(html).toContain("data-webapp-source=\"bc2\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"a\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"b\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"c\"");
    });

    it("active item carries aria-current=page AND data-webapp-breadcrumb-action", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc3", {
                props: { items: [{ label: "Home", action: "/" }, { label: "Current", action: "/cur", active: true }] }
            }),
            "app", { appId: "app" }
        );
        expect(html).toContain("aria-current=\"page\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"/cur\"");
    });

    it("item without explicit action defaults to label as action", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc4", { props: { items: [{ label: "Home" }, { label: "Details" }] } }),
            "app", { appId: "app" }
        );
        expect(html).toContain("data-webapp-breadcrumb-action=\"Home\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Details\"");
    });
});

describe("P95: serializer — string items", () => {
    it("string items use the string as both label text and action", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc-str", { props: { items: ["Home", "Products", "Widget"] } }),
            "app", { appId: "app" }
        );
        expect(html).toContain(">Home<");
        expect(html).toContain(">Products<");
        expect(html).toContain(">Widget<");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Home\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Products\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Widget\"");
    });

    it("string items are all clickable (no selectivity by position)", () => {
        const html = serializer.renderComponentHtml(
            makeComponent("breadcrumb", "bc-str2", { props: { items: ["First", "Last"] } }),
            "app", { appId: "app" }
        );
        // Both items must carry the click hook — no last-item exclusion in P95.
        expect(html).toContain("data-webapp-breadcrumb-action=\"First\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Last\"");
    });
});

describe("P95: serializer — breadcrumb layout (child slots mode)", () => {
    it("renders items from default region as sl-breadcrumb-items with child node id as action", () => {
        const component = {
            kind: "breadcrumb",
            id: "bc-slots",
            layoutId: "breadcrumb",
            value: undefined,
            props: {},
            events: [],
            regions: [
                {
                    name: "default",
                    components: [
                        { kind: "text", id: "child1", value: "Step 1", props: {}, events: [] },
                        { kind: "text", id: "child2", value: "Step 2", props: {}, events: [] }
                    ]
                }
            ]
        };
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("<sl-breadcrumb");
        expect(html).toContain("data-webapp-breadcrumb-action=\"child1\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"child2\"");
    });

    it("separator slot content is wrapped in slot=separator", () => {
        const component = {
            kind: "breadcrumb",
            id: "bc-sep",
            layoutId: "breadcrumb",
            value: undefined,
            props: {},
            events: [],
            regions: [
                {
                    name: "default",
                    components: [
                        { kind: "text", id: "step1", value: "Step", props: {}, events: [] }
                    ]
                },
                {
                    name: "separator",
                    components: [
                        { kind: "icon", id: "sep-icon", props: { icon: { library: "default", name: "chevron-right" } }, value: undefined, events: [] }
                    ]
                }
            ]
        };
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("slot=\"separator\"");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. mapConfig — item resolution and events
// ──────────────────────────────────────────────────────────────────────────────
describe("P95: mapConfig — item resolution", () => {
    function map(cfg: Record<string, unknown>) {
        return runtimeNodeRegistry["ui-breadcrumb"].mapConfig({ type: "ui-breadcrumb", mount: "app.content", ...cfg });
    }

    it("passes an array of objects through unchanged", () => {
        const def = map({ items: [{ label: "Home", action: "/" }, { label: "Cur", active: true }] });
        expect(Array.isArray(def.items)).toBe(true);
        expect((def.items as Array<Record<string, unknown>>)[0].action).toBe("/");
    });

    it("passes an array of strings through unchanged", () => {
        const def = map({ items: ["A", "B", "C"] });
        expect(def.items).toEqual(["A", "B", "C"]);
    });

    it("resolves itemsJson (new editor format) to a parsed array", () => {
        const def = map({ itemsJson: JSON.stringify([{ label: "X", action: "x" }]) });
        expect(Array.isArray(def.items)).toBe(true);
        expect((def.items as Array<Record<string, unknown>>)[0].label).toBe("X");
    });

    it("resolves a binding object as-is", () => {
        const binding = { kind: "state", path: "nav.bc" };
        const def = map({ items: binding });
        expect((def.items as Record<string, unknown>).kind).toBe("state");
    });

    it("falls back to itemsPath as a stateBinding (legacy P75)", () => {
        const def = map({ itemsPath: "nav.trail" });
        expect((def.items as Record<string, unknown>).kind).toBe("state");
        expect((def.items as Record<string, unknown>).path).toBe("nav.trail");
    });

    it("events is always ['click']", () => {
        const def = map({ items: [{ label: "A" }] });
        expect(def.events).toEqual(["click"]);
    });

    it("layout='breadcrumb' is preserved for child-slot mode", () => {
        const def = map({ layout: "breadcrumb" });
        expect(def.layout).toBe("breadcrumb");
    });

    it("other layout values are not forwarded (breadcrumb-only)", () => {
        const def = map({ layout: "grid" });
        expect(def.layout).toBeUndefined();
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Client — handler presence
// ──────────────────────────────────────────────────────────────────────────────
describe("P95: client — data-webapp-breadcrumb-action handler", () => {
    it("handler checks for data-webapp-breadcrumb-action attribute", () => {
        expect(clientSource).toContain("data-webapp-breadcrumb-action");
    });

    it("handler dispatches event:'click' with params.action", () => {
        expect(clientSource).toContain("event: \"click\"");
        expect(clientSource).toContain("action:");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. End-to-end dispatch
// ──────────────────────────────────────────────────────────────────────────────
interface EmittedMsg { ui: Record<string, unknown>; }

function makeRED(defs: Array<Record<string, unknown>>) {
    const emitted = new Map<string, EmittedMsg[]>();
    const nodes = new Map<string, { id: string; webappDefinition: Record<string, unknown>; send: (msg: EmittedMsg) => void }>();
    for (const def of defs) {
        const id = String(def.id);
        emitted.set(id, []);
        nodes.set(id, { id, webappDefinition: def, send(msg) { emitted.get(id)!.push(msg); } });
    }
    return { emitted, RED: { nodes: { getNode: (id: string) => nodes.get(id) || undefined } } };
}

describe("P95: dispatch — click event lands on breadcrumb output port", () => {
    it("emits msg.ui { event:'click', params:{ action } } on port 0", () => {
        const def = runtimeNodeRegistry["ui-breadcrumb"].mapConfig({
            type: "ui-breadcrumb",
            id: "bcDisp",
            mount: "testApp.content",
            items: [{ label: "Home", action: "/" }]
        }) as Record<string, unknown>;

        expect(def.events).toEqual(["click"]);

        const { emitted, RED } = makeRED([def]);
        const result = dispatchClientEvent(
            RED,
            "testApp",
            { clientId: "c1", event: "click", sourceId: "bcDisp", params: { action: "/" } },
            [def]
        );

        expect(result.success).toBe(true);
        const out = emitted.get("bcDisp")!;
        expect(out).toHaveLength(1);
        expect(out[0].ui.event).toBe("click");
        expect(out[0].ui.sourceId).toBe("bcDisp");
        expect((out[0].ui.params as { action: string }).action).toBe("/");
    });
});
