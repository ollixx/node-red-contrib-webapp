import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P75 — ui-breadcrumb / ui-menu `navigate` output event.
 *
 * Before P75 neither node declared an `events` array, and their serializers
 * emitted only static <a href> links — so a user click never dispatched a
 * `navigate` event to the node's output port (the documented contract in
 * docs/nodes/navigation/ui-breadcrumb.md and ui-menu.md was unreachable).
 *
 * Contracts verified here:
 * 1. The breadcrumb serializer wires data-webapp-source + data-webapp-navigate-path
 *    on each navigable item (one with `path`), but NOT on the last item.
 * 2. The menu serializer wires the same hook on items with `route`/`path`, but
 *    NOT on external `href` items.
 * 3. The client click handler reads data-webapp-navigate-path and dispatches a
 *    `navigate` event with params.path.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const clientSource = readFileSync(
    fileURLToPath(new URL("../../../resources/lib/webapp-client.js", import.meta.url)),
    "utf8"
);

function makeComponent(kind: string, id: string, extra: Record<string, unknown> = {}) {
    return { kind, id, value: undefined, props: {}, events: [], ...extra };
}

// P95: breadcrumb redesign — all items carry data-webapp-breadcrumb-action; no
// path-based selectivity; all items clickable (including "active" ones).
describe("P95: breadcrumb click-event hooks (replaces P75 navigate-path model)", () => {
    it("object item {label, action} carries data-webapp-breadcrumb-action", () => {
        const component = makeComponent("breadcrumb", "bc-1", {
            props: {
                items: [
                    { label: "Home", action: "/" },
                    { label: "Customers", action: "/customers" },
                    { label: "Details" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("data-webapp-source=\"bc-1\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"/\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"/customers\"");
    });

    it("string items carry data-webapp-breadcrumb-action equal to the string", () => {
        const component = makeComponent("breadcrumb", "bc-str", {
            props: { items: ["Home", "Customers", "Details"] }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("data-webapp-breadcrumb-action=\"Home\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Customers\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Details\"");
    });

    it("active item still carries data-webapp-breadcrumb-action and aria-current=page", () => {
        const component = makeComponent("breadcrumb", "bc-active", {
            props: {
                items: [
                    { label: "Home", action: "/" },
                    { label: "Current", action: "/current", active: true }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        // active item is still clickable (P95 design)
        expect(html).toContain("data-webapp-breadcrumb-action=\"/current\"");
        expect(html).toContain("aria-current=\"page\"");
    });

    it("item without explicit action defaults to label as action", () => {
        const component = makeComponent("breadcrumb", "bc-noa", {
            props: { items: [{ label: "Home" }, { label: "Customers" }] }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("data-webapp-breadcrumb-action=\"Home\"");
        expect(html).toContain("data-webapp-breadcrumb-action=\"Customers\"");
    });
});

describe("P75: menu navigate-event hooks", () => {
    it("route item carries data-webapp-source + data-webapp-navigate-path", () => {
        const component = makeComponent("menu", "menu-1", {
            props: {
                items: [
                    { label: "Dashboard", route: "/dashboard" },
                    { label: "Customers", route: "/customers" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("data-webapp-source=\"menu-1\"");
        expect(html).toContain("data-webapp-navigate-path=\"/dashboard\"");
        expect(html).toContain("data-webapp-navigate-path=\"/customers\"");
    });

    it("external href items do NOT carry a navigate hook", () => {
        const component = makeComponent("menu", "menu-2", {
            props: {
                items: [
                    { label: "External", href: "https://example.com" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).not.toContain("data-webapp-navigate-path");
    });
});

describe("P95: client dispatches click from data-webapp-breadcrumb-action", () => {
    it("the click handler reads data-webapp-breadcrumb-action and dispatches a click event with params.action", () => {
        expect(clientSource).toContain("data-webapp-breadcrumb-action");
        expect(clientSource).toContain("event: \"click\"");
        expect(clientSource).toContain("action:");
    });
    // P75 back-compat: the menu still uses navigate-path; keep handler for it.
    it("back-compat: data-webapp-navigate-path handler still present for menu items", () => {
        expect(clientSource).toContain("data-webapp-navigate-path");
        expect(clientSource).toContain("event: \"navigate\"");
    });
});

// End-to-end dispatch: a `navigate` event reported by the browser must land on
// the originating breadcrumb/menu node's output port with params.path intact.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const dispatchClientEvent = webappTest.dispatchClientEvent as (
    RED: unknown,
    appId: string,
    body: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean; status?: number; message?: { ui: Record<string, unknown> } };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

interface EmittedMsg { ui: Record<string, unknown>; }

function makeRED(defs: Array<Record<string, unknown>>) {
    const emitted = new Map<string, EmittedMsg[]>();
    const nodes = new Map<string, { id: string; webappDefinition: Record<string, unknown>; send: (msg: EmittedMsg) => void }>();
    for (const def of defs) {
        const id = String(def.id);
        emitted.set(id, []);
        nodes.set(id, {
            id,
            webappDefinition: def,
            send(msg: EmittedMsg) { emitted.get(id)!.push(msg); }
        });
    }
    return { emitted, RED: { nodes: { getNode: (id: string) => nodes.get(id) || undefined } } };
}

describe("P95: click event routes onto the breadcrumb node output port", () => {
    it("breadcrumb click event emits msg.ui {event:'click', params:{action}} on its port", () => {
        const def = runtimeNodeRegistry["ui-breadcrumb"].mapConfig({
            type: "ui-breadcrumb",
            id: "bcDispatch",
            mount: "bcApp.content",
            items: [{ label: "Home", action: "/" }, { label: "Here" }]
        });
        // P95 contract: events array is ["click"] so dispatch routes onto port 0.
        expect(def.events).toEqual(["click"]);

        const { emitted, RED } = makeRED([def]);
        const result = dispatchClientEvent(
            RED,
            "bcApp",
            { clientId: "c1", event: "click", sourceId: "bcDispatch", params: { action: "/" } },
            [def]
        );

        expect(result.success).toBe(true);
        const out = emitted.get("bcDispatch")!;
        expect(out).toHaveLength(1);
        expect(out[0].ui.event).toBe("click");
        expect(out[0].ui.sourceId).toBe("bcDispatch");
        expect((out[0].ui.params as { action: string }).action).toBe("/");
    });

    it("menu declares events:['navigate'] in its mapped definition", () => {
        const def = runtimeNodeRegistry["ui-menu"].mapConfig({
            type: "ui-menu",
            id: "menuDispatch",
            mount: "menuApp.sidebar",
            items: JSON.stringify([{ label: "Dashboard", route: "/dashboard" }])
        });
        expect(def.events).toEqual(["navigate"]);
    });
});
