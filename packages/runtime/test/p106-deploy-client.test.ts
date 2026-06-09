import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { JSDOM, VirtualConsole } from "jsdom";
import { describe, expect, it } from "vitest";

/**
 * P106 — client-side deploy decision (live-deploy-update.md).
 *
 * On a deploy push (or a re-focus /snapshot pull) the client applies one rule:
 *   production            → never auto-update; show a sticky version alert.
 *   development, sig same  → IN-PLACE applySnapshot (no reload; client state kept).
 *   development, sig diff  → full window.location.reload().
 *
 * These tests drive the real client through the shared jsdom harness, exercising
 * the exposed applyDeployUpdate test hook so no EventSource is needed. jsdom's
 * location.reload is non-configurable, so a reload is detected via the
 * `jsdomError` ("Not implemented: navigation …") it raises on the virtual console.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const renderAppPage = webappTest.renderAppPage as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { status: number; body: string };

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; snapshot?: unknown };

const computeShellSignature = webappTest.computeShellSignature as (
    appId: string,
    definitions: unknown[]
) => string;

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

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

const APP_ID = "p106App";

function flow(opts: { deployMode?: string } = {}) {
    return build([
        {
            type: "ui-app",
            id: APP_ID,
            name: "Demo",
            root: APP_ID,
            layout: "app",
            ...(opts.deployMode ? { deployMode: opts.deployMode } : {}),
            z: "f1"
        },
        {
            type: "ui-text",
            id: "label1",
            mount: APP_ID + ".content",
            value: { kind: "literal", value: "Hello" },
            z: "f1"
        }
    ]);
}

interface ClientHooks {
    applyDeployUpdate?: (snapshot: unknown, signature: string | undefined) => void;
}

// A virtual console that counts the jsdomError jsdom raises whenever the page
// calls location.reload() (jsdom does not implement navigation).
function makeReloadTracker() {
    const reloads: string[] = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (err: Error) => {
        if (/Not implemented:\s*navigation/i.test(err.message)) {
            reloads.push(err.message);
        }
    });
    return { virtualConsole, reloads };
}

function loadDom(definitions: unknown[], mode: string) {
    const page = renderAppPage(APP_ID, "/", undefined, definitions);
    const { virtualConsole, reloads } = makeReloadTracker();
    const dom = new JSDOM(page.body, {
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole
    });
    const { window } = dom;

    const snapshot = buildAppSnapshot(APP_ID, "/", undefined, definitions).snapshot;
    const signature = computeShellSignature(APP_ID, definitions);

    // hydrate() resolves against the same model so the hydrated signature is set.
    (window as unknown as { fetch: unknown }).fetch = () =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshot, signature, mode }) });

    (window as unknown as { __webappClientTestHooks: ClientHooks }).__webappClientTestHooks = {};
    window.eval(serializerSource);
    window.eval(clientSource);

    return { dom, window, reloads, snapshot, signature };
}

async function settle(window: { setTimeout: (cb: () => void, ms: number) => void }) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function hooksOf(window: unknown): ClientHooks {
    return (window as { __webappClientTestHooks: ClientHooks }).__webappClientTestHooks;
}

describe("P106: development mode — signature unchanged → in-place apply", () => {
    it("a content-only deploy (same signature) applies in place WITHOUT a reload", async () => {
        const defs = flow();
        const { window, reloads, signature } = loadDom(defs, "development");
        await settle(window);

        const newSnapshot = buildAppSnapshot(APP_ID, "/", undefined, defs).snapshot;
        hooksOf(window).applyDeployUpdate!(newSnapshot, signature);

        expect(reloads).toHaveLength(0);
        const innerRoot = window.document.getElementById("webapp-client-root")!;
        expect(innerRoot.textContent).toContain("Hello");
    });
});

describe("P106: development mode — signature changed → full reload", () => {
    it("a shell/topology change (different signature) triggers a reload", async () => {
        const defs = flow();
        const { window, reloads } = loadDom(defs, "development");
        await settle(window);

        // Simulate a deploy whose signature differs from the hydrated one.
        hooksOf(window).applyDeployUpdate!(null, "different-signature");

        expect(reloads.length).toBeGreaterThanOrEqual(1);
    });
});

describe("P106: production mode — never auto-update, show version alert", () => {
    it("the rendered page carries data-webapp-mode=production", () => {
        const page = renderAppPage(APP_ID, "/", undefined, flow({ deployMode: "production" }));
        expect(page.body).toContain('data-webapp-mode="production"');
    });

    it("a production-mode app shows a version alert and does NOT reload or apply", async () => {
        const defs = flow({ deployMode: "production" });
        const { window, reloads, signature, snapshot } = loadDom(defs, "production");
        await settle(window);

        // Even with the SAME signature, production must not auto-apply.
        hooksOf(window).applyDeployUpdate!(snapshot, signature);

        expect(reloads).toHaveLength(0);
        const alert = window.document.querySelector(".webapp-version-alert");
        expect(alert).not.toBeNull();
        expect(alert!.textContent).toContain("neue Version");

        // A second deploy does not stack a second alert.
        hooksOf(window).applyDeployUpdate!(snapshot, signature);
        expect(window.document.querySelectorAll(".webapp-version-alert").length).toBe(1);
    });
});
