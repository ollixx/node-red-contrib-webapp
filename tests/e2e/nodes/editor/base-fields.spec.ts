import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P139 (ADR 0015) — the common base-field foundation: `installBaseFields()`.
 *
 * The shared helper renders the grouped base-field section ("General") with
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

    test("ui-divider — base-field group with 'General' heading is injected", async ({ page, request }) => {
        await openDividerPanel(page, request);

        // Exactly one injected base-field group (idempotent injection).
        await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);

        // Its own heading, "General" (P272: en-US shared strings).
        const heading = page.locator('[data-group-heading="base-fields"]');
        await expect(heading).toHaveCount(1);
        await expect(heading).toHaveText("General");
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
        // P272: the hint resolves from the pilot's own catalog (ui-divider.hints.disabled) — en-US text under the default editor language.
        const hint = "A divider has no interactive state.";
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

    test("ui-divider — 'Advanced' is collapsed by default and toggles open/closed", async ({ page, request }) => {
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
        await expect(sizeRow.locator("[data-base-field-hint]")).toHaveText("A divider has no size steps.");

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

    test("ui-list — base-field group with 'General' heading is injected", async ({ page, request }) => {
        await openListPanel(page, request);

        await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);

        const heading = page.locator('[data-group-heading="base-fields"]');
        await expect(heading).toHaveCount(1);
        await expect(heading).toHaveText("General");
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
 * ui-alert — base fields retrofitted (the `visible` field was missing entirely).
 * `visible` applicable (boolean-state typedInput); disabled/color/size N/A
 * (colour comes from `severity`, an alert has no interactive/size state).
 */

test.describe("editor panels — ui-alert base fields", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openAlertPanel(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const nodeId = "alert-bf";
        const flow = new FlowBuilder()
            .app({ id: "bfAlertApp", root: "bfAlertApp", name: "Base Fields Alert App" })
            .node("ui-alert", { id: nodeId })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    test("ui-alert — base-field group with 'General' heading is injected", async ({ page, request }) => {
        await openAlertPanel(page, request);

        await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);
        const heading = page.locator('[data-group-heading="base-fields"]');
        await expect(heading).toHaveText("General");
        for (const field of ["visible", "disabled", "color", "size"]) {
            await expect(
                page.locator(`[data-base-field="${field}"]`),
                `expected base-field row for ${field}`
            ).toHaveCount(1);
        }
    });

    test("ui-alert — visible (applicable) is a boolean-state typedInput", async ({ page, request }) => {
        await openAlertPanel(page, request);

        const row = page.locator('[data-base-field="visible"]');
        await expect(row).toBeVisible();
        await expect(row).not.toHaveAttribute("data-base-field-na", "true");
        await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        await expect(page.locator("#node-input-visibleBinding")).toHaveCount(1);
    });

    test("ui-alert — color is N/A (colour comes from severity)", async ({ page, request }) => {
        await openAlertPanel(page, request);

        const row = page.locator('[data-base-field="color"]');
        await expect(row).toHaveAttribute("data-base-field-na", "true");
        await expect(row.locator("[data-base-field-hint]")).toContainText("Severity");
    });

    test("ui-alert — visible binding round-trips through save", async ({ page, request }) => {
        const { editor, nodeId } = await openAlertPanel(page, request);

        // Bind visibility to a reactive expression, save, reopen — the binding
        // must survive (this is the whole point: `visible` is now persistable).
        await editor.fillTypedInput("visibleBinding", "state.showAlert", "reactive");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? n.visible : null;
        }, nodeId);
        expect(stored).toEqual({ kind: "reactive", value: "state.showAlert" });

        await editor.openNode(nodeId);
        expect(await editor.readTypedInputType("visibleBinding")).toBe("reactive");
        expect(await editor.readTypedInput("visibleBinding")).toBe("state.showAlert");
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

    test("save-semantics: setting visible=true on a fresh node stores null or literal-true (both = visible)", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        // Set visible to true (the field's neutral) via the typedInput.
        await editor.fillTypedInput("visibleBinding", "true", "bool");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible } : null;
        }, nodeId);

        // P202 (ADR 0026): `visible`'s neutral is `true`. An originally-empty field
        // still carrying its neutral may collapse to null OR persist literal-true —
        // both mean "visible". (Contrast the deliberate `false` case below, which
        // must NOT be swallowed.)
        expect(
            stored?.visible === null ||
                JSON.stringify(stored?.visible) === JSON.stringify({ kind: "literal", value: true })
        ).toBe(true);
    });
});

/**
 * P202 (ADR 0026, corrects P181) — a boolean-state base field's neutral value is
 * its OWN semantic default (visible→true, disabled→false), not a blanket `false`.
 * Two consequences P181 got wrong on `visible`:
 *   1. empty display: an unbound `visible` must READ `true` (shown), not `false`;
 *   2. swallowed deliberate false: `visible=false` on a fresh node must persist
 *      `{kind:literal,value:false}` (and actually hide the node), not collapse to null.
 * `disabled` behaviour is unchanged (its neutral was already `false`).
 */
