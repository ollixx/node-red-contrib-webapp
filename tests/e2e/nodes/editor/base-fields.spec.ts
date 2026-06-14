import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P139 (ADR 0015) — the common base-field foundation: `installBaseFields()`.
 *
 * The shared helper renders the grouped base-field section ("Allgemein") with
 * visible/disabled/color/size, N/A-disable-with-hint, and the optional
 * collapsible "Erweitert" subsection. The per-node rollout is OUT of scope —
 * the helper is proven on ONE reference node: **ui-divider** (non-variant, so
 * `color` is active; non-interactive, so `disabled` is the N/A showcase; no
 * size steps, so `size` is the rarely-used N/A field inside "Erweitert").
 */

test.describe("editor panels — common base fields (P139, ADR 0015)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openDividerPanel(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const nodeId = "divider-bf";
        const flow = new FlowBuilder()
            .app({ id: "bfApp", root: "bfApp", name: "Base Fields App" })
            .node("ui-divider", { id: nodeId })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    test("ui-divider — base-field group with 'Allgemein' heading is injected", async ({ page, request }) => {
        await openDividerPanel(page, request);

        // Exactly one injected base-field group (idempotent injection).
        await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);

        // Its own heading, "Allgemein".
        const heading = page.locator('[data-group-heading="base-fields"]');
        await expect(heading).toHaveCount(1);
        await expect(heading).toHaveText("Allgemein");
        await expect(heading).toBeVisible();

        // All four base fields are rendered (applicable or N/A — always shown).
        for (const field of ["visible", "disabled", "color", "size"]) {
            await expect(
                page.locator(`[data-base-field="${field}"]`),
                `expected base-field row for ${field}`
            ).toHaveCount(1);
        }
    });

    test("ui-divider — visible (applicable) is a boolean-state typedInput, shown by default", async ({ page, request }) => {
        await openDividerPanel(page, request);

        const row = page.locator('[data-base-field="visible"]');
        await expect(row).toBeVisible();
        // typedInput initialised on the carrier input → the typedInput container exists.
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-visibleBinding")).toHaveCount(1);
    });

    test("ui-divider — disabled is N/A: shown, greyed out, with the configured hint", async ({ page, request }) => {
        await openDividerPanel(page, request);

        const row = page.locator('[data-base-field="disabled"]');
        await expect(row).toBeVisible();
        await expect(row).toHaveAttribute("data-base-field-na", "true");

        // The control is disabled (no typedInput is initialised on an N/A field).
        await expect(row.locator("#node-input-disabledBinding")).toBeDisabled();

        // The node-local hint is visible AND available as a title tooltip.
        const hint = "Ein Trenner hat keinen interaktiven Zustand.";
        await expect(row.locator("[data-base-field-hint]")).toHaveText(hint);
        await expect(row).toHaveAttribute("title", hint);
    });

    test("ui-divider — color (applicable, non-variant node) is an active value typedInput", async ({ page, request }) => {
        await openDividerPanel(page, request);

        const row = page.locator('[data-base-field="color"]');
        // color sits in the always-visible part of the group (not "Erweitert").
        await expect(row).toBeVisible();
        await expect(row).not.toHaveAttribute("data-base-field-na", "true");
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-colorBinding")).toHaveCount(1);
        await expect(row.locator("[data-base-field-hint]")).toHaveCount(0);
    });

    test("ui-divider — 'Erweitert' is collapsed by default and toggles open/closed", async ({ page, request }) => {
        await openDividerPanel(page, request);

        const toggle = page.locator("[data-base-advanced-toggle]");
        const section = page.locator("[data-base-advanced-section]");
        await expect(toggle).toHaveCount(1);

        // Collapsed by default — the rarely-used size field is inside it.
        await expect(section).toBeHidden();
        const sizeRow = page.locator('[data-base-field="size"]');
        await expect(sizeRow).toBeHidden();

        // Expand: the size row appears, N/A-disabled with its hint.
        await toggle.locator("a").click();
        await expect(section).toBeVisible();
        await expect(sizeRow).toBeVisible();
        await expect(sizeRow).toHaveAttribute("data-base-field-na", "true");
        await expect(sizeRow.locator("#node-input-size")).toBeDisabled();
        await expect(sizeRow.locator("[data-base-field-hint]")).toHaveText("Ein Trenner hat keine Größen-Stufen.");

        // Collapse again.
        await toggle.locator("a").click();
        await expect(section).toBeHidden();
    });

    test("ui-divider — color binding round-trips through save", async ({ page, request }) => {
        const { editor, nodeId } = await openDividerPanel(page, request);

        // Type a literal colour into the color typedInput.
        await editor.fillTypedInput("colorBinding", "#ff0000", "str");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { color: n.color, visible: n.visible } : null;
        }, nodeId);

        expect(stored?.color).toEqual({ kind: "literal", value: "#ff0000" });

        // Re-open: the typedInput restores the stored literal.
        await editor.openNode(nodeId);
        expect(await editor.readTypedInputType("colorBinding")).toBe("str");
        expect(await editor.readTypedInput("colorBinding")).toBe("#ff0000");
    });

    test("variant→color mutual exclusion — the resolver marks color N/A with the Variant hint (ADR 0015 §1)", async ({ page, request }) => {
        // The per-node rollout (variant nodes adopting installBaseFields) is out
        // of P139's scope, so the mutual-exclusion rule is exercised against the
        // shared resolver in the real editor runtime.
        await openDividerPanel(page, request);

        const result = await page.evaluate(() => {
            const common = (window as unknown as {
                WebappEditorCommon: {
                    resolveBaseFieldApplicability: (config: Record<string, unknown>) => Record<string, { applicable: boolean; hint: string }>;
                };
            }).WebappEditorCommon;
            return common.resolveBaseFieldApplicability({ color: true, variant: true });
        });

        expect(result.color.applicable).toBe(false);
        expect(result.color.hint).toContain("Variant");
    });
});

