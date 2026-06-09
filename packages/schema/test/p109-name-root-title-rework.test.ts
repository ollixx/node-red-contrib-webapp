/**
 * P109 — ui-app: name + root ins Schema, title raus; Render-Semantik.
 *
 * Acceptance criteria (unit side):
 *   1. uiAppNodeDefinitionSchema has `name` and `root`, NOT `title`.
 *   2. Back-compat: a config with `title` (no `name`) parses OK (Zod strips
 *      unknown fields; node validates on other required fields).
 *   3. AppModel (appModelSchema) uses `name`, not `title`.
 *   4. Fixtures use `name` at the top level (not `title`).
 */
import { describe, expect, it } from "vitest";

import {
    appModelSchema,
    customersCrudAppModelFixture,
    fixtureAppModels,
    uiAppNodeDefinitionSchema,
    validateUiNodeDefinition
} from "../src";

describe("P109: uiAppNodeDefinitionSchema — name + root, no title", () => {
    it("accepts a config with name and root (no title)", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            name: "My App",
            root: "myapp",
            layout: "vertical"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe("My App");
            expect(result.data.root).toBe("myapp");
            expect((result.data as Record<string, unknown>).title).toBeUndefined();
        }
    });

    it("does NOT retain `title` in parsed output (Zod strips unknown fields)", () => {
        // title should not be a named field in the schema.
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            name: "My App",
            root: "myapp",
            layout: "vertical",
            title: "Should be stripped"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).title).toBeUndefined();
        }
    });

    it("back-compat: a config with title (no name) is accepted — Zod strips title, node is valid", () => {
        // Old configs have `title` instead of `name`. Zod strips the unknown `title`.
        // `name` is optional, so validation still passes — existing Flows don't break.
        const result = validateUiNodeDefinition({
            type: "ui-app",
            id: "app1",
            layout: "vertical",
            title: "Legacy Title"
        });
        expect(result.success).toBe(true);
    });

    it("root is accepted as a string field", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            name: "My App",
            root: "my-app",
            layout: "vertical"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(typeof result.data.root).toBe("string");
            expect(result.data.root).toBe("my-app");
        }
    });
});

describe("P109: appModelSchema — name replaces title", () => {
    it("appModelSchema uses `name`, not `title`", () => {
        const result = appModelSchema.safeParse({
            id: "app1",
            name: "Test App",
            layouts: [
                { id: "vertical", title: "Vertical", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/", layoutId: "vertical" }]
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe("Test App");
            expect((result.data as Record<string, unknown>).title).toBeUndefined();
        }
    });

    it("appModelSchema rejects an AppModel without name (name is required)", () => {
        const result = appModelSchema.safeParse({
            id: "app1",
            // no `name`
            layouts: [
                { id: "vertical", title: "Vertical", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/", layoutId: "vertical" }]
        });
        expect(result.success).toBe(false);
    });

    it("appModelSchema rejects an empty name", () => {
        const result = appModelSchema.safeParse({
            id: "app1",
            name: "",
            layouts: [
                { id: "vertical", title: "Vertical", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/", layoutId: "vertical" }]
        });
        expect(result.success).toBe(false);
    });
});

describe("P109: fixtures use name at the top level", () => {
    it("customersCrudAppModelFixture has name, not title, at the top level", () => {
        const fixture = customersCrudAppModelFixture as Record<string, unknown>;
        expect(typeof fixture.name).toBe("string");
        expect(fixture.title).toBeUndefined();
    });

    it("all fixtureAppModels have name at the top level", () => {
        for (const fixture of fixtureAppModels) {
            const f = fixture as Record<string, unknown>;
            expect(typeof f.name, fixture.id).toBe("string");
            expect(f.title, fixture.id).toBeUndefined();
        }
    });
});
