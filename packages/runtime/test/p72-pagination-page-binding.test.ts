import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

/**
 * P72 — Bugfix: ui-pagination page binding field-name mismatch.
 *
 * The editor saves the state-path for the current page as `currentPagePath`.
 * Before this fix, `mapConfig` read `config.pagePath` (wrong name) which was
 * always `undefined` → the `page` binding was never resolved from the
 * editor's state-path value → pagination always had no page binding.
 *
 * After the fix, `mapConfig` reads `config.currentPagePath` and produces a
 * `stateBinding("customers.page")` for `page`.
 */

describe("P72: ui-pagination — page binding field-name fix", () => {
    const reg = runtimeNodeRegistry["ui-pagination"];

    it("currentPagePath produces a state binding for page", () => {
        const def = reg.mapConfig({
            id: "pg1",
            mount: "app1.content",
            currentPagePath: "customers.page",
            totalPath: "customers.total"
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        expect(page).toBeDefined();
        expect(page?.kind).toBe("state");
        expect(page?.path).toBe("customers.page");
    });

    it("currentPagePath empty → mapConfig does not throw", () => {
        expect(() => reg.mapConfig({ id: "pg2", mount: "app1.content", currentPagePath: "", totalPath: "" })).not.toThrow();
    });

    it("pagePath (old wrong name) no longer drives the page binding", () => {
        // Ensure the old wrong field name does NOT produce a state binding —
        // this confirms the fix is real and not coincidental.
        const def = reg.mapConfig({
            id: "pg3",
            mount: "app1.content",
            pagePath: "customers.page",   // old wrong field name
            currentPagePath: "",           // correct field, intentionally empty
            totalPath: ""
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        // With the fix: pagePath is ignored; page.kind should NOT be "state"
        expect(page?.kind).not.toBe("state");
    });
});
