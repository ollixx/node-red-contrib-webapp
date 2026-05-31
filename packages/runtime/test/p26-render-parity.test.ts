import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { mapComponentToShoelace } from "@node-red-contrib-webapp/renderer";

/**
 * P26 — render parity.
 *
 * The thin client and the server must emit IDENTICAL Shoelace markup so that
 * hydrate() no longer downgrades the server's sl-* elements to native
 * <button>/<input>. They now share one serializer
 * (resources/lib/webapp-serializer.js); these tests pin that contract.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const renderAppPage = webappTest.renderAppPage as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { status: number; body: string };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    serializeSnapshot: (snapshot: unknown, ctx: unknown) => { grid: string; dialogs: string };
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    renderLayoutHtml: (layoutId: string, regions: unknown[], ctx: unknown) => string;
    mapComponentToShoelace: (kind: string, props?: Record<string, unknown>) => { tag: string };
};

const serializerSource = readFileSync(
    fileURLToPath(new URL("../../../resources/lib/webapp-serializer.js", import.meta.url)),
    "utf8"
);
const clientSource = readFileSync(
    fileURLToPath(new URL("../../../resources/lib/webapp-client.js", import.meta.url)),
    "utf8"
);

function build(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

// One of each interactive kind, mounted on a single route.
const definitions = build([
    { type: "ui-app", id: "app1", name: "Demo", root: "app1", layout: "app", z: "f1" },
    { type: "ui-button", id: "saveBtn", mount: "app1.content", label: "Save", action: "saveAct", z: "f1" },
    { type: "ui-input", id: "nameInput", mount: "app1.content", label: "Name", valuePath: "name", path: "name", z: "f1" },
    { type: "ui-select", id: "roleSelect", mount: "app1.content", label: "Role", path: "role", options: [{ value: "a", label: "A" }], z: "f1" },
    { type: "ui-checkbox", id: "agreeChk", mount: "app1.content", label: "Agree", path: "agree", z: "f1" },
    { type: "ui-switch", id: "onSwitch", mount: "app1.content", label: "On", path: "on", z: "f1" },
    { type: "ui-textarea", id: "noteArea", mount: "app1.content", label: "Note", path: "note", z: "f1" },
    { type: "ui-text", id: "label1", mount: "app1.content", value: { kind: "literal", value: "Hello" }, z: "f1" }
]);

function getSnapshot(): unknown {
    const built = (webappTest.buildAppSnapshot as (
        appId: string,
        location: string,
        dialogId: string | undefined,
        definitions: unknown[]
    ) => { success: boolean; snapshot?: unknown })("app1", "/", undefined, definitions);

    expect(built.success).toBe(true);
    return built.snapshot;
}

describe("P26: shared serializer is the single source of truth", () => {
    it("byte-identical markup whether invoked on the server path or the client path", () => {
        const snapshot = getSnapshot() as { layout: { id: string }; regions: unknown[]; params: unknown };

        // Server code path: nodes/webapp.js delegates to the shared module.
        const serverGrid = (webappTest.renderLayoutHtml as (
            layoutId: string,
            regions: unknown[],
            ctx: unknown
        ) => string)(snapshot.layout.id, snapshot.regions, { appId: "app1", location: "/", params: snapshot.params, formId: undefined });

        // Client code path: the same serializer module, invoked directly.
        const clientGrid = serializer.renderLayoutHtml(snapshot.layout.id, snapshot.regions, {
            appId: "app1",
            location: "/",
            params: snapshot.params,
            formId: undefined
        });

        expect(clientGrid).toBe(serverGrid);
        // And it is genuinely the Shoelace markup, not native HTML.
        expect(serverGrid).toContain("<sl-button");
        expect(serverGrid).toContain("<sl-input");
        expect(serverGrid).toContain("<sl-select");
        expect(serverGrid).toContain("<sl-checkbox");
        expect(serverGrid).toContain("<sl-switch");
        expect(serverGrid).toContain("<sl-textarea");
        expect(serverGrid).not.toContain("<button");
        expect(serverGrid).not.toContain('class="webapp-button"');
    });

    it("the inlined adapter map stays in sync with the canonical renderer adapter", () => {
        const kinds = [
            "button", "input", "select", "checkbox", "radio", "switch", "textarea",
            "datepicker", "slider", "alert", "badge", "progress", "breadcrumb",
            "tabs", "accordion", "menu", "avatar", "container", "card", "toast", "pagination"
        ];

        for (const kind of kinds) {
            expect(serializer.mapComponentToShoelace(kind).tag).toBe(mapComponentToShoelace(kind).tag);
        }
    });
});

interface ClientHooks { applySnapshot?: (snapshot: unknown) => void }

function loadHydratedDom(snapshot: unknown): JSDOM {
    const page = renderAppPage("app1", "/", undefined, definitions);
    const dom = new JSDOM(page.body, { runScripts: "outside-only", pretendToBeVisual: true });
    const { window } = dom;

    // Stub fetch so hydrate() resolves against the fixture snapshot.
    (window as unknown as { fetch: unknown }).fetch = (_url: string) =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshot }) });
    (window as unknown as { __webappClientTestHooks: ClientHooks }).__webappClientTestHooks = {};

    // Inject the shared serializer (sets window.WebappSerializer) then the client.
    window.eval(serializerSource);
    window.eval(clientSource);

    return dom;
}

describe("P26: hydrate keeps the Shoelace look", () => {
    it("after hydrate() the live DOM contains sl-* elements, not native <button>/<input>", async () => {
        const snapshot = getSnapshot();
        const dom = loadHydratedDom(snapshot);

        // Let the async hydrate() microtasks settle.
        await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

        const root = dom.window.document.getElementById("webapp-client-root")!;
        expect(root.querySelector("sl-button")).not.toBeNull();
        expect(root.querySelector("sl-input")).not.toBeNull();
        // The downgrade bug: a native <button>/<input> must NOT appear.
        expect(root.querySelector("button")).toBeNull();
        expect(root.querySelector("input")).toBeNull();
    });

    it("a server-rendered button keeps tag sl-button across a client re-render (no element-kind swap)", async () => {
        const snapshot = getSnapshot();
        const dom = loadHydratedDom(snapshot);
        await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

        const root = dom.window.document.getElementById("webapp-client-root")!;
        const firstButton = root.querySelector("sl-button");
        expect(firstButton).not.toBeNull();

        // Re-apply the same snapshot (a re-render / keyed morph). The button tag
        // must stay sl-button — the old client swapped it to a native <button>.
        const hooks = (dom.window as unknown as { __webappClientTestHooks: ClientHooks }).__webappClientTestHooks;
        expect(typeof hooks.applySnapshot).toBe("function");
        hooks.applySnapshot!(snapshot);

        expect(root.querySelector("sl-button")).not.toBeNull();
        expect(root.querySelector("button")).toBeNull();
        // Identical markup → keyed morph leaves the node untouched (same instance).
        expect(root.querySelector("sl-button")).toBe(firstButton);
    });
});
