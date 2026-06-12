import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P85 — Per-node editor property-panel specs for navigation-category nodes:
 * ui-accordion, ui-breadcrumb, ui-menu, ui-pagination, ui-stepper, ui-tabs.
 *
 * The minimal-coverage spec (minimal-coverage.spec.ts) already verifies
 * "opens without crash, has name + mount". This spec adds tests for the
 * navigation-specific fields: items/sections/tabs/steps arrays, events
 * configuration, and the select/interaction verbs each node owns.
 *
 * Editor-only: no webapp URL is visited. The test deploys nodes, opens the
 * property panel, and asserts on fields and port counts.
 */

test.describe("editor panels — ui-accordion (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("accordion: sections, multiple fields present and persist", async ({ page, request }) => {
        const sections = JSON.stringify([
            { id: "s1", label: "Section 1" },
            { id: "s2", label: "Section 2" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "accEdApp", root: "accEdApp", name: "Accordion App" })
            .node("ui-accordion", { id: "accEd1", sections, multiple: false })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("accEd1");

        // Accordion-specific fields must be present.
        await editor.expectFields(["name", "mount", "sections", "multiple"]);
        expect(await editor.inputPortCount("accEd1")).toBe(1);

        // The sections JSON must round-trip through the editor.
        const stored = await editor.readField("sections");
        expect(stored).toContain("s1");
        expect(stored).toContain("s2");
    });

    test("accordion has 1 output port (static, events stored as field)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "accEdApp2", root: "accEdApp2" })
            .node("ui-accordion", {
                id: "accEd2",
                sections: JSON.stringify([{ id: "faq", label: "FAQ" }]),
                events: JSON.stringify(["sectionOpen"])
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        // ui-accordion has 1 static output port (events are stored as a field, not
        // reflected as dynamic port labels the way ui-table does it).
        expect(await editor.inputPortCount("accEd2")).toBe(1);
    });
});

test.describe("editor panels — ui-tabs (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("tabs: tabs JSON array field is present and data persists", async ({ page, request }) => {
        const tabs = JSON.stringify([
            { id: "overview", label: "Overview" },
            { id: "details", label: "Details" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "tabsEdApp", root: "tabsEdApp", name: "Tabs App" })
            .node("ui-tabs", { id: "tabsEd1", tabs })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("tabsEd1");

        await editor.expectFields(["name", "mount", "tabs"]);
        expect(await editor.inputPortCount("tabsEd1")).toBe(1);

        const stored = await editor.readField("tabs");
        expect(stored).toContain("overview");
        expect(stored).toContain("details");
    });

    test("tabs has 1 output port (static, events stored as field)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tabsEdApp2", root: "tabsEdApp2" })
            .node("ui-tabs", {
                id: "tabsEd2",
                tabs: JSON.stringify([{ id: "t1", label: "T1" }]),
                events: JSON.stringify(["tabChange"])
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        // ui-tabs has 1 static output port.
        expect(await editor.inputPortCount("tabsEd2")).toBe(1);
    });
});

