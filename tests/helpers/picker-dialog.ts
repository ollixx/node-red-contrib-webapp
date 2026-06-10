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