test.describe("editor panels — P202: per-field neutral (visible→true, disabled→false)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openFreshListPanel(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const nodeId = "list-p202";
        const flow = new FlowBuilder()
            .app({ id: "p202App", root: "p202App", name: "P202 App" })
            .node("ui-list", { id: nodeId, items: [], visible: null, disabled: null })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    test("empty visible field displays 'true' (neutral = shown), disabled stays 'false'", async ({ page, request }) => {
        const { editor } = await openFreshListPanel(page, request);

        // The bool control must show the field's per-field neutral, not blanket false.
        expect(await editor.readTypedInput("visibleBinding")).toBe("true");
        expect(await editor.readTypedInput("disabledBinding")).toBe("false");
    });

    test("deliberate visible=false persists {kind:literal,value:false} (NOT swallowed to null)", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        await editor.fillTypedInput("visibleBinding", "false", "bool");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible } : null;
        }, nodeId);

        // The owner-found defect: a deliberate false must survive and hide the node.
        expect(stored?.visible).toEqual({ kind: "literal", value: false });
    });

    test("deliberate disabled=true persists {kind:literal,value:true}", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        await editor.fillTypedInput("disabledBinding", "true", "bool");
        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { disabled: n.disabled } : null;
        }, nodeId);

        expect(stored?.disabled).toEqual({ kind: "literal", value: true });
    });

    test("untouched empty visible/disabled still round-trip to null (P181 invariant preserved)", async ({ page, request }) => {
        const { editor, nodeId } = await openFreshListPanel(page, request);

        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible, disabled: n.disabled } : null;
        }, nodeId);

        expect(stored?.visible).toBeNull();
        expect(stored?.disabled).toBeNull();
    });

    test("a stored non-literal visible binding (state) re-opens in its own type and passes through on save", async ({ page, request }) => {
        const nodeId = "list-p202-state";
        const flow = new FlowBuilder()
            .app({ id: "p202StateApp", root: "p202StateApp", name: "P202 State App" })
            .node("ui-list", {
                id: nodeId,
                items: [],
                visible: { kind: "state", path: "showList" },
                disabled: null
            })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);

        // Re-opens in the 'state' type (not coerced to bool), carrying its path.
        expect(await editor.readTypedInputType("visibleBinding")).toBe("state");

        await editor.save();

        const stored = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n ? { visible: n.visible } : null;
        }, nodeId);

        expect(stored?.visible).toEqual({ kind: "state", path: "showList" });
    });
});

/**
 * P222 (ADR 0015) — the base-field rollout COMPLETION, driven data-first from the
 * applicability table in docs/nodes/concepts/editor.md. For every View node that
 * P222 retrofitted, the ONE matrix below asserts, in the live editor:
 *   1. the shared "General" base-field group is injected;
 *   2. each of visible/disabled/color/size is `active` / `na` (greyed + hint) /
 *      `omit` (not rendered — the node owns its own control) exactly per the table;
 *   3. the node's headline base field round-trips open→save (ADR 0031) — `visible`
 *      for all but ui-empty-state (which owns visible via a required Visible-Path,
 *      so its headline binding is `color`).
 *
 * This is deliberately ONE parametrised matrix, not 26 hand-copied describe blocks:
 * the applicability table is the single source of truth and the matrix follows it.
 */

type BaseFieldState = "active" | "na" | "omit";

interface BaseFieldMatrixRow {
    type: string;
    visible: BaseFieldState;
    disabled: BaseFieldState;
    color: BaseFieldState;
    size: BaseFieldState;
    /** The headline reference/binding base field to round-trip open→save. */
    roundTrip: "visible" | "color";
}

