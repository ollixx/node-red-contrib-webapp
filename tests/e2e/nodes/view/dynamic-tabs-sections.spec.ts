import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P170 (ADR 0017 × 0018, capstone) — DYNAMIC tabs/sections via ui-repeat.
 *
 * The dynamic case is COMPOSITION, not a new mechanism: a `ui-repeat` bound to a
 * store array, whose default-slot template is a single `ui-tab`
 * (`label = item.<field>`), mounted into a `ui-tabs`, renders one keyed tab per
 * data row. Same for `ui-accordion` + `ui-accordion-section`. Changing the array
 * (add/remove/reorder) reshapes the visible tab set, keyed by the repeat key ×
 * section id, so unchanged tabs keep their stable per-instance ids and do not
 * re-mount; the active/open child id stays valid while its row still exists.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */

const PEOPLE = [
    { id: "ada", name: "Ada", bio: "Analyst" },
    { id: "lin", name: "Linus", bio: "Kernel" }
];

test.describe("dynamic tabs/sections via ui-repeat (P170)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── ui-tabs: a ui-repeat of ui-tab → one tab per row ─────────────────────

    test("T01 — a ui-repeat of ui-tab renders one keyed tab per store row, label from item.name", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p170T1App", root: "p170T1App" })
            .node("ui-store", { id: "p170T1Store", statePath: "people", initialValue: JSON.stringify(PEOPLE) })
            .node("ui-tabs", { id: "p170T1Tabs" })
            .node("ui-repeat", {
                id: "p170T1Rep",
                mount: "ui-tabs:p170T1Tabs/content",
                items: { kind: "state", path: "people" },
                keyField: "id"
            })
            .node("ui-tab", {
                id: "p170T1Tab",
                mount: "container:p170T1Rep/content",
                label: { kind: "item", path: "name" },
                order: 0
            })
            .node("ui-text", {
                id: "p170T1Body",
                mount: "ui-tab:p170T1Tab/content",
                value: { kind: "item", path: "bio" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p170T1App");
        await webapp.navigate("/");

        // one sl-tab per row, label = item.name, keyed id = <itemKey>#<templateId>.
        await expect(page.locator("sl-tab")).toHaveCount(2);
        await expect(page.locator("sl-tab[panel='ada#p170T1Tab']")).toContainText("Ada");
        await expect(page.locator("sl-tab[panel='lin#p170T1Tab']")).toContainText("Linus");

        // each tab's content resolves against its row scope (item.bio).
        await expect(page.locator("sl-tab-panel[name='ada#p170T1Tab']")).toContainText("Analyst");
        await expect(page.locator("sl-tab-panel[name='lin#p170T1Tab']")).toContainText("Kernel");

        // default active = first dynamic tab by order.
        await expect(page.locator("sl-tab[panel='ada#p170T1Tab']")).toHaveAttribute("active", "");
    });

    test("T02 — adding a row adds a tab (keyed: existing tabs keep their ids)", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "p170T2App", root: "p170T2App" })
            .node("ui-store", { id: "p170T2Store", statePath: "people", initialValue: JSON.stringify(PEOPLE) })
            .node("ui-tabs", { id: "p170T2Tabs" })
            .node("ui-repeat", {
                id: "p170T2Rep",
                mount: "ui-tabs:p170T2Tabs/content",
                items: { kind: "state", path: "people" },
                keyField: "id"
            })
            .node("ui-tab", {
                id: "p170T2Tab",
                mount: "container:p170T2Rep/content",
                label: { kind: "item", path: "name" },
                order: 0
            });
        const flow = builder
            .withStoreInject("p170T2Inj", "p170T2Store", [
                ...PEOPLE,
                { id: "gra", name: "Grace", bio: "Compiler" }
            ])
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p170T2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab")).toHaveCount(2);

        // push a 3-row array → a third tab appears; the first two keep their ids.
        await injectMessage(request, "p170T2Inj");
        await expect(page.locator("sl-tab")).toHaveCount(3, { timeout: 5000 });
        await expect(page.locator("sl-tab[panel='ada#p170T2Tab']")).toContainText("Ada");
        await expect(page.locator("sl-tab[panel='lin#p170T2Tab']")).toContainText("Linus");
        await expect(page.locator("sl-tab[panel='gra#p170T2Tab']")).toContainText("Grace");
    });

    test("T03 — reordering the array reorders the tabs, keyed (ids stable)", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "p170T3App", root: "p170T3App" })
            .node("ui-store", { id: "p170T3Store", statePath: "people", initialValue: JSON.stringify(PEOPLE) })
            .node("ui-tabs", { id: "p170T3Tabs" })
            .node("ui-repeat", {
                id: "p170T3Rep",
                mount: "ui-tabs:p170T3Tabs/content",
                items: { kind: "state", path: "people" },
                keyField: "id"
            })
            .node("ui-tab", {
                id: "p170T3Tab",
                mount: "container:p170T3Rep/content",
                label: { kind: "item", path: "name" },
                order: 0
            });
        const flow = builder
            .withStoreInject("p170T3Inj", "p170T3Store", [PEOPLE[1], PEOPLE[0]])
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p170T3App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab")).toHaveText([/Ada/, /Linus/]);

        await injectMessage(request, "p170T3Inj");
        // reordered: Linus before Ada; both keyed ids still present (stable).
        await expect(page.locator("sl-tab")).toHaveText([/Linus/, /Ada/], { timeout: 5000 });
        await expect(page.locator("sl-tab[panel='ada#p170T3Tab']")).toBeAttached();
        await expect(page.locator("sl-tab[panel='lin#p170T3Tab']")).toBeAttached();
    });

    // ─── ui-accordion: a ui-repeat of ui-accordion-section → one section/row ──

    test("S01 — a ui-repeat of ui-accordion-section renders one keyed section per store row", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p170S1App", root: "p170S1App" })
            .node("ui-store", { id: "p170S1Store", statePath: "people", initialValue: JSON.stringify(PEOPLE) })
            .node("ui-accordion", { id: "p170S1Acc" })
            .node("ui-repeat", {
                id: "p170S1Rep",
                mount: "ui-accordion:p170S1Acc/content",
                items: { kind: "state", path: "people" },
                keyField: "id"
            })
            .node("ui-accordion-section", {
                id: "p170S1Sec",
                mount: "container:p170S1Rep/content",
                label: { kind: "item", path: "name" },
                order: 0
            })
            .node("ui-text", {
                id: "p170S1Body",
                mount: "ui-accordion-section:p170S1Sec/content",
                value: { kind: "item", path: "bio" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p170S1App");
        await webapp.navigate("/");

        await expect(page.locator("sl-details")).toHaveCount(2);
        await expect(page.locator("sl-details[name='ada#p170S1Sec']")).toHaveAttribute("summary", "Ada");
        await expect(page.locator("sl-details[name='lin#p170S1Sec']")).toHaveAttribute("summary", "Linus");

        // content resolves against the row scope; first section open by default.
        await expect(page.locator("sl-details[name='ada#p170S1Sec']")).toContainText("Analyst");
        await expect(page.locator("sl-details[name='ada#p170S1Sec']")).toHaveAttribute("open", "");
    });

    test("S02 — removing a row removes its section; survivors keep their ids", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "p170S2App", root: "p170S2App" })
            .node("ui-store", { id: "p170S2Store", statePath: "people", initialValue: JSON.stringify(PEOPLE) })
            .node("ui-accordion", { id: "p170S2Acc" })
            .node("ui-repeat", {
                id: "p170S2Rep",
                mount: "ui-accordion:p170S2Acc/content",
                items: { kind: "state", path: "people" },
                keyField: "id"
            })
            .node("ui-accordion-section", {
                id: "p170S2Sec",
                mount: "container:p170S2Rep/content",
                label: { kind: "item", path: "name" },
                order: 0
            });
        const flow = builder
            .withStoreInject("p170S2Inj", "p170S2Store", [PEOPLE[0]])
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p170S2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-details")).toHaveCount(2);

        await injectMessage(request, "p170S2Inj");
        await expect(page.locator("sl-details")).toHaveCount(1, { timeout: 5000 });
        // the survivor keeps its keyed id; the removed section is gone.
        await expect(page.locator("sl-details[name='ada#p170S2Sec']")).toBeAttached();
        await expect(page.locator("sl-details[name='lin#p170S2Sec']")).toHaveCount(0);
    });
});
