import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bug: a broken `reactive` expression was reported on EVERY snapshot build.
 * webapp.js creates a fresh renderer app per build (page render, /snapshot pull,
 * SSE push, …); the renderer's per-instance dedup set therefore resets each
 * build, so a single broken expression produced N debug-sidebar errors per page
 * (the "4×" the owner saw). The dedup must live at the webapp/app scope and span
 * builds — reporting a distinct failure once until the next deploy.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[],
    clientId?: string
) => { success: boolean };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const runtimeState = webappTest.runtimeState as {
    RED: unknown;
    reactiveErrorKeys?: Map<string, Set<string>>;
};

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

// A ui-text whose reactive value fails to COMPILE (trailing operator) — the same
// class as the owner's `Kunde ${routeParam.id}` without backticks.
const definitions = buildDefinitions([
    { type: "ui-app", id: "dedupApp", name: "Dedup App", root: "dedupApp", layout: "app", z: "f1" },
    {
        type: "ui-text",
        id: "brokenText",
        name: "Broken",
        mount: "dedupApp.content",
        value: { kind: "reactive", value: "1 +" },
        order: 1,
        z: "f1"
    }
]);

describe("reactive expression errors are deduped per app across snapshot builds", () => {
    let errorSpy: ReturnType<typeof vi.fn>;
    let prevRED: unknown;

    beforeEach(() => {
        prevRED = runtimeState.RED;
        errorSpy = vi.fn();
        runtimeState.RED = { log: { error: errorSpy, warn: vi.fn() } };
        runtimeState.reactiveErrorKeys?.clear();
    });

    afterEach(() => {
        runtimeState.RED = prevRED;
        runtimeState.reactiveErrorKeys?.clear();
    });

    it("reports a broken expression once, not on every build", () => {
        buildAppSnapshot("dedupApp", "/", undefined, definitions);
        buildAppSnapshot("dedupApp", "/", undefined, definitions);
        buildAppSnapshot("dedupApp", "/", undefined, definitions);

        const reactiveErrors = errorSpy.mock.calls.filter((args) =>
            String(args[0]).includes("reactive_expression_failed")
        );
        expect(reactiveErrors).toHaveLength(1);
    });
});