// Mirrors docs/nodes/concepts/editor.md → "Rollout-Status und Anwendbarkeits-Audit".
const BASE_FIELD_MATRIX: BaseFieldMatrixRow[] = [
    // input — disabled owned inline (P122–P130), color N/A (form field), size owned/absent.
    { type: "ui-input", visible: "active", disabled: "omit", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-textarea", visible: "active", disabled: "omit", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-select", visible: "active", disabled: "omit", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-checkbox", visible: "active", disabled: "omit", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-radio", visible: "active", disabled: "omit", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-switch", visible: "active", disabled: "omit", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-slider", visible: "active", disabled: "omit", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-datepicker", visible: "active", disabled: "omit", color: "na", size: "na", roundTrip: "visible" },
    // display
    { type: "ui-button", visible: "active", disabled: "omit", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-text", visible: "active", disabled: "na", color: "na", size: "omit", roundTrip: "visible" },
    { type: "ui-avatar", visible: "active", disabled: "na", color: "active", size: "omit", roundTrip: "visible" },
    // P238 (ADR 0039 §4): `color` is ACTIVE — ui-icon dropped its `omit:["color"]`
    // opt-out and its plain-string schema override, and now uses the shared
    // standard control (theme token / colour selector / any binding kind) like
    // every other colour-capable node. `size` keeps its own xs..xl control.
    { type: "ui-icon", visible: "active", disabled: "na", color: "active", size: "omit", roundTrip: "visible" },
    { type: "ui-image", visible: "active", disabled: "na", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-container", visible: "active", disabled: "na", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-table", visible: "active", disabled: "active", color: "active", size: "na", roundTrip: "visible" },
    // feedback
    { type: "ui-badge", visible: "active", disabled: "na", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-progress", visible: "active", disabled: "na", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-log", visible: "active", disabled: "na", color: "na", size: "na", roundTrip: "visible" },
    { type: "ui-empty-state", visible: "omit", disabled: "na", color: "active", size: "na", roundTrip: "color" },
    { type: "ui-toast", visible: "active", disabled: "na", color: "na", size: "na", roundTrip: "visible" },
    // navigation
    { type: "ui-accordion", visible: "active", disabled: "active", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-breadcrumb", visible: "active", disabled: "na", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-menu", visible: "active", disabled: "active", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-pagination", visible: "active", disabled: "active", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-stepper", visible: "active", disabled: "na", color: "active", size: "na", roundTrip: "visible" },
    { type: "ui-tabs", visible: "active", disabled: "active", color: "active", size: "na", roundTrip: "visible" },
];

test.describe("editor panels — P222 base-field rollout matrix (ADR 0015)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function assertFieldState(
        page: import("@playwright/test").Page,
        field: string,
        state: BaseFieldState
    ) {
        // Scope every base-field assertion to the injected group so a node's own
        // (non-base) control for the same concept — e.g. a form node's inline
        // Disabled row — never satisfies or breaks the check.
        const row = page.locator(`[data-field-group="base-fields"] [data-base-field="${field}"]`);
        if (state === "omit") {
            await expect(row, `${field} must be omitted from the base group`).toHaveCount(0);
            return;
        }
        await expect(row, `${field} row must be present`).toHaveCount(1);
        if (state === "na") {
            await expect(row).toHaveAttribute("data-base-field-na", "true");
            // A non-applicable field carries a visible hint (text + row tooltip).
            await expect(row.locator("[data-base-field-hint]")).toHaveCount(1);
        } else {
            await expect(row).not.toHaveAttribute("data-base-field-na", "true");
            // An applicable base field is an initialised typedInput — its carrier
            // control is active (not greyed), so the typedInput container exists.
            await expect(row.locator(".red-ui-typedInput-container")).toHaveCount(1);
        }
    }

    for (const row of BASE_FIELD_MATRIX) {
        test(`${row.type} — base-field group matches the applicability table + headline round-trip`, async ({ page, request }) => {
            const nodeId = `${row.type}-p222`;
            const flow = new FlowBuilder()
                .app({ id: `${row.type}App`, root: `${row.type}App`, name: `${row.type} P222` })
                .node(row.type, { id: nodeId })
                .build();
            await deployFlow(request, flow);

            const editor = new NodeEditorPage(page);
            await editor.open();
            await editor.openNode(nodeId);

            // 1. The shared "General" base-field group is injected exactly once.
            await expect(page.locator('[data-field-group="base-fields"]')).toHaveCount(1);
            await expect(page.locator('[data-group-heading="base-fields"]')).toHaveText("General");

            // 2. Each base field is active / N/A / omitted per the table.
            await assertFieldState(page, "visible", row.visible);
            await assertFieldState(page, "disabled", row.disabled);
            await assertFieldState(page, "color", row.color);
            await assertFieldState(page, "size", row.size);

            // 3. Headline base field round-trips open→save (ADR 0031).
            if (row.roundTrip === "visible") {
                await editor.fillTypedInput("visibleBinding", "state.p222Visible", "reactive");
                await editor.save();
                const stored = await page.evaluate((id) => {
                    const n = (window as unknown as {
                        RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
                    }).RED.nodes.node(id);
                    return n ? n.visible : null;
                }, nodeId);
                expect(stored).toEqual({ kind: "reactive", value: "state.p222Visible" });

                await editor.openNode(nodeId);
                expect(await editor.readTypedInputType("visibleBinding")).toBe("reactive");
                expect(await editor.readTypedInput("visibleBinding")).toBe("state.p222Visible");
            } else {
                await editor.fillTypedInput("colorBinding", "#abcdef", "str");
                await editor.save();
                const stored = await page.evaluate((id) => {
                    const n = (window as unknown as {
                        RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
                    }).RED.nodes.node(id);
                    return n ? n.color : null;
                }, nodeId);
                expect(stored).toEqual({ kind: "literal", value: "#abcdef" });

                await editor.openNode(nodeId);
                expect(await editor.readTypedInputType("colorBinding")).toBe("str");
                expect(await editor.readTypedInput("colorBinding")).toBe("#abcdef");
            }
        });
    }
});
