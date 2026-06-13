import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P132 + P134 (ADR 0013 §4) — the store-binding editor: name-in-value,
 * path-in-a-second-row. The store type is one type among many in the value
 * typedInput; when chosen, the value area shows the store NAME (not the id, no
 * "Store ändern" button, no "(bestehend)" for a live store) and the typedInput's
 * native "…" expand button (re-)opens the app-scoped picker. BELOW the name, a
 * second, indented sub-path typedInput carries the one-level `subPath` (the full
 * 11-source `storePath` set) with soft default-slice autocomplete.
 *
 * These are EDITOR specs: open a ui-text panel, drive the value typedInput's
 * `store` source, assert the two-row rendering and that
 * `{kind:"store", path, subPath}` round-trips through save → reopen.
 *
 * ui-text's value lives on `#node-input-text` (the canonical value typedInput).
 */

type StoreBinding = { kind: string; path?: string; subPath?: unknown } | undefined;

/** Switch the value typedInput to its `store` source (renders the rich field). */
async function selectStoreType(page: Page): Promise<void> {
    await page.evaluate(() => {
        const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
        $("#node-input-text").typedInput("type", "store");
    });
}

/** The resolved store name shown in the value area (or the soft placeholder). */
function storeName(page: Page) {
    return page.locator(".webapp-store-field-name");
}

/** The sub-path typedInput row (present only after a store is chosen). */
function subPathRow(page: Page) {
    return page.locator(".webapp-store-field-subpath");
}

/**
 * Click the value typedInput's native "…" expand button to (re-)open the picker.
 * The store type's `expand` handler opens the shared node-picker dialog.
 */
async function openStorePicker(page: Page): Promise<void> {
    await page.locator("#node-input-text").locator("xpath=..")
        .locator(".red-ui-typedInput-option-expand").first().click();
}

/** Pick a store row by visible text in the shared node-picker dialog. */
async function pickStoreRow(page: Page, rowText: string): Promise<void> {
    await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
    await page.locator(".webapp-node-picker-row").filter({ hasText: rowText }).first().click();
    await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);
}

function buildFlow(): unknown {
    return new FlowBuilder()
        .app({ id: "subApp", root: "subApp", name: "Sub App" })
        .node("ui-store", {
            id: "monsterStore",
            name: "monster",
            statePath: "monster",
            initialValue: JSON.stringify({ a: false, b: false, c: "eins" })
        })
        // Empty text → the value typedInput starts on the `str` type with an
        // empty value, so switching to `store` carries no phantom id.
        .node("ui-text", { id: "txtEd", text: "" })
        .build();
}

async function readTextBinding(page: Page, nodeId: string): Promise<StoreBinding> {
    return page.evaluate((id) => {
        const n = RED.nodes.node(id) as unknown as { value?: StoreBinding };
        return n?.value;
    }, nodeId);
}

