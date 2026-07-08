import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        collectAppScopedParentIssues: (nodes: unknown[]) => { nodeId: string; parent: string; message: string }[];
    };
};
const { collectAppScopedParentIssues } = webapp.__test__;

/**
 * P205 (Owner 2026-07-06): an app-scoped node (store/query/action/navigation/
 * dialog/route) must reference a real ui-app via `parent`. Deploy groups by flow
 * tab (z), NOT by parent, so a parentless / own-id / non-app parent renders
 * silently — this validation surfaces it as a deploy error. Pure over a nodes
 * array. The owner's exact case (a new store with no App) → an issue.
 */
describe("P205: app-scoped node requires a valid ui-app parent", () => {
    const app = { type: "ui-app", id: "app1", root: "app1" };

    it("a store with a VALID app parent → no issue", () => {
        const issues = collectAppScopedParentIssues([app, { type: "ui-store", id: "s1", parent: "app1" }]);
        expect(issues).toEqual([]);
    });

    it("the owner's case — a new store with NO parent → one issue", () => {
        const issues = collectAppScopedParentIssues([app, { type: "ui-store", id: "s1", parent: "" }]);
        expect(issues).toHaveLength(1);
        expect(issues[0].nodeId).toBe("s1");
        expect(issues[0].message).toContain("no App parent");
    });

    it("a store whose parent is its OWN id → one issue (the 22c604b corruption class)", () => {
        const issues = collectAppScopedParentIssues([app, { type: "ui-store", id: "s1", parent: "s1" }]);
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain("own id");
    });

    it("a store whose parent is not a ui-app in the flow → one issue", () => {
        const issues = collectAppScopedParentIssues([app, { type: "ui-store", id: "s1", parent: "nope" }]);
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain("not a ui-app");
    });

    it("applies to ALL app-scoped types (store/query/action/navigation/dialog/route)", () => {
        const nodes = [
            app,
            { type: "ui-store", id: "s1", parent: "" },
            { type: "ui-query", id: "q1", parent: "" },
            { type: "ui-action", id: "a1", parent: "" },
            { type: "ui-navigation", id: "n1", parent: "" },
            { type: "ui-dialog", id: "d1", parent: "" },
            { type: "ui-route", id: "r1", parent: "" },
        ];
        const issues = collectAppScopedParentIssues(nodes);
        expect(issues.map((i) => i.nodeId).sort()).toEqual(["a1", "d1", "n1", "q1", "r1", "s1"]);
    });

    it("a plain display node (ui-text) is NOT app-scoped → never flagged", () => {
        const issues = collectAppScopedParentIssues([app, { type: "ui-text", id: "t1", parent: "" }]);
        expect(issues).toEqual([]);
    });

    it("all valid parents (mirrors FlowBuilder / customers-crud) → no issues", () => {
        const nodes = [
            app,
            { type: "ui-store", id: "s1", parent: "app1" },
            { type: "ui-query", id: "q1", parent: "app1" },
            { type: "ui-route", id: "r1", parent: "app1" },
            { type: "ui-dialog", id: "d1", parent: "app1" },
        ];
        expect(collectAppScopedParentIssues(nodes)).toEqual([]);
    });
});
