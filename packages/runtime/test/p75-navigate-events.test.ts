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

describe("P75: breadcrumb navigate-event hooks", () => {
    it("navigable item (has path, not last) carries data-webapp-source + data-webapp-navigate-path", () => {
        const component = makeComponent("breadcrumb", "bc-1", {
            props: {
                items: [
                    { label: "Home", path: "/" },
                    { label: "Customers", path: "/customers" },
                    { label: "Details" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        expect(html).toContain("data-webapp-source=\"bc-1\"");
        expect(html).toContain("data-webapp-navigate-path=\"/\"");
        expect(html).toContain("data-webapp-navigate-path=\"/customers\"");
    });

    it("the last item is not navigable even if it has a path", () => {
        const component = makeComponent("breadcrumb", "bc-2", {
            props: {
                items: [
                    { label: "Home", path: "/" },
                    { label: "Current", path: "/current" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        // First item is navigable, last is not.
        expect(html).toContain("data-webapp-navigate-path=\"/\"");
        expect(html).not.toContain("data-webapp-navigate-path=\"/current\"");
    });

    it("an item without a path is not navigable", () => {
        const component = makeComponent("breadcrumb", "bc-3", {
            props: {
                items: [
                    { label: "Home" },
                    { label: "Customers", path: "/customers" }
                ]
            }
        });
        const html = serializer.renderComponentHtml(component, "app", { appId: "app" });
        // "Home" has no path → no navigate hook for its label region.
        const homeSegment = html.split("Customers")[0];
        expect(homeSegment).not.toContain("data-webapp-navigate-path");
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

describe("P75: client dispatches navigate from data-webapp-navigate-path", () => {
    it("the click handler reads data-webapp-navigate-path and dispatches a navigate event with params.path", () => {
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

describe("P75: navigate event routes onto the node output port", () => {
    it("breadcrumb navigate event emits msg.ui {event:'navigate', params:{path}} on its port", () => {
        const def = runtimeNodeRegistry["ui-breadcrumb"].mapConfig({
            type: "ui-breadcrumb",
            id: "bcDispatch",
            mount: "bcApp.content",
            items: [{ label: "Home", path: "/" }, { label: "Here" }]
        });
        // P75 contract: the events array is declared so dispatch can route the port.
        expect(def.events).toEqual(["navigate"]);

        const { emitted, RED } = makeRED([def]);
        const result = dispatchClientEvent(
            RED,
            "bcApp",
            { clientId: "c1", event: "navigate", sourceId: "bcDispatch", params: { path: "/" } },
            [def]
        );

        expect(result.success).toBe(true);
        const out = emitted.get("bcDispatch")!;
        expect(out).toHaveLength(1);
        expect(out[0].ui.event).toBe("navigate");
        expect(out[0].ui.sourceId).toBe("bcDispatch");
        expect((out[0].ui.params as { path: string }).path).toBe("/");
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
