import { describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P224 (ADR 0037) — the renderer reads exactly ONE value per dynamic-state field.
 *
 * The FOUNDATION only concerns how that one value is SOURCED:
 *   - UNBOUND (literal/none) → the node's internal per-client slot, which the
 *     compiler (nodes/webapp.js) expresses as a `state` binding to a reserved
 *     path with the configured-literal-or-neutral value as the `fallback`. An
 *     absent slot resolves to the fallback (default neutral); a written slot wins.
 *   - BOUND (store/state/…) → the bound source is the truth (unchanged).
 *
 * This suite pins the RENDER side of that contract with hand-built AppModels that
 * mirror exactly what the compiler now emits.
 */

const SLOT = "__dynamicState.al.visible";

function appWithAlert(visibleIf: BindingDefinition | undefined, state: Record<string, unknown> = {}): {
    app: ReturnType<typeof createRendererApp>;
} {
    const model: AppModel = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "al",
                kind: "alert",
                mount: "route:/home/content",
                ...(visibleIf ? { visibleIf } : {}),
                bind: {},
                props: { message: "hi" },
                events: []
            }
        ]
    };
    const integration: RuntimeIntegrationModel = {
        stores: [{ id: "visStore", name: "vis", statePath: "vis" }],
        queries: [],
        actions: [],
        navigations: []
    };
    return { app: createRendererApp(model, { integration, state }) };
}

function alertVisible(app: ReturnType<typeof createRendererApp>): boolean {
    return findComponentInSnapshot(app.render(), "al") !== undefined;
}

describe("P224: unbound dynamic-state field resolves from the per-client slot", () => {
    it("empty slot → the fallback wins (default neutral true → visible)", () => {
        const { app } = appWithAlert({ kind: "state", path: SLOT, fallback: true });
        expect(alertVisible(app)).toBe(true);
    });

    it("slot written false → hidden (one value, from the slot)", () => {
        const { app } = appWithAlert(
            { kind: "state", path: SLOT, fallback: true },
            { __dynamicState: { al: { visible: false } } }
        );
        expect(alertVisible(app)).toBe(false);
    });

    it("slot written true → visible", () => {
        const { app } = appWithAlert(
            { kind: "state", path: SLOT, fallback: true },
            { __dynamicState: { al: { visible: true } } }
        );
        expect(alertVisible(app)).toBe(true);
    });

    it("configured literal false becomes the fallback → hidden with no writer", () => {
        // The compiler carries a configured literal `visible:false` as the slot
        // binding's fallback, so back-compat (a deliberately-hidden node) holds.
        const { app } = appWithAlert({ kind: "state", path: SLOT, fallback: false });
        expect(alertVisible(app)).toBe(false);
    });
});

describe("P224: bound dynamic-state field resolves from its source (unchanged)", () => {
    it("store-bound visible reads the store slice, not any slot", () => {
        const hidden = appWithAlert({ kind: "store", path: "visStore" }, { vis: false });
        expect(alertVisible(hidden.app)).toBe(false);

        const shown = appWithAlert({ kind: "store", path: "visStore" }, { vis: true });
        expect(alertVisible(shown.app)).toBe(true);
    });
});
