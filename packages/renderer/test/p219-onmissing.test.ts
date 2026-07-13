import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import { __resetReactiveCache, createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P219 (ADR 0034) — per-field `onMissing` behaviour at BOTH invalid-value points.
 *
 * A bindable value field may carry an optional `onMissing` selector:
 *  - `marker` (default / absent) → today's invalid-value marker `"?"` PLUS the
 *    existing one-time report (behaviour unchanged, existing specs stay green).
 *  - `ignore` → render EMPTY (`""`) and report NOTHING.
 *
 * The branch fires at the two places the renderer produces the marker: a failed
 * `reactive` expression, and an unresolvable `store` sub-path.
 */

beforeEach(() => {
    __resetReactiveCache();
});

// One ui-text whose `value` is the binding under test.
function appWithText(valueBinding: BindingDefinition): AppModel {
    return {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "t",
                kind: "text",
                mount: "route:/home/content",
                bind: { value: valueBinding },
                props: {},
                events: []
            }
        ]
    };
}

function integrationWith(statePath: string, name = "monster"): RuntimeIntegrationModel {
    return {
        stores: [{ id: "monsterStore", name, statePath }],
        queries: [],
        actions: [],
        navigations: []
    };
}

function textOf(app: ReturnType<typeof createRendererApp>): string | undefined {
    const text = findComponentInSnapshot(app.render(), "t");
    return text && "text" in text ? text.text : undefined;
}

describe("P219 onMissing — reactive invalid point", () => {
    it("onMissing:ignore → renders EMPTY and reports NOTHING", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "reactive", value: 'store("nope")', onMissing: "ignore" }),
            { integration: integrationWith("monster"), onReactiveError }
        );

        expect(textOf(app)).toBe("");
        app.render();
        expect(onReactiveError).not.toHaveBeenCalled();
    });

    it("onMissing:marker (explicit) → '?' + one report (today's behaviour)", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "reactive", value: 'store("nope")', onMissing: "marker" }),
            { integration: integrationWith("monster"), onReactiveError }
        );

        expect(textOf(app)).toBe("?");
        app.render();
        expect(onReactiveError).toHaveBeenCalledTimes(1);
    });

    it("absent onMissing → '?' + one report (default unchanged)", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "reactive", value: 'store("nope")' }),
            { integration: integrationWith("monster"), onReactiveError }
        );

        expect(textOf(app)).toBe("?");
        app.render();
        expect(onReactiveError).toHaveBeenCalledTimes(1);
    });
});

describe("P219 onMissing — store sub-path invalid point", () => {
    it("scalar slice + sub-path + onMissing:ignore → EMPTY, NO report", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" }, onMissing: "ignore" }),
            { integration: integrationWith("scalar"), state: { scalar: "eins" }, onReactiveError }
        );

        expect(textOf(app)).toBe("");
        app.render();
        expect(onReactiveError).not.toHaveBeenCalled();
    });

    it("scalar slice + sub-path, absent onMissing → '?' + speaking report (default unchanged)", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" } }),
            { integration: integrationWith("scalar"), state: { scalar: "eins" }, onReactiveError }
        );

        expect(textOf(app)).toBe("?");
        app.render();
        expect(onReactiveError).toHaveBeenCalledTimes(1);
        expect(onReactiveError.mock.calls[0][0].message).toContain('der String "eins"');
    });

    it("object slice bound without a sub-path + onMissing:ignore → EMPTY, NO report", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithText({ kind: "store", path: "monsterStore", onMissing: "ignore" }),
            { integration: integrationWith("monster"), state: { monster: { a: false, c: "eins" } }, onReactiveError }
        );

        expect(textOf(app)).toBe("");
        app.render();
        expect(onReactiveError).not.toHaveBeenCalled();
    });
});
