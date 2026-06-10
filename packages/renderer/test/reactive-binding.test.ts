import { beforeEach, describe, expect, it, vi } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture } from "@node-red-contrib-webapp/schema";

import {
    __getReactiveCompileCount,
    __resetReactiveCache,
    AMBIGUOUS_STORE,
    buildStoreNamePaths,
    createRendererApp,
    evaluateReactiveExpression,
    findComponentInSnapshot
} from "../src";

/**
 * P115 (ADR 0010) — renderer half of the `reactive` binding kind.
 *
 * A `reactive` binding's `value` is a synchronous JS expression compiled once
 * and evaluated per snapshot, with `routeParam` / `store(name)` / `query(path)`
 * globals and hard error containment.
 * See docs/nodes/concepts/reactive-expressions.md.
 */

beforeEach(() => {
    __resetReactiveCache();
});

// A ui-text on /customers/:id whose `value` is a reactive expression.
function textWithReactive(source: string) {
    return {
        ...customersCrudAppModelFixture,
        components: [
            ...customersCrudAppModelFixture.components,
            {
                id: "reactiveText",
                kind: "text" as const,
                mount: "route:/customers/:id/content",
                bind: {
                    value: { kind: "reactive" as const, value: source }
                },
                props: {},
                events: []
            }
        ]
    };
}

function reactiveText(snapshotApp: ReturnType<typeof createRendererApp>) {
    const text = findComponentInSnapshot(snapshotApp.render(), "reactiveText");
    return text && "text" in text ? text.text : undefined;
}

describe("P115 reactive binding — renderer happy path", () => {
    it("composes a route param into a string via a template literal", () => {
        const app = createRendererApp(textWithReactive("`Kunde ${routeParam.id}`"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42"
        });

        expect(reactiveText(app)).toBe("Kunde 42");
    });
});

describe("P115 reactive binding — store() and query() globals", () => {
    it("store(name) returns the live value at the named store's statePath", () => {
        const app = createRendererApp(textWithReactive('store("customer").name'), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            state: { draft: { customer: { name: "Ada Lovelace" } } }
        });

        expect(reactiveText(app)).toBe("Ada Lovelace");
    });

    it("query(path) returns the value at the path inside the query results", () => {
        const app = createRendererApp(textWithReactive('`${query("customers.total")} Kunden`'), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            queries: { customers: { total: 7 } }
        });

        expect(reactiveText(app)).toBe("7 Kunden");
    });

    it("renders the invalid-value marker and logs once when the store name is unknown", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(textWithReactive('store("nope")'), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            onReactiveError
        });

        // The broken field renders "?"; the rest of the snapshot is intact.
        const snapshot = app.render();
        expect(findComponentInSnapshot(snapshot, "reactiveText")).toBeDefined();
        expect(reactiveText(app)).toBe("?");

        // Re-render several more times — still only one log entry.
        app.render();
        app.render();
        expect(onReactiveError).toHaveBeenCalledTimes(1);
        expect(onReactiveError.mock.calls[0][0].message).toContain('Unknown store "nope"');
    });
});

describe("P115 reactive binding — error containment", () => {
    it.each([
        ["a throwing expression", "routeParam.x.y.z"],
        ["a syntax-broken expression", "`Kunde ${routeParam.id"],
        ["a Promise-returning expression", "Promise.resolve(1)"]
    ])("contains %s: invalid-value marker + exactly one log across re-renders", (_label, source) => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(textWithReactive(source), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            onReactiveError
        });

        // Three renders — the snapshot never throws and the field shows "?".
        expect(reactiveText(app)).toBe("?");
        expect(reactiveText(app)).toBe("?");
        expect(reactiveText(app)).toBe("?");

        expect(onReactiveError).toHaveBeenCalledTimes(1);
    });

    it("reports the synchronous-only rule for a thenable result", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(textWithReactive("Promise.resolve(1)"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            onReactiveError
        });

        app.render();
        expect(onReactiveError.mock.calls[0][0].message).toContain("must be synchronous");
    });
});

describe("P115 reactive binding — reactivity (no dependency tracking)", () => {
    it("re-evaluates on route change, store change, and query change", () => {
        const app = createRendererApp(
            textWithReactive('`${routeParam.id}/${store("customer")}/${query("n")}`'),
            {
                integration: customersCrudRuntimeIntegrationFixture,
                location: "/customers/1",
                state: { draft: { customer: "a" } },
                queries: { n: "x" }
            }
        );

        expect(reactiveText(app)).toBe("1/a/x");

        // (a) route change
        app.navigate("/customers/2");
        expect(reactiveText(app)).toBe("2/a/x");

        // (b) store/state change under the store's statePath
        app.replaceState({ draft: { customer: "b" } });
        // navigate state was reset by replaceState; re-navigate to keep route param 2
        app.navigate("/customers/2");
        expect(reactiveText(app)).toBe("2/b/x");

        // (c) query change
        app.replaceQueries({ n: "y" });
        app.navigate("/customers/2");
        expect(reactiveText(app)).toBe("2/b/y");
    });
});

describe("P115 reactive binding — compile-once cache", () => {
    it("compiles a given source exactly once across many evaluations", () => {
        const sources = {
            state: {},
            queries: {},
            params: { id: "1" },
            storeNamePaths: {}
        };

        expect(__getReactiveCompileCount()).toBe(0);
        evaluateReactiveExpression("`Kunde ${routeParam.id}`", sources);
        evaluateReactiveExpression("`Kunde ${routeParam.id}`", { ...sources, params: { id: "2" } });
        evaluateReactiveExpression("`Kunde ${routeParam.id}`", { ...sources, params: { id: "3" } });

        expect(__getReactiveCompileCount()).toBe(1);
    });

    it("does not recompile a source whose compilation already failed", () => {
        const sources = { state: {}, queries: {}, params: {}, storeNamePaths: {} };

        const first = evaluateReactiveExpression("`broken ${", sources);
        const second = evaluateReactiveExpression("`broken ${", sources);

        expect(first.error).toBeDefined();
        expect(second.error).toBeDefined();
        expect(__getReactiveCompileCount()).toBe(1);
    });
});

describe("P115 reactive binding — buildStoreNamePaths", () => {
    it("maps trimmed names to statePaths", () => {
        const map = buildStoreNamePaths([{ name: "  customer ", statePath: "draft.customer" }]);
        expect(map.customer).toBe("draft.customer");
    });

    it("marks duplicate names as ambiguous rather than last-wins", () => {
        const map = buildStoreNamePaths([
            { name: "dup", statePath: "a" },
            { name: "dup", statePath: "b" }
        ]);
        expect(map.dup).toBe(AMBIGUOUS_STORE);
    });

    it("treats an empty name as a valid (mapped) name; skips stores with no name field", () => {
        const map = buildStoreNamePaths([
            { name: "", statePath: "x" },
            { statePath: "y" }
        ]);
        expect(map[""]).toBe("x");
        expect(Object.keys(map)).toEqual([""]);
    });

    it("resolving an ambiguous name throws (and is therefore contained as an error)", () => {
        const result = evaluateReactiveExpression('store("dup")', {
            state: { a: 1 },
            queries: {},
            params: {},
            storeNamePaths: { dup: AMBIGUOUS_STORE }
        });

        expect(result.error?.message).toContain('Ambiguous store name "dup"');
    });
});
