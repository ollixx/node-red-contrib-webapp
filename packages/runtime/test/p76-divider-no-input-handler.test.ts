import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P76 — ui-divider has no input port and no input handler.
 *
 * ui-divider is a static display node (inputs:0 in the editor). Before this
 * fix, the runtimeNodeRegistry entry for "ui-divider" listed
 * componentStateInputHandler as its inputHandler, which was dead code —
 * Node-RED never delivers messages to a node with inputs:0.
 *
 * This test verifies that the registry entry has an empty options object
 * (no inputHandler), making the runtime consistent with the spec and the
 * editor declaration.
 */

const require = createRequire(import.meta.url);

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            { options: { inputHandler?: unknown } }
        >;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

describe("P76: ui-divider — no input handler (static display node)", () => {
    it("runtimeNodeRegistry['ui-divider'].options has no inputHandler property", () => {
        const entry = runtimeNodeRegistry["ui-divider"];
        expect(entry).toBeDefined();
        expect(entry.options.inputHandler).toBeUndefined();
    });

    it("ui-divider options object is empty (no handler registered)", () => {
        const { options } = runtimeNodeRegistry["ui-divider"];
        expect(Object.keys(options)).toHaveLength(0);
    });
});