test.describe("editor — store binding sub-path (P132 / P134)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("before a store is chosen: a soft '…'-Hinweis, no path field (no button)", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");

        await selectStoreType(page);

        // No in-value button — the name area carries a soft placeholder.
        await expect(page.locator(".webapp-store-field-button")).toHaveCount(0);
        await expect(storeName(page)).toHaveClass(/webapp-store-field-placeholder/);

        // No sub-path typedInput yet (appears once a store is picked, ADR 0013 §4).
        await expect(subPathRow(page)).toHaveCount(0);
    });

    test("after selecting a store the NAME (not id) shows in the value area; no button, no '(bestehend)'", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);

        await openStorePicker(page);
        await pickStoreRow(page, "monster");

        // The resolved NAME "monster" shows — never the raw node id, never a
        // "Store ändern" button, never "(bestehend)" for a live store.
        await expect(storeName(page)).toHaveText("monster");
        await expect(storeName(page)).not.toContainText("monsterStore");
        await expect(storeName(page)).not.toContainText("bestehend");
        await expect(page.locator(".webapp-store-field-button")).toHaveCount(0);

        // The second, indented sub-path typedInput now appears below the name.
        await expect(subPathRow(page)).toHaveCount(1);
    });

    test("the sub-path typedInput offers exactly the 11 storePath sources, string default", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);
        await openStorePicker(page);
        await pickStoreRow(page, "monster");

        const types = await page.evaluate(() => {
            const $ = (window as unknown as {
                $: ((sel: string) => unknown) & { data: (e: Element) => Record<string, unknown> };
            }).$;
            const el = ($("input.webapp-store-subpath-input") as unknown as { get: (i: number) => Element }).get(0);
            type Inst = { typeList?: Array<{ value?: string } | string> };
            const userData = $.data(el) as Record<string, unknown>;
            const instance = Object.values(userData ?? {}).find(
                (v): v is Inst => !!v && Array.isArray((v as Inst).typeList)
            );
            return (instance?.typeList ?? []).map((t) => (typeof t === "string" ? t : t.value));
        });

        expect(types).toEqual([
            "str", "num", "routeParam", "query", "store",
            "reactive", "jsonata", "msg", "flow", "global", "env"
        ]);
        expect(types[0]).toBe("str");
    });

    test("string-type autocomplete suggests the default-slice keys (a, b, c)", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);
        await openStorePicker(page);
        await pickStoreRow(page, "monster");

        // Invoke the typedInput's configured autoComplete for the `str` type and
        // assert it returns the default-slice keys — soft suggestions, derived from
        // the store's initialValue {a,b,c}.
        const suggestions = await page.evaluate(() => {
            const $ = (window as unknown as {
                $: ((sel: string) => unknown) & { data: (e: Element) => Record<string, unknown> };
            }).$;
            const el = ($("input.webapp-store-subpath-input") as unknown as {
                get: (i: number) => Element; typedInput: (...a: unknown[]) => unknown;
            });
            (el as unknown as { typedInput: (...a: unknown[]) => unknown }).typedInput("type", "str");
            const domEl = el.get(0);
            // The typedInput-level autoComplete callback (wired by the store field)
            // lives on the widget instance's `options.autoComplete`. Invoke it while
            // the active type is `str` and collect the suggestion values.
            type Inst = { typeList?: unknown[]; options?: { autoComplete?: (v: string) => Array<{ value: string }> } };
            const userData = $.data(domEl) as Record<string, unknown>;
            const instance = Object.values(userData ?? {}).find(
                (v): v is Inst => !!v && Array.isArray((v as Inst).typeList)
            );
            const ac = instance?.options?.autoComplete;
            return typeof ac === "function" ? ac("").map((e) => e.value) : null;
        });

        expect(suggestions).toEqual(["a", "b", "c"]);
    });

    test("selecting 'c' saves subPath {kind:'literal', value:'c'} and round-trips showing the NAME", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);
        await openStorePicker(page);
        await pickStoreRow(page, "monster");

        // Type the path "c" into the sub-path typedInput (str type, default).
        await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
            const el = $("input.webapp-store-subpath-input");
            el.typedInput("type", "str");
            el.typedInput("value", "c");
        });

        await editor.save();

        const saved = await readTextBinding(page, "txtEd");
        expect(saved).toEqual({
            kind: "store",
            path: "monsterStore",
            subPath: { kind: "literal", value: "c" }
        });

        // Reopen — the store NAME (not id) shows, the type is still store, and the
        // sub-path "c" survives.
        await editor.openNode("txtEd");
        await selectStoreType(page);
        await expect(storeName(page)).toHaveText("monster");
        await expect(storeName(page)).not.toContainText("monsterStore");
        const restoredSubPath = await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => string } }).$;
            const el = $("input.webapp-store-subpath-input");
            return { type: el.typedInput("type"), value: el.typedInput("value") };
        });
        expect(restoredSubPath).toEqual({ type: "str", value: "c" });
    });

    test("an unresolvable store id falls back to '<id> (bestehend)'", async ({ page, request }) => {
        // A ui-text pre-bound to a store id that does not exist in the graph.
        const flow = new FlowBuilder()
            .app({ id: "ghostApp", root: "ghostApp", name: "Ghost App" })
            .node("ui-text", { id: "ghostTxt", value: { kind: "store", path: "deletedStore" } })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ghostTxt");
        await selectStoreType(page);

        await expect(storeName(page)).toHaveText("deletedStore (bestehend)");
    });
});

/**
 * P174 (ADR 0013 §4) — the LIVE-LAYOUT contract. The shared store typedInput
 * (`storeTypedInputType` in resources/lib/editor-common.js) must render the
 * documented TWO-ROW layout on EVERY bindable value field, not the old P132
 * single-line/squeezed variant. The concrete defect: Node-RED locks the
 * typedInput container (`.red-ui-typedInput-container`, height:34px,
 * overflow:hidden) and the value-label cell (`.red-ui-typedInput-value-label`,
 * height:32px, overflow:hidden) to a single fixed-height ROW, so a
 * `flex-direction:column` value label was clipped — the sub-path row sheared off.
 * These specs assert the rows actually STACK (row 2 sits BELOW row 1, both
 * visible) and that the container grew past one row — i.e. nothing is clipped.
 *
 * Cross-node: the identical layout/picker/autocomplete must appear on every node
 * whose value field routes through `valueBindingTypes` → `storeTypedInputType`.
 * We sample ui-text, ui-pagination (the owner's screenshot — two store fields)
 * and ui-button.
 */

