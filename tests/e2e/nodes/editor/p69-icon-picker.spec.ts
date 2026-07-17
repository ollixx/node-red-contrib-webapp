import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P69 — icon picker dialog.
 *
 * The icon field on ui-icon / ui-button / ui-avatar is enhanced with an
 * "Icon wählen…" button that opens a picker dialog (P68 chrome) showing a
 * preview grid, a contains-search over the icon name and a library filter.
 * Picking a tile writes the value back into the text field; the value
 * round-trips through save. The dialog's icon names come from the server icon
 * manifest (GET /webapp/icons/manifest).
 */

test.describe("editor — icon picker dialog (P69)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the icon manifest endpoint lists the default library with names", async ({ request }) => {
        const res = await request.get("/webapp/icons/manifest");
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(Array.isArray(body.libraries)).toBe(true);
        const def = body.libraries.find((l: { name: string }) => l.name === "default");
        expect(def).toBeDefined();
        expect(def.icons.length).toBeGreaterThan(1000);
        expect(def.icons).toContain("house");
    });

    test("the icon field has a picker button; the dialog searches and selects", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp", root: "iconApp", name: "Icon App" })
            .node("ui-icon", { id: "icon1", name: "My Icon", icon: "star" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("icon1");

        // The picker button is injected next to the icon text field.
        const iconButton = page.locator(".webapp-icon-field-button");
        await expect(iconButton).toHaveCount(1);

        await iconButton.click();
        const dialog = page.locator(".webapp-icon-picker-dialog");
        await expect(dialog).toBeVisible();

        // Library filter is populated with at least the default library.
        const libOptions = page.locator(".webapp-icon-picker-lib option");
        await expect(libOptions.filter({ hasText: "default" })).toHaveCount(1);

        // Contains-search over the icon name narrows the grid.
        const search = page.locator(".webapp-icon-picker-search");
        await search.fill("house");
        const tiles = page.locator(".webapp-icon-picker-tile");
        await expect(tiles.first()).toBeVisible();
        // Every visible tile name contains the query.
        const names = await tiles.evaluateAll((els) =>
            els.map((e) => (e as HTMLElement).getAttribute("data-icon-name") || "")
        );
        expect(names.length).toBeGreaterThan(0);
        expect(names.every((n) => n.includes("house"))).toBe(true);

        // Pick the exact "house" tile.
        await page.locator(".webapp-icon-picker-tile[data-icon-name=\"house\"]").first().click();

        // Dialog closed; the field now holds the picked value.
        // P239: on ui-icon the control is a typedInput on the `iconBinding` carrier
        // (the persisted `icon` may be a binding object, so it must not have a
        // #node-input-icon element — see ui-icon.html). The picker still writes a
        // plain literal into the field's value.
        await expect(dialog).toHaveCount(0);
        const picked = await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (k: string) => string } }).$;
            const field = $("#node-input-iconBinding");
            return { type: field.typedInput("type"), value: field.typedInput("value") };
        });
        expect(picked).toEqual({ type: "icon", value: "house" });

        // Save — the value round-trips onto the node config.
        await editor.save();
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("icon1");
            return n ? n.icon : null;
        });
        expect(saved).toBe("house");
    });

    test("the library filter restricts the grid to a single library", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp2", root: "iconApp2", name: "Icon App 2" })
            .node("ui-button", { id: "btn1", name: "Add", label: "Add" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("btn1");

        await page.locator(".webapp-icon-field-button").click();
        await expect(page.locator(".webapp-icon-picker-dialog")).toBeVisible();

        // Filter to the default library and search; tiles all belong to default.
        await page.locator(".webapp-icon-picker-lib").selectOption("default");
        await page.locator(".webapp-icon-picker-search").fill("gear");
        const tiles = page.locator(".webapp-icon-picker-tile");
        await expect(tiles.first()).toBeVisible();
        const libs = await tiles.evaluateAll((els) =>
            els.map((e) => (e as HTMLElement).getAttribute("data-icon-library") || "")
        );
        expect(libs.every((l) => l === "default")).toBe(true);
    });
});