/**
 * P172 (ADR 0015) — ui-list: base fields retrofitted.
 * visible/disabled/color applicable; size N/A (displayType controls density).
 * Mirrors the ui-divider tests above but exercises the list-specific applicability.
 */

test.describe("editor panels — ui-list base fields (P172, ADR 0015)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openListPanel(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const nodeId = "list-bf";
        const flow = new FlowBuilder()
            .app({ id: "bfListApp", root: "bfListApp", name: "Base Fields List App" })
            .node("ui-list", { id: nodeId, items: [] })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    test("ui-list — base-field group with 'Allgemein' heading is injected", async ({ page, request }) => {
        await openListPanel(page, request);

        await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);

        const heading = page.locator('[data-group-heading="base-fields"]');
        await expect(heading).toHaveCount(1);
        await expect(heading).toHaveText("Allgemein");
        await expect(heading).toBeVisible();

        for (const field of ["visible", "disabled", "color", "size"]) {
            await expect(
                page.locator(`[data-base-field="${field}"]`),
                `expected base-field row for ${field}`
            ).toHaveCount(1);
        }
    });

    test("ui-list — visible (applicable) is a boolean-state typedInput", async ({ page, request }) => {
        await openListPanel(page, request);

        const row = page.locator('[data-base-field="visible"]');
        await expect(row).toBeVisible();
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-visibleBinding")).toHaveCount(1);
    });

    test("ui-list — disabled (applicable) is a boolean-state typedInput", async ({ page, request }) => {
        await openListPanel(page, request);

        const row = page.locator('[data-base-field="disabled"]');
        await expect(row).toBeVisible();
        // applicable → no N/A attribute
        await expect(row).not.toHaveAttribute("data-base-field-na", "true");
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-disabledBinding")).toHaveCount(1);
    });

    test("ui-list — color (applicable, non-variant) is an active value typedInput", async ({ page, request }) => {
        await openListPanel(page, request);

        const row = page.locator('[data-base-field="color"]');
        await expect(row).toBeVisible();
        await expect(row).not.toHaveAttribute("data-base-field-na", "true");
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-colorBinding")).toHaveCount(1);
    });

    test("ui-list — size is N/A (Erweitert) with displayType hint", async ({ page, request }) => {
        await openListPanel(page, request);

        const toggle = page.locator("[data-base-advanced-toggle]");
        const section = page.locator("[data-base-advanced-section]");

        // Collapsed by default.
        await expect(section).toBeHidden();

        await toggle.locator("a").click();
        await expect(section).toBeVisible();

        const sizeRow = page.locator('[data-base-field="size"]');
        await expect(sizeRow).toBeVisible();
        await expect(sizeRow).toHaveAttribute("data-base-field-na", "true");
        await expect(sizeRow.locator("#node-input-size")).toBeDisabled();
        await expect(sizeRow.locator("[data-base-field-hint]")).toContainText("Display-Typ");
    });

    test("ui-list — color binding round-trips through save", async ({ page, request }) => {
        const { editor, nodeId } = await openListPanel(page, request);

        await editor.fillTypedInput("colorBinding", "#aabbcc", "str");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { color: n.color, visible: n.visible } : null;
        }, nodeId);

        expect(stored?.color).toEqual({ kind: "literal", value: "#aabbcc" });

        await editor.openNode(nodeId);
        expect(await editor.readTypedInputType("colorBinding")).toBe("str");
        expect(await editor.readTypedInput("colorBinding")).toBe("#aabbcc");
    });
});