/** A node + the value typedInput's host element id, all sharing one store control. */
type StoreFieldCase = { type: string; nodeId: string; fieldId: string; overrides?: Record<string, unknown> };

const STORE_FIELD_CASES: StoreFieldCase[] = [
    { type: "ui-text", nodeId: "ftxt", fieldId: "node-input-text", overrides: { text: "" } },
    { type: "ui-pagination", nodeId: "fpag", fieldId: "node-input-currentPageBinding" },
    { type: "ui-button", nodeId: "fbtn", fieldId: "node-input-label" }
];

function caseFlow(c: StoreFieldCase): unknown {
    return new FlowBuilder()
        .app({ id: "csApp", root: "csApp", name: "CS App" })
        .node("ui-store", {
            id: "monsterStore",
            name: "monster",
            statePath: "monster",
            initialValue: JSON.stringify({ a: false, b: false, c: "eins" })
        })
        .node(c.type, { id: c.nodeId, ...(c.overrides ?? {}) })
        .build();
}

async function selectStoreTypeOn(page: Page, fieldId: string): Promise<void> {
    await page.evaluate((id) => {
        const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
        $("#" + id).typedInput("type", "store");
    }, fieldId);
}

async function openStorePickerOn(page: Page, fieldId: string): Promise<void> {
    // Scope to the OUTER typedInput container (direct child of the field's
    // form-row) and target the VISIBLE expand button: some nodes (e.g. ui-button)
    // render an extra `display:none` expand in the same form-row, which a bare
    // `.first()` would wrongly select.
    await page.locator("#" + fieldId).locator("xpath=..")
        .locator("> .red-ui-typedInput-container .red-ui-typedInput-option-expand:visible")
        .first().click();
}

/**
 * Geometry of the live store field for a given host element id: the two row
 * bounding boxes, the typedInput container box, and the value-label cell box.
 * Proves the rows STACK and the field is not clipped to a single 34px row.
 */
async function storeFieldGeometry(page: Page, fieldId: string) {
    // The OUTER typedInput container is the direct child of the host's form-row;
    // the sub-path's own typedInput nests a SECOND `.red-ui-typedInput-container`
    // inside `.webapp-store-field-subpath`, so scope to the direct child to avoid
    // a strict-mode match on both.
    const wrap = page.locator("#" + fieldId).locator("xpath=..").locator("> .red-ui-typedInput-container");
    const nameRow = wrap.locator(".webapp-store-field-name").first();
    const pathRow = wrap.locator(".webapp-store-field-subpath");
    const cell = wrap.locator("> .red-ui-typedInput-value-label");
    return {
        name: await nameRow.boundingBox(),
        path: await pathRow.boundingBox(),
        container: await wrap.boundingBox(),
        cell: await cell.boundingBox()
    };
}

