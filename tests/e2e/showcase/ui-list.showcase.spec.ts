/**
 * ui-list — Showcase spec (P187, ADR 0022 §2).
 *
 * Pilot showcase for the `ui-list` node: a feature tour that exercises all
 * major capabilities in named `test.step` chapters. Each step asserts a real
 * outcome (fails on regression) and is paced to produce a readable review
 * video under SHOWCASE=1 (P186).
 *
 * Features covered (per P187 acceptance criteria):
 *   - Item schema: plain string array, object form with label/value/icon.
 *   - displayType intents: plain, divided, grouped, actionable.
 *   - value display modes: none (default), secondary, badge.
 *   - Single-Select (selectable + selectedId).
 *   - Config-dialog cameo: editor fields visible on camera.
 *
 * See `tests/e2e/showcase/showcase-helpers.ts` for the pattern docs.
 */

import { expect, test } from "@playwright/test";

import { FlowBuilder, ShowcaseFlow, deployFlow, resetFlow } from "./showcase-helpers";

const FRUITS = [
    { id: "apple", label: "Apple", value: 3, icon: "apple" },
    { id: "banana", label: "Banana", value: 7, icon: "stars" },
    { id: "cherry", label: "Cherry", value: 12, icon: "heart" }
];

test.describe("ui-list showcase (P187)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-list feature tour", async ({ page, request }) => {
        const sf = new ShowcaseFlow(page, request);

        // ── Step 0: Deploy a comprehensive showcase flow ─────────────────────
        const flow = new FlowBuilder()
            .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
            .node("ui-store", {
                id: "listShowcaseStore",
                statePath: "selection",
                initialValue: JSON.stringify({ id: "apple" })
            })
            .node("ui-list", {
                id: "listShowcaseNode",
                items: { kind: "literal", value: FRUITS },
                displayValue: "badge",
                badgeVariant: "primary",
                displayType: "divided",
                selectable: true,
                selectedId: { kind: "state", path: "selection.id" },
                events: JSON.stringify(["itemClick", "itemSelect"])
            })
            .build();

        await sf.deploy(flow);
        const app = await sf.openApp("listShowcaseApp");
        const listRoot = page.locator("ul.webapp-list");
        const items = page.locator("ul.webapp-list li.webapp-list-item");

        // ── Step 1: String-array → plain list ────────────────────────────────
        await test.step("Step 1 — string items render as labelled rows", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: ["Ada Lovelace", "Alan Turing", "Grace Hopper"] }
                })
                .build());
            // Re-open: deploy updates the running app via the flow endpoint.
            await app.navigate("/");
            await expect(items).toHaveCount(3);
            await expect(items.nth(0)).toContainText("Ada Lovelace");
            await expect(items.nth(1)).toContainText("Alan Turing");
            await expect(items.nth(2)).toContainText("Grace Hopper");
        });

        // ── Step 2: displayType=divided ──────────────────────────────────────
        await test.step("Step 2 — displayType=divided adds separator class", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayType: "divided"
                })
                .build());
            await app.navigate("/");
            const divided = page.locator("ul.webapp-list.webapp-list--divided");
            await expect(divided).toBeVisible();
            await expect(items).toHaveCount(3);
        });

        // ── Step 3: displayType=grouped ──────────────────────────────────────
        await test.step("Step 3 — displayType=grouped adds grouped class", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayType: "grouped"
                })
                .build());
            await app.navigate("/");
            await expect(page.locator("ul.webapp-list.webapp-list--grouped")).toBeVisible();
            await expect(items).toHaveCount(3);
        });

        // ── Step 4: displayType=actionable ───────────────────────────────────
        await test.step("Step 4 — displayType=actionable + itemClick events", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayType: "actionable",
                    events: JSON.stringify(["itemClick"])
                })
                .build());
            await app.navigate("/");
            await expect(page.locator("ul.webapp-list.webapp-list--actionable")).toBeVisible();
            // Verify itemClick fires with correct params.
            const eventPromise = app.interceptNextEvent();
            await page.locator("ul.webapp-list li", { hasText: "Cherry" }).locator("a.webapp-link").click();
            const body = await eventPromise;
            expect(body.event).toBe("itemClick");
            const params = body.params as Record<string, unknown>;
            expect(params.rowId).toBe("cherry");
        });

        // ── Step 5: value (secondary) ────────────────────────────────────────
        await test.step("Step 5 — displayValue=secondary shows value as trailing text", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayValue: "secondary"
                })
                .build());
            await app.navigate("/");
            const secondaryValues = page.locator("ul.webapp-list li .webapp-list-value");
            await expect(secondaryValues).toHaveCount(3);
            await expect(secondaryValues.nth(0)).toContainText("3");
        });

        // ── Step 6: value (badge) ────────────────────────────────────────────
        await test.step("Step 6 — displayValue=badge renders sl-badge per item", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayValue: "badge",
                    badgeVariant: "warning"
                })
                .build());
            await app.navigate("/");
            const badges = page.locator("ul.webapp-list li sl-badge.webapp-list-value");
            await expect(badges).toHaveCount(3);
            await expect(badges.nth(0)).toContainText("3");
            await expect(badges.first()).toHaveAttribute("variant", "warning");
        });

        // ── Step 7: per-item icon ─────────────────────────────────────────────
        await test.step("Step 7 — per-item icon renders as leading sl-icon", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: [
                        { id: "i1", label: "Inbox", icon: "inbox", value: 5 },
                        { id: "i2", label: "Archive" }
                    ] },
                    displayValue: "badge",
                    badgeVariant: "primary"
                })
                .build());
            await app.navigate("/");
            const iconRow = page.locator("ul.webapp-list li.webapp-list-item").nth(0);
            await expect(iconRow.locator("sl-icon.webapp-list-item-icon")).toHaveCount(1);
            await expect(iconRow.locator("sl-icon.webapp-list-item-icon")).toHaveAttribute("name", "inbox");
            // Row without icon has no sl-icon.
            const noIconRow = page.locator("ul.webapp-list li.webapp-list-item").nth(1);
            await expect(noIconRow.locator("sl-icon.webapp-list-item-icon")).toHaveCount(0);
        });

        // ── Step 8: Single-Select ────────────────────────────────────────────
        await test.step("Step 8 — selectable=true + selectedId marks the matching row", async () => {
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-store", {
                    id: "listShowcaseStore",
                    statePath: "selection",
                    initialValue: JSON.stringify({ id: "banana" })
                })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    selectable: true,
                    selectedId: { kind: "state", path: "selection.id" }
                })
                .build());
            await app.navigate("/");
            await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(1);
            await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Banana");
        });

        // ── Step 9: Config-dialog cameo ───────────────────────────────────────
        // Open the Node-RED editor to show the ui-list config panel fields.
        await test.step("Step 9 — config dialog: items typedInput visible in editor", async () => {
            // Re-deploy a simple list so the node id is stable.
            await deployFlow(request, new FlowBuilder()
                .app({ id: "listShowcaseApp", root: "listShowcaseApp" })
                .node("ui-list", {
                    id: "listShowcaseNode",
                    items: { kind: "literal", value: FRUITS },
                    displayType: "divided",
                    displayValue: "badge",
                    badgeVariant: "primary",
                    selectable: true
                })
                .build());
            await sf.openEditor(["ui-list", "ui-app"]);
            await sf.openNodeConfig("listShowcaseNode");
            // The items typedInput carrier (#node-input-itemsBinding) must be present.
            // Note: the `items` binding object is persisted via oneditsave and has no
            // matching DOM input — the typedInput lives on #node-input-itemsBinding.
            await expect(page.locator("#node-input-itemsBinding")).toHaveCount(1);
            await sf.closeNodeConfig();
        });

        void listRoot; // referenced above; suppress unused-variable lint
    });
});
