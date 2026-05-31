import { describe, expect, it } from "vitest";

/**
 * Regression test for the app-ID mismatch bug:
 *
 * webapp.js runtimeNodeRegistry["ui-app"].mapConfig used `config.root || config.id`
 * as the app's model ID. When `config.root` (the URL path, e.g. "test") differs
 * from `config.id` (the Node-RED UUID, e.g. "c27dd5f541cfd684"), the model ID
 * diverges from the mount values the editor generates. The editor always uses
 * `node.id` (UUID) as the mount target prefix — so `createAppRootRoute` would
 * produce a root route with id "test", but the component mount has target
 * "c27dd5f541cfd684", and mountMatches() returns false.
 *
 * Expected behaviour: the app's model ID is always the node UUID (config.id).
 * `config.root` is the URL path and must not be used as the ID.
 */

// Load the webapp.js __test__ exports.
// webapp.js is CommonJS and requires packages/schema/dist — build first.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;
const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

describe("webapp.js runtimeNodeRegistry ui-app mapConfig", () => {
    it("uses node UUID as app id, not config.root", () => {
        const config = {
            id: "c27dd5f541cfd684",
            name: "Test App",
            root: "test",           // URL path — must NOT become the model id
            layout: "app",
            events: "[]"
        };

        const definition = runtimeNodeRegistry["ui-app"].mapConfig(config);

        // The model ID must be the node UUID so it matches editor-generated mount values
        expect(definition.id).toBe("c27dd5f541cfd684");
        // root (URL) should still be accessible in the definition for HTTP routing
        expect(definition.id).not.toBe("test");
    });

    it("falls back to node UUID when root is not set", () => {
        const config = {
            id: "abc123",
            name: "No Root App",
            root: "",
            layout: "vertical",
            events: "[]"
        };

        const definition = runtimeNodeRegistry["ui-app"].mapConfig(config);

        expect(definition.id).toBe("abc123");
    });
});
