import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture } from "@node-red-contrib-webapp/schema";

import { createContributionsFromAppModel, createRuntimeRegistry, type AppContribution } from "../src";

// Minimal app contribution with a root field for cross-app root-uniqueness tests.
function makeAppContrib(id: string, root: string, name = id): AppContribution {
    return {
        kind: "app",
        registrationId: `${id}:app`,
        definition: { id, name, root }
    };
}

describe("P108 — root-uniqueness validation", () => {
    it("reports duplicate-app-root when two apps share the same root with different ids", () => {
        const registry = createRuntimeRegistry();

        // Register two apps with different ids but the same root.
        registry.register(makeAppContrib("appA", "myapp", "App A"));
        registry.register(makeAppContrib("appB", "myapp", "App B"));

        // Also register minimal layout/route contributions so compile() can build a model.
        // We only care about the diagnostic code here — diagnostics are emitted before model build.
        // compile("appA") should surface the conflict.
        const layoutA: import("../src").LayoutContribution = {
            kind: "layout",
            appId: "appA",
            registrationId: "appA:layout:main",
            definition: {
                id: "main",
                preset: "single-column",
                slots: [{ name: "content" }]
            }
        };
        const routeA: import("../src").RouteContribution = {
            kind: "route",
            appId: "appA",
            registrationId: "appA:route:home",
            definition: {
                id: "home",
                path: "/",
                layoutId: "main"
            }
        };
        registry.register(layoutA);
        registry.register(routeA);

        const resultA = registry.compile("appA");

        expect(resultA.diagnostics).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: "duplicate-app-root",
                    appId: "appA",
                    registrationIds: expect.arrayContaining(["appA:app", "appB:app"])
                })
            ])
        );
    });

    it("does not report duplicate-app-root when two apps have different roots", () => {
        const registry = createRuntimeRegistry();

        registry.register(makeAppContrib("appA", "shop", "Shop App"));
        registry.register(makeAppContrib("appB", "admin", "Admin App"));

        // Minimal contributions for appA so compile can finish.
        registry.register({
            kind: "layout",
            appId: "appA",
            registrationId: "appA:layout:main",
            definition: { id: "main", preset: "single-column", slots: [{ name: "content" }] }
        });
        registry.register({
            kind: "route",
            appId: "appA",
            registrationId: "appA:route:home",
            definition: { id: "home", path: "/", layoutId: "main" }
        });

        const resultA = registry.compile("appA");

        const rootDiagnostics = resultA.diagnostics.filter((d) => d.code === "duplicate-app-root");
        expect(rootDiagnostics).toHaveLength(0);
    });

    it("does not report duplicate-app-root when root is absent (undefined)", () => {
        const registry = createRuntimeRegistry();

        // Apps without root set — no conflict possible.
        registry.registerMany(createContributionsFromAppModel(customersCrudAppModelFixture, "fixture"));
        registry.registerMany(
            createContributionsFromAppModel({ ...customersCrudAppModelFixture, id: "ordersApp", name: "Orders" }, "orders")
        );

        const result = registry.compile(customersCrudAppModelFixture.id);

        const rootDiagnostics = result.diagnostics.filter((d) => d.code === "duplicate-app-root");
        expect(rootDiagnostics).toHaveLength(0);
    });

    it("duplicate-app-root diagnostic includes both conflicting registration ids", () => {
        const registry = createRuntimeRegistry();

        registry.register(makeAppContrib("alpha", "shared", "Alpha"));
        registry.register(makeAppContrib("beta", "shared", "Beta"));

        // Minimal setup for alpha to compile.
        registry.register({
            kind: "layout",
            appId: "alpha",
            registrationId: "alpha:layout:l",
            definition: { id: "l", preset: "single-column", slots: [{ name: "content" }] }
        });
        registry.register({
            kind: "route",
            appId: "alpha",
            registrationId: "alpha:route:r",
            definition: { id: "r", path: "/", layoutId: "l" }
        });

        const result = registry.compile("alpha");
        const diag = result.diagnostics.find((d) => d.code === "duplicate-app-root");

        expect(diag).toBeDefined();
        expect(diag!.registrationIds).toContain("alpha:app");
        expect(diag!.registrationIds).toContain("beta:app");
        expect(diag!.message).toContain("'shared'");
        expect(diag!.message).toContain("'alpha'");
        expect(diag!.message).toContain("'beta'");
    });
});
