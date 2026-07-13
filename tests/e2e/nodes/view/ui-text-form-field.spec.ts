import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P221 (ADR 0035) — ui-text read-only FORM-FIELD presentation mode.
 *
 * These specs prove the acceptance by MEASUREMENT, not by class asserts
 * (memory: verify-rendering-by-measurement-not-tags):
 *   - A `ui-text` in `display: "formField"` mode renders the same <sl-input>
 *     control chrome as an adjacent `ui-input`, so the label column x and the
 *     value cell x LINE UP (bounding-box comparison of the Shoelace shadow
 *     parts `form-control-label` / `form-control-input`).
 *   - It is READ-ONLY: the sl-input carries `readonly`, has no `name`, and no
 *     `data-webapp-source` change plumbing (→ no value emission).
 *   - A set bound value shows; an empty bound value (ADR 0032: a missing store
 *     key) renders an EMPTY value cell (never "?"), label still visible.
 */

/**
 * Read the on-screen geometry of a Shoelace sl-input's label + input parts.
 * Returned in viewport pixels so two controls can be compared axis-by-axis.
 */
async function measureSlInput(page: import("@playwright/test").Page, selector: string) {
    return page.evaluate((sel) => {
        const host = document.querySelector(sel) as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
        if (!host || !host.shadowRoot) {
            return null;
        }
        const label = host.shadowRoot.querySelector('[part~="form-control-label"]') as HTMLElement | null;
        const input = host.shadowRoot.querySelector('[part~="form-control-input"]') as HTMLElement | null;
        const rect = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null);
        return {
            host: rect(host),
            label: rect(label),
            input: rect(input),
            value: (host as unknown as { value: string }).value,
            readonly: host.hasAttribute("readonly"),
            hasName: host.hasAttribute("name"),
            hasSource: host.hasAttribute("data-webapp-source")
        };
    }, selector);
}

test.describe("ui-text form-field mode (P221)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("formField ui-text aligns with an adjacent ui-input (same label/value axes)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ftApp1", root: "ftApp1" })
            // An editable control...
            .node("ui-input", { id: "nameInput", label: "Name", value: { kind: "literal", value: "Ada" } })
            // ...and a read-only labelled value beneath it.
            .node("ui-text", {
                id: "idField",
                display: "formField",
                label: "Entity ID",
                value: { kind: "literal", value: "abc-123" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ftApp1");
        await webapp.navigate("/");

        // Both controls render as sl-input. The form-field text carries our marker
        // class + is the leaf itself (no wrapper); the input has a `name`.
        const fieldSel = "sl-input.webapp-text-field";
        const inputSel = 'sl-input[name]';
        await expect(page.locator(fieldSel)).toBeVisible();
        await expect(page.locator(inputSel)).toBeVisible();

        const field = await measureSlInput(page, fieldSel);
        const input = await measureSlInput(page, inputSel);
        expect(field).not.toBeNull();
        expect(input).not.toBeNull();
        expect(field!.label).not.toBeNull();
        expect(input!.label).not.toBeNull();
        expect(field!.input).not.toBeNull();
        expect(input!.input).not.toBeNull();

        // Same LABEL column: the label part starts at the same x.
        expect(Math.abs(field!.label!.left - input!.label!.left)).toBeLessThanOrEqual(1.5);
        // Same VALUE cell: the input part starts at the same x and has the same width.
        expect(Math.abs(field!.input!.left - input!.input!.left)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(field!.input!.width - input!.input!.width)).toBeLessThanOrEqual(2);
        // Same field footprint (control optics match).
        expect(Math.abs(field!.host!.width - input!.host!.width)).toBeLessThanOrEqual(2);

        // The bound value is shown.
        expect(field!.value).toBe("abc-123");
    });

    test("formField mode is read-only: readonly, no name, no change-emission plumbing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ftApp2", root: "ftApp2" })
            .node("ui-text", {
                id: "roField",
                display: "formField",
                label: "ID",
                value: { kind: "literal", value: "xyz" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ftApp2");
        await webapp.navigate("/");

        const m = await measureSlInput(page, "sl-input.webapp-text-field");
        expect(m).not.toBeNull();
        expect(m!.readonly).toBe(true);
        // No name → not a form value; no data-webapp-source → no change event emitted.
        expect(m!.hasName).toBe(false);
        expect(m!.hasSource).toBe(false);
        expect(m!.value).toBe("xyz");
    });

    test("empty bound value renders an empty value cell (no '?'), label stays visible (ADR 0032)", async ({ page, request }) => {
        // A store initialised WITHOUT `_id`; the form-field binds store:_id, so the
        // value is a missing object key → empty (ADR 0032), never "?".
        const flow = new FlowBuilder()
            .app({ id: "ftApp3", root: "ftApp3" })
            .node("ui-store", {
                id: "entityStore",
                statePath: "entity",
                initialValue: "{\"name\":\"Eine Entität\"}"
            })
            .node("ui-text", {
                id: "idFieldEmpty",
                display: "formField",
                label: "Entity ID",
                value: { kind: "store", path: "entityStore", subPath: { kind: "literal", value: "_id" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ftApp3");
        await webapp.navigate("/");

        const m = await measureSlInput(page, "sl-input.webapp-text-field");
        expect(m).not.toBeNull();
        // Empty value, NOT the "?" marker.
        expect(m!.value).toBe("");
        // The label is still there.
        expect(m!.label).not.toBeNull();
        const labelText = await page.locator("sl-input.webapp-text-field").getAttribute("label");
        expect(labelText).toBe("Entity ID");
    });
});
