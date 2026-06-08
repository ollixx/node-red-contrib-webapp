import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../helpers/admin-api";
import { FlowBuilder } from "../helpers/flow-builder";
import { NodeEditorPage } from "../helpers/node-editor-page";

/**
 * P71 — component fields. ui-button gains a size (sm/md/lg), an explicit outline
 * flag, and a link mode (button | url | navigate) with a binding-capable href.
 * The same three-step size token is offered on text/input/select/textarea. These
 * tests exercise the rendered output (sizes, outline, link modes) end to end and
 * the editor surfaces (size SelectBox, outline/link-mode/href fields).
 */

test.describe("P71: component fields — rendered output", () => {
    test.afterAll(async ({ request }) => {
        const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
        const baselineFlow = JSON.parse(await readFile(fixturePath, "utf8"));
        await request.post("/flows", { data: baselineFlow });
    });

    test("renders button size, outline and the three link modes", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p71App", root: "p71App", name: "P71 App" })
            .node("ui-button", { id: "p71Small", name: "Small", label: "Small", size: "sm" })
            .node("ui-button", { id: "p71Large", name: "Large", label: "Large", size: "lg" })
            .node("ui-button", { id: "p71Outline", name: "Outlined", label: "Outlined", outline: true })
            .node("ui-button", { id: "p71Plain", name: "Plain", label: "Plain" })
            .node("ui-button", { id: "p71Url", name: "Docs", label: "Docs", linkMode: "url", href: "https://example.com/docs" })
            .node("ui-button", { id: "p71Nav", name: "Home", label: "Home", linkMode: "navigate", href: "/somewhere" })
            .build();
        await deployFlow(request, flow);

        await page.goto("/webapp/p71App");

        const html = await page.content();

        // Size → Shoelace size attribute on the matching button.
        const small = page.locator('sl-button[data-webapp-source="p71Small"]');
        await expect(small).toHaveAttribute("size", "small");
        const large = page.locator('sl-button[data-webapp-source="p71Large"]');
        await expect(large).toHaveAttribute("size", "large");

        // Outline flag → boolean outline attribute (only on the outlined button).
        const outlined = page.locator('sl-button[data-webapp-source="p71Outline"]');
        await expect(outlined).toHaveJSProperty("outline", true);
        const plain = page.locator('sl-button[data-webapp-source="p71Plain"]');
        await expect(plain).toHaveJSProperty("outline", false);

        // URL mode → a real hyperlink via href (and NOT a click-dispatch source).
        expect(html).toContain('href="https://example.com/docs"');
        await expect(page.locator('sl-button[data-webapp-source="p71Url"]')).toHaveCount(0);

        // Navigate mode → data-webapp-navigate carries the route; still a source.
        const nav = page.locator('sl-button[data-webapp-source="p71Nav"]');
        await expect(nav).toHaveAttribute("data-webapp-navigate", "/somewhere");
    });

    test("renders the three-step size on an input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p71InputApp", root: "p71InputApp", name: "P71 Input App" })
            .node("ui-input", { id: "p71Input", name: "Sized", label: "Sized", size: "lg", value: { kind: "literal", value: "" } })
            .build();
        await deployFlow(request, flow);

        await page.goto("/webapp/p71InputApp");

        // The sized input surfaces the Shoelace size attribute (lg → large).
        await expect(page.locator('[size="large"]').first()).toBeVisible();
    });
});

test.describe("P71: editor fields", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-button editor exposes size, outline, link-mode and a conditional href field", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p71EditApp", root: "p71EditApp", name: "P71 Edit App" })
            .node("ui-button", { id: "p71EditBtn", name: "Edit", label: "Edit" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p71EditBtn");

        // Size SelectBox is present with the three-step vocabulary.
        await expect(page.locator("#node-input-size")).toHaveCount(1);
        await expect(page.locator('#node-input-size option[value="md"]')).toHaveCount(1);

        // Outline checkbox + link-mode select are present.
        await expect(page.locator("#node-input-outline")).toHaveCount(1);
        await expect(page.locator("#node-input-linkMode")).toHaveCount(1);

        // href row is hidden in the default "button" mode…
        const hrefRow = page.locator('[data-button-href-row="href"]');
        await expect(hrefRow).toBeHidden();

        // …and shown once the mode is switched to "url".
        await page.locator("#node-input-linkMode").selectOption("url");
        await expect(hrefRow).toBeVisible();

        // Set values and save — they round-trip onto the node config.
        await page.locator("#node-input-size").selectOption("lg");
        await page.locator("#node-input-href").fill("https://example.com");
        await editor.save();

        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("p71EditBtn");
            return n ? { size: n.size, linkMode: n.linkMode, href: n.href } : null;
        });
        expect(saved).toMatchObject({ size: "lg", linkMode: "url", href: "https://example.com" });
    });

    test("ui-text editor exposes the size SelectBox", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p71TextApp", root: "p71TextApp", name: "P71 Text App" })
            .node("ui-text", { id: "p71Text", name: "T", text: "Hi" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p71Text");

        await expect(page.locator("#node-input-size")).toHaveCount(1);
        await expect(page.locator('#node-input-size option[value="sm"]')).toHaveCount(1);
    });
});
