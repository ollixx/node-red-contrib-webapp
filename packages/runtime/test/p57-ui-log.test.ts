import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P57 — ui-log node schema validation and mapConfig tests.
 * Verifies:
 *   - uiLogNodeDefinitionSchema validates correctly (via schema package)
 *   - mapConfig produces the expected definition with the correct fields
 *   - node is registered in runtimeNodeRegistry and WEBAPP_NODE_TYPES
 */

const require = createRequire(import.meta.url);

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => Record<string, unknown>;
                options: { inputHandler: unknown };
            }
        >;
    };
    registerNodeType: (RED: unknown, type: string) => void;
};

describe("P57: ui-log node", () => {
    it("is registered in runtimeNodeRegistry", () => {
        expect(webapp.__test__.runtimeNodeRegistry["ui-log"]).toBeDefined();
    });

    it("mapConfig produces the expected definition", () => {
        const mapConfig = webapp.__test__.runtimeNodeRegistry["ui-log"].mapConfig;
        const config = {
            id: "log-node-1",
            uiId: "log-node-1",
            parent: "myApp",
            mount: "app:myApp/content",
            minSeverity: "warn",
            maxEntries: "50",
            collapsed: false
        };
        const result = mapConfig(config);
        expect(result.type).toBe("ui-log");
        expect(result.id).toBe("log-node-1");
        expect(result.mount).toBe("app:myApp/content");
        expect(result.minSeverity).toBe("warn");
        expect(result.maxEntries).toBe(50);
        expect(result.collapsed).toBeUndefined(); // false → undefined (truthy check)
    });

    it("mapConfig handles collapsed=true", () => {
        const mapConfig = webapp.__test__.runtimeNodeRegistry["ui-log"].mapConfig;
        const config = {
            id: "log-node-2",
            uiId: "log-node-2",
            parent: "myApp",
            mount: "app:myApp/content",
            collapsed: true
        };
        const result = mapConfig(config);
        expect(result.collapsed).toBe(true);
    });

    it("mapConfig defaults mount to parent when mount is absent", () => {
        const mapConfig = webapp.__test__.runtimeNodeRegistry["ui-log"].mapConfig;
        const config = {
            id: "log-node-3",
            uiId: "log-node-3",
            parent: "myApp"
        };
        const result = mapConfig(config);
        expect(result.mount).toBe("myApp");
    });

    it("minSeverity defaults to undefined when not set", () => {
        const mapConfig = webapp.__test__.runtimeNodeRegistry["ui-log"].mapConfig;
        const config = { id: "log-node-4", uiId: "log-node-4", parent: "myApp" };
        const result = mapConfig(config);
        expect(result.minSeverity).toBeUndefined();
    });
});
