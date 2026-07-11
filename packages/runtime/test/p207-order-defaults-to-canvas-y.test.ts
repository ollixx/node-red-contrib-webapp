import { describe, expect, it } from "vitest";

/**
 * P207: a node with an empty `order` field falls back to its raw Node-RED
 * canvas y-position, so the visual arrangement on the canvas becomes the
 * rendered order in the slot. Explicit `order` still wins.
 *
 * `resolveOrder(config)` = `toOptionalNumber(config.order) ?? toOptionalNumber(config.y)`.
 * `config.y` is the raw canvas y — NOT `layoutY` (the absolute-layout field),
 * which stays separate and is untouched by this helper.
 */

// Load the webapp.js __test__ exports.
// webapp.js is CommonJS and requires packages/schema/dist — build first.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;
const resolveOrder = webappTest.resolveOrder as (config: Record<string, unknown>) => number | undefined;
const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

describe("resolveOrder", () => {
    it("uses order when explicitly set", () => {
        expect(resolveOrder({ order: "5", y: "120" })).toBe(5);
    });

    it("falls back to canvas y when order is empty string", () => {
        expect(resolveOrder({ order: "", y: "120" })).toBe(120);
    });

    it("falls back to canvas y when order is undefined", () => {
        expect(resolveOrder({ y: "80" })).toBe(80);
    });

    it("returns undefined when both order and y are empty", () => {
        expect(resolveOrder({ order: "", y: "" })).toBeUndefined();
        expect(resolveOrder({})).toBeUndefined();
    });

    it("does not fall back to layoutY (absolute-layout field stays separate)", () => {
        expect(resolveOrder({ layoutY: "200" })).toBeUndefined();
    });
});

describe("webapp.js mapConfig order sweep (P207)", () => {
    it("ui-text mapConfig: empty order falls back to canvas y", () => {
        const config = {
            id: "n1",
            type: "ui-text",
            parent: "container1",
            content: "hello",
            order: "",
            y: "240"
        };

        const definition = runtimeNodeRegistry["ui-text"].mapConfig(config);

        expect(definition.order).toBe(240);
    });

    it("ui-text mapConfig: explicit order wins over canvas y", () => {
        const config = {
            id: "n2",
            type: "ui-text",
            parent: "container1",
            content: "hello",
            order: "5",
            y: "240"
        };

        const definition = runtimeNodeRegistry["ui-text"].mapConfig(config);

        expect(definition.order).toBe(5);
    });

    it("ui-button mapConfig: empty order falls back to canvas y", () => {
        const config = {
            id: "n3",
            type: "ui-button",
            parent: "container1",
            label: "Click",
            order: "",
            y: "60"
        };

        const definition = runtimeNodeRegistry["ui-button"].mapConfig(config);

        expect(definition.order).toBe(60);
    });
});
