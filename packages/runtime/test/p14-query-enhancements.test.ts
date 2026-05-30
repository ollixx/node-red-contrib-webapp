import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";


const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        queryInputHandler: (node: Record<string, unknown>, msg: unknown, send: (m: unknown) => void, done: () => void) => void;
        triggerParamQueryRefresh: (storeId: string) => void;
        runtimeState: {
            queryEtags: Map<string, string>;
            definitions: Map<string, { nodeId: string; definition: Record<string, unknown> }>;
            RED: unknown;
        };
    };
};

const { runtimeNodeRegistry, queryInputHandler, runtimeState } = webapp.__test__;

describe("P14: ui-query schema — source field gracefully ignored", () => {
    it("mapConfig with source field does not fail — source is gracefully ignored", () => {
        const def = runtimeNodeRegistry["ui-query"].mapConfig({
            id: "q1",
            queryPath: "customers.list",
            source: "some-legacy-source"
        }) as Record<string, unknown>;

        expect(def).toBeDefined();
        expect(def.queryPath).toBe("customers.list");
    });

    it("ui-query mapConfig does not forward source field", () => {
        const def = runtimeNodeRegistry["ui-query"].mapConfig({
            id: "q1",
            queryPath: "customers.list",
            source: "some-legacy-value"
        }) as Record<string, unknown>;

        expect(def).not.toHaveProperty("source");
        expect(def.queryPath).toBe("customers.list");
    });
});

describe("P14: ui-query — params field", () => {
    it("mapConfig forwards params field", () => {
        const def = runtimeNodeRegistry["ui-query"].mapConfig({
            id: "q1",
            queryPath: "customers.list",
            params: "filterStore"
        }) as Record<string, unknown>;

        expect(def).toMatchObject({ params: "filterStore" });
    });

    it("mapConfig sets params to undefined when absent", () => {
        const def = runtimeNodeRegistry["ui-query"].mapConfig({
            id: "q1",
            queryPath: "customers.list"
        }) as Record<string, unknown>;

        expect((def as Record<string, unknown>).params).toBeUndefined();
    });
});

describe("P14: ETag caching", () => {
    beforeEach(() => {
        runtimeState.queryEtags.clear();
    });

    function makeNode(id: string) {
        return { id, webappDefinition: { type: "ui-query", id, queryPath: "customers.list" } };
    }

    it("sends msg when no etag is present", () => {
        const node = makeNode("q1");
        const send = vi.fn();
        const msg = { ui: { query: { queryPath: "customers.list", data: [1, 2, 3] } } };
        queryInputHandler(node, msg, send, vi.fn());
        expect(send).toHaveBeenCalledOnce();
    });

    it("sends msg when etag is new", () => {
        const node = makeNode("q1");
        const send = vi.fn();
        const msg = { ui: { query: { queryPath: "customers.list", etag: "v1", data: [] } } };
        queryInputHandler(node, msg, send, vi.fn());
        expect(send).toHaveBeenCalledOnce();
    });

    it("skips send when etag is identical to last push", () => {
        const node = makeNode("q1");
        const send = vi.fn();
        const msg = { ui: { query: { queryPath: "customers.list", etag: "v1", data: [] } } };
        queryInputHandler(node, msg, send, vi.fn());
        queryInputHandler(node, msg, send, vi.fn());
        expect(send).toHaveBeenCalledOnce();
    });

    it("sends again when etag changes", () => {
        const node = makeNode("q1");
        const send = vi.fn();
        const msg1 = { ui: { query: { queryPath: "customers.list", etag: "v1", data: [] } } };
        const msg2 = { ui: { query: { queryPath: "customers.list", etag: "v2", data: [1] } } };
        queryInputHandler(node, msg1, send, vi.fn());
        queryInputHandler(node, msg2, send, vi.fn());
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("two distinct nodes with the same etag are cached independently", () => {
        const node1 = makeNode("q1");
        const node2 = makeNode("q2");
        const send = vi.fn();
        const msg = { ui: { query: { queryPath: "customers.list", etag: "v1", data: [] } } };
        queryInputHandler(node1, msg, send, vi.fn());
        queryInputHandler(node2, msg, send, vi.fn());
        expect(send).toHaveBeenCalledTimes(2);
    });
});

describe("P14: store-param reactivity — triggerParamQueryRefresh", () => {
    beforeEach(() => {
        runtimeState.definitions.clear();
    });

    it("sends refresh message to query nodes that reference the updated store", () => {
        const send = vi.fn();
        const mockQueryNode = { send };

        runtimeState.definitions.set("q1", {
            nodeId: "q1",
            definition: { type: "ui-query", id: "q1", queryPath: "customers.list", params: "filterStore" } as Record<string, unknown>
        });

        runtimeState.RED = {
            nodes: {
                getNode: (id: string) => (id === "q1" ? mockQueryNode : undefined)
            }
        };

        const { triggerParamQueryRefresh } = webapp.__test__;
        triggerParamQueryRefresh("filterStore");

        expect(send).toHaveBeenCalledOnce();
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ ui: expect.objectContaining({ query: expect.objectContaining({ refresh: true }) }) })
        );
    });

    it("does not send to query nodes that reference a different store", () => {
        const send = vi.fn();
        const mockQueryNode = { send };

        runtimeState.definitions.set("q1", {
            nodeId: "q1",
            definition: { type: "ui-query", id: "q1", queryPath: "customers.list", params: "otherStore" } as Record<string, unknown>
        });

        runtimeState.RED = {
            nodes: {
                getNode: (id: string) => (id === "q1" ? mockQueryNode : undefined)
            }
        };

        const { triggerParamQueryRefresh } = webapp.__test__;
        triggerParamQueryRefresh("filterStore");

        expect(send).not.toHaveBeenCalled();
    });

    it("does nothing when RED is not set", () => {
        runtimeState.RED = undefined;
        const { triggerParamQueryRefresh } = webapp.__test__;
        expect(() => triggerParamQueryRefresh("filterStore")).not.toThrow();
    });
});