/**
 * P181 — empty visible/disabled must render a clean boolean typedInput (type
 * 'bool', no store fallback, no extra dropdown, no '…' expand button).
 * Tested on ui-list (uses installBaseFields) and ui-list visible field as the
 * canonical reference; also verifies save-semantics (untouched → null stored).
 */

test.describe("editor panels — P181: boolean default type for empty visible/disabled", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openFreshListPanel(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const nodeId = "list-p181";
        // Deploy a ui-list node with NO visible/disabled bindings set (both null).
        const flow = new FlowBuilder()
            .app({ id: "p181App", root: "p181App", name: "P181 App" })
            .node("ui-list", { id: nodeId, items: [], visible: null, disabled: null })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    test("empty visible field renders with type 'bool' (not 'str'/store fallback)", async ({ page, request }) => {
        await openFreshListPanel(page, request);

        // The typedInput type must be 'bool', not 'str' (which would fall back to store).
        const type = await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return $("#node-input-visibleBinding").typedInput("type");
        });
        expect(type).toBe("bool");
    });

    test("empty disabled field renders with type 'bool' (not 'str'/store fallback)", async ({ page, request }) => {
        await openFreshListPanel(page, request);

        const type = await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return $("#node-input-disabledBinding").typedInput("type");
        });
        expect(type).toBe("bool");
    });

    test("empty visible field shows exactly one type-selector button (no store expand '…')", async ({ page, request }) => {
        await openFreshListPanel(page, request);

        const row = page.locator('[data-base-field="visible"]');
        // The store type renders an expand button with class red-ui-typedInput-expand
        // and its icon shows '…'. A clean bool control must not have this button.
        await expect(row.locator(".red-ui-typedInput-expand")).toHaveCount(0);
        // Exactly one type-selector button (the dropdown arrow for the type list).
        await expect(row.locator(".red-ui-typedInput-type-select")).toHaveCount(1);
    });

    test("empty disabled field shows exactly one type-selector button (no store expand '…')", async ({ page, request }) => {
        await openFreshListPanel(page, request);

        const row = page.locator('[data-base-field="disabled"]');
        await expect(row.locator(".red-ui-typedInput-expand")).toHaveCount(0);
        await expect(row.locator(".red-ui-typedInput-type-select")).toHaveCount(1);
    });

    test("save-semantics: open + save without touching visible/disabled → stored values remain null", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        // Save immediately without touching visible or disabled.
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible, disabled: n.disabled } : null;
        }, nodeId);

        // Untouched boolean fields must not create a synthetic binding.
        expect(stored?.visible).toBeNull();
        expect(stored?.disabled).toBeNull();
    });

    test("save-semantics: explicitly setting visible=true stores a bool literal", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        // Explicitly set visible to true via the typedInput.
        await editor.fillTypedInput("visibleBinding", "true", "bool");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible } : null;
        }, nodeId);

        // An intentionally-set bool literal must be persisted.
        expect(stored?.visible).toEqual({ kind: "literal", value: true });
    });
});
