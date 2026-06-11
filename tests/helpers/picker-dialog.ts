import { expect, type Page } from "@playwright/test";

/**
 * Picker-dialog test helpers (P114 / ADR 0009).
 *
 * Every reference field (parent, routeId, action, store, mount) is now the
 * dialog-only pattern: the bound `#node-input-<field>` is HIDDEN and a read-only
 * display + an "Auswählen…" button sit next to it inside a `.webapp-picker-field`
 * wrapper. There is no visible reference `<select>` anywhere anymore, so specs
 * can no longer `selectOption()` these fields — they must drive the dialog.
 *
 * These helpers are the single "choose a reference via the dialog" primitive the
 * rewritten editor specs share.
 */

/** The wrapper a field's picker control lives in. */
export function pickerFieldWrapper(page: Page, fieldId: string) {
    return page.locator(`#node-input-${fieldId}`).locator("xpath=following-sibling::span[contains(@class,'webapp-picker-field')]");
}

/** The read-only display text element for a picker field. */
export function pickerFieldDisplay(page: Page, fieldId: string) {
    return pickerFieldWrapper(page, fieldId).locator(".webapp-picker-field-display");
}

/** The "Auswählen…" button for a picker field. */
export function pickerFieldButton(page: Page, fieldId: string) {
    return pickerFieldWrapper(page, fieldId).locator(".webapp-picker-field-button");
}

/** The "×" clear button for a clearable picker field (may be absent). */
export function pickerFieldClear(page: Page, fieldId: string) {
    return pickerFieldWrapper(page, fieldId).locator(".webapp-picker-field-clear");
}

/** Open the picker dialog for `#node-input-<fieldId>` and wait for it to show. */
export async function openPicker(page: Page, fieldId: string): Promise<void> {
    await pickerFieldButton(page, fieldId).click();
    await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
}

/**
 * Choose a reference for `#node-input-<fieldId>` through the dialog: open it,
 * (optionally) type a search query, then click the matching row. Resolves once
 * the dialog has closed and the hidden value carrier holds `expectValue` (when
 * given) so the caller can chain a save without a race.
 */
export async function pickReference(
    page: Page,
    fieldId: string,
    options: { search?: string; rowText?: string; rowIndex?: number; expectValue?: string }
): Promise<void> {
    await openPicker(page, fieldId);

    if (options.search !== undefined) {
        await page.locator(".webapp-node-picker-search").fill(options.search);
    }

    const rows = page.locator(".webapp-node-picker-row");
    let row = rows.first();
    if (options.rowText !== undefined) {
        row = rows.filter({ hasText: options.rowText }).first();
    } else if (options.rowIndex !== undefined) {
        row = rows.nth(options.rowIndex);
    }
    await row.click();

    await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);
    if (options.expectValue !== undefined) {
        await expect(page.locator(`#node-input-${fieldId}`)).toHaveValue(options.expectValue);
    }
}

/** Read the hidden value carrier of a picker field. */
export async function pickerFieldValue(page: Page, fieldId: string): Promise<string> {
    return page.locator(`#node-input-${fieldId}`).inputValue();
}

/**
 * P135 / ADR 0014 — the `mounts` picker is a two-column tree. Open it, click the
 * left-column tree node carrying `nodeText` (a branch label), then click the
 * right-column slot row carrying `slotText` (the slot name). Resolves once the
 * dialog has closed and (when given) the hidden carrier holds `expectValue`.
 *
 * If the tree node is collapsed, its ancestors are expanded by clicking their
 * twisties first via `expandPath` labels (parent → … order).
 */
export async function pickMountInTree(
    page: Page,
    fieldId: string,
    options: { nodeText: string; slotText: string; expectValue?: string; expandPath?: string[] }
): Promise<void> {
    await openPicker(page, fieldId);
    await expect(page.locator(".webapp-node-picker-dialog-tree")).toBeVisible();

    // A tree node's label is identified by its OWN text (`.tree-text`), not by a
    // descendant — an ancestor node also "has" a child's text, so we target the
    // label whose direct text span matches exactly.
    function labelFor(text: string) {
        return page
            .locator(".webapp-node-picker-tree-label")
            .filter({ has: page.locator(`.webapp-node-picker-tree-text:text-is("${text}")`) })
            .first();
    }

    for (const branch of options.expandPath ?? []) {
        // Click the twisty to expand children (does not change the selection).
        await labelFor(branch).locator(".webapp-node-picker-twisty").click();
    }

    await labelFor(options.nodeText).click();

    const slot = page
        .locator(".webapp-node-picker-slots .webapp-node-picker-slot-row")
        .filter({ hasText: options.slotText })
        .first();
    await slot.click();

    await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);
    if (options.expectValue !== undefined) {
        await expect(page.locator(`#node-input-${fieldId}`)).toHaveValue(options.expectValue);
    }
}