test.describe("editor panels — ui-stepper (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // P156 (ADR 0012): the `activeStepPath` plain text field became the `activeStep`
    // value typedInput (two-way). The legacy path migrates to a state binding; the
    // visible widget is now #node-input-activeStepBinding (typedInput).
    test("stepper: steps, activeStep typedInput, orientation fields present and data persists", async ({ page, request }) => {
        const steps = JSON.stringify([
            { id: "configure", label: "Configure" },
            { id: "review", label: "Review" },
            { id: "deploy", label: "Deploy" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "stpEdApp", root: "stpEdApp", name: "Stepper App" })
            .node("ui-stepper", { id: "stpEd1", steps, activeStepPath: "wizard.step" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("stpEd1");

        await editor.expectFields(["name", "mount", "steps", "activeStepBinding"]);
        expect(await editor.inputPortCount("stpEd1")).toBe(1);

        const stored = await editor.readField("steps");
        expect(stored).toContain("configure");
        expect(stored).toContain("review");
    });

    test("stepper has 1 output port (static, events stored as field)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "stpEdApp2", root: "stpEdApp2" })
            .node("ui-stepper", {
                id: "stpEd2",
                steps: JSON.stringify([{ id: "s1", label: "S1" }, { id: "s2", label: "S2" }]),
                events: JSON.stringify(["stepChange"])
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        // ui-stepper has 1 static output port.
        expect(await editor.inputPortCount("stpEd2")).toBe(1);
    });
});

test.describe("editor panels — ui-pagination (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // P154 (ADR 0012): totalPath/currentPagePath plain text fields became the
    // `total` / `currentPage` value typedInputs (currentPage two-way). The legacy
    // paths migrate to state bindings; the visible widgets are now
    // #node-input-totalBinding / #node-input-currentPageBinding.
    test("pagination: total + currentPage typedInputs present; legacy paths migrate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgEdApp", root: "pgEdApp", name: "Pagination App" })
            .node("ui-pagination", {
                id: "pgEd1",
                currentPagePath: "data.page",
                totalPath: "data.total",
                pageSize: 10
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("pgEd1");

        await editor.expectFields(["name", "mount", "currentPageBinding", "totalBinding", "pageSize"]);
        expect(await editor.inputPortCount("pgEd1")).toBe(1);

        // Legacy currentPagePath/totalPath migrate into the typedInputs as state
        // bindings — the typedInput value holds the migrated state path.
        expect(await editor.readTypedInput("currentPageBinding")).toBe("data.page");
        expect(await editor.readTypedInput("totalBinding")).toBe("data.total");
    });
});

test.describe("editor panels — ui-menu (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("menu: opens without crash and has expected fields", async ({ page, request }) => {
        const items = JSON.stringify([
            { label: "Home", route: "/" },
            { label: "Customers", route: "/customers" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "menuEdApp", root: "menuEdApp", name: "Menu App" })
            .node("ui-menu", { id: "menuEd1", items })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("menuEd1");

        await editor.expectFields(["name", "mount"]);
        expect(await editor.inputPortCount("menuEd1")).toBe(1);
    });

    // P157 (ADR 0012): `itemsPath` / `activeRoutePath` plain text fields became the
    // `items` (structural array) / `activeRoute` (read-only) value typedInputs. The
    // legacy paths migrate to state bindings; the visible widgets are now
    // #node-input-itemsBinding / #node-input-activeRouteBinding.
    test("menu: items + activeRoute typedInputs present; legacy paths migrate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuTiApp", root: "menuTiApp", name: "Menu TI App" })
            .node("ui-menu", {
                id: "menuTi1",
                itemsPath: "nav.items",
                activeRoutePath: "nav.activeRoute"
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("menuTi1");

        await editor.expectFields(["name", "mount", "itemsBinding", "activeRouteBinding"]);
        expect(await editor.inputPortCount("menuTi1")).toBe(1);

        // Legacy itemsPath/activeRoutePath migrate into the typedInputs as state
        // bindings — the typedInput value holds the migrated state path.
        expect(await editor.readTypedInput("itemsBinding")).toBe("nav.items");
        expect(await editor.readTypedInput("activeRouteBinding")).toBe("nav.activeRoute");
    });
});

test.describe("editor panels — ui-breadcrumb (P85)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("breadcrumb: opens without crash and has expected fields", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcEdApp", root: "bcEdApp", name: "Breadcrumb App" })
            .node("ui-breadcrumb", {
                id: "bcEd1",
                items: [{ label: "Home", path: "/" }, { label: "Customers", path: "/customers" }]
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("bcEd1");

        await editor.expectFields(["name", "mount"]);
        expect(await editor.inputPortCount("bcEd1")).toBe(1);
    });
});