test.describe("editor — store typedInput two-row layout & cross-node consistency (P174)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    for (const c of STORE_FIELD_CASES) {
        test(`${c.type}: store field renders the indented two-row layout (name above, sub-path below, not clipped)`, async ({ page, request }) => {
            await deployFlow(request, caseFlow(c));

            const editor = new NodeEditorPage(page);
            await editor.open();
            await editor.openNode(c.nodeId);
            await selectStoreTypeOn(page, c.fieldId);

            await openStorePickerOn(page, c.fieldId);
            await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
            await page.locator(".webapp-node-picker-row").filter({ hasText: "monster" }).first().click();
            await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);

            // Row 1 shows the NAME; row 2 (indented sub-path) is present.
            // Scope to the OUTER container (direct child) so the nested sub-path
            // typedInput's own container does not create a strict-mode match.
            const wrap = page.locator("#" + c.fieldId).locator("xpath=..").locator("> .red-ui-typedInput-container");
            await expect(wrap.locator(".webapp-store-field-name").first()).toHaveText("monster");
            await expect(wrap.locator(".webapp-store-field-subpath")).toHaveCount(1);
            // The sub-path carries a real, VISIBLE typedInput widget. The raw
            // `input.webapp-store-subpath-input` is `type="hidden"` by design (the
            // typedInput replaces it with a widget), so assert on the visible
            // widget — its container and its type-select button — not the backing
            // input.
            await expect(wrap.locator(".webapp-store-field-subpath .red-ui-typedInput-container")).toBeVisible();
            await expect(wrap.locator(".webapp-store-field-subpath .red-ui-typedInput-type-select")).toBeVisible();

            const g = await storeFieldGeometry(page, c.fieldId);
            expect(g.name, "name row box").toBeTruthy();
            expect(g.path, "sub-path row box").toBeTruthy();
            expect(g.container, "container box").toBeTruthy();
            expect(g.cell, "value-label cell box").toBeTruthy();
            if (!g.name || !g.path || !g.container || !g.cell) {
                throw new Error("store field rows did not render with a measurable box");
            }

            // STACKED: the sub-path row sits strictly BELOW the name row (not on
            // the same squeezed line). A full row height is ~24-34px; require a
            // clear vertical gap so a single-line regression fails here.
            expect(g.path.y, "sub-path row is below the name row").toBeGreaterThan(g.name.y + 10);

            // NOT CLIPPED: the container grew past the framework's single 34px row
            // to hold both rows, and the sub-path row's bottom is within the cell
            // (overflow:visible / height:auto won — old code clipped it to 32px).
            expect(g.container.height, "container grew past one 34px row").toBeGreaterThan(40);
            expect(
                g.path.y + g.path.height,
                "sub-path row bottom is inside the (grown) value cell, not clipped"
            ).toBeLessThanOrEqual(g.cell.y + g.cell.height + 2);
        });
    }

    test("ui-pagination: BOTH value fields (current + total) carry the identical two-row store control", async ({ page, request }) => {
        // The owner's screenshot is ui-pagination — two adjacent store fields.
        await deployFlow(request, caseFlow({ type: "ui-pagination", nodeId: "fpag2", fieldId: "node-input-currentPageBinding" }));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("fpag2");

        for (const fieldId of ["node-input-currentPageBinding", "node-input-totalBinding"]) {
            await selectStoreTypeOn(page, fieldId);
            await openStorePickerOn(page, fieldId);
            await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
            await page.locator(".webapp-node-picker-row").filter({ hasText: "monster" }).first().click();
            await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);

            const wrap = page.locator("#" + fieldId).locator("xpath=..").locator("> .red-ui-typedInput-container");
            await expect(wrap.locator(".webapp-store-field-name").first()).toHaveText("monster");
            await expect(wrap.locator(".webapp-store-field-subpath")).toHaveCount(1);

            const g = await storeFieldGeometry(page, fieldId);
            if (!g.name || !g.path) {
                throw new Error(`${fieldId}: store rows not measurable`);
            }
            expect(g.path.y, `${fieldId}: sub-path below name`).toBeGreaterThan(g.name.y + 10);
        }
    });

    test("before a store is chosen: single row 1 with the soft hint, no sub-path, no clipping change", async ({ page, request }) => {
        await deployFlow(request, caseFlow({ type: "ui-pagination", nodeId: "fpag3", fieldId: "node-input-currentPageBinding" }));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("fpag3");
        await selectStoreTypeOn(page, "node-input-currentPageBinding");

        const wrap = page.locator("#node-input-currentPageBinding").locator("xpath=..").locator("> .red-ui-typedInput-container");
        await expect(wrap.locator(".webapp-store-field-name")).toHaveClass(/webapp-store-field-placeholder/);
        await expect(wrap.locator(".webapp-store-field-name")).toHaveText("Store über „…“ auswählen");
        await expect(wrap.locator(".webapp-store-field-subpath")).toHaveCount(0);
    });

    test("leaf form (sub-path source = Store) shows the name only, no nested sub-path row", async ({ page, request }) => {
        // A store whose sub-path is itself a store binding (the one-level rule):
        // the INNER store control is the leaf form → name only, no further row.
        await deployFlow(request, caseFlow({ type: "ui-text", nodeId: "fleaf", fieldId: "node-input-text", overrides: { text: "" } }));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("fleaf");
        await selectStoreTypeOn(page, "node-input-text");
        await openStorePickerOn(page, "node-input-text");
        await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
        await page.locator(".webapp-node-picker-row").filter({ hasText: "monster" }).first().click();
        await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);

        // Switch the sub-path typedInput to its own `store` source → the inner
        // (leaf) store control appears. It must render the NAME area only, with NO
        // nested `.webapp-store-field-subpath` beneath it (ADR 0013 §3 one level).
        await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
            $("input.webapp-store-subpath-input").typedInput("type", "store");
        });

        // The inner control settles on the `store` source and renders its own
        // (leaf) store value label — the soft name placeholder.
        await expect(page.locator(".webapp-store-field-subpath .webapp-store-field-name"))
            .toHaveCount(1);
        await expect(page.locator(".webapp-store-field-subpath .webapp-store-field-name"))
            .toHaveClass(/webapp-store-field-placeholder/);

        // The outer field still has exactly one sub-path row; the inner leaf store
        // control inside it adds no second (nested) `.webapp-store-field-subpath`
        // — the one-level rule (ADR 0013 §3) holds.
        await expect(page.locator(".webapp-store-field-subpath")).toHaveCount(1);
        await expect(page.locator(".webapp-store-field-subpath .webapp-store-field-subpath"))
            .toHaveCount(0);
    });
});
