import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P132 (ADR 0013) — the store-binding editor: button-first, name-not-id, with a
 * one-level `subPath` typedInput and soft default-slice autocomplete.
 *
 * These are EDITOR specs: open a ui-text panel, drive the value typedInput's
 * `store` source, assert the rich rendering (button + NAME, not the raw id; the
 * sub-path typedInput; the 11-source set; the default-slice suggestions) and that
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

/** The rich store field's "Store auswählen"/"Store ändern" button. */
function storeButton(page: Page) {
    return page.locator(".webapp-store-field-button");
}

/** The resolved store name shown beside the button. */
function storeName(page: Page) {
    return page.locator(".webapp-store-field-name");
}

/** The sub-path typedInput row (present only after a store is chosen). */
function subPathRow(page: Page) {
    return page.locator(".webapp-store-field-subpath");
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
        // empty value, so switching to `store` carries no phantom id (button-first).
        .node("ui-text", { id: "txtEd", text: "" })
        .build();
}

async function readTextBinding(page: Page, nodeId: string): Promise<StoreBinding> {
    return page.evaluate((id) => {
        const n = RED.nodes.node(id) as unknown as { value?: StoreBinding };
        return n?.value;
    }, nodeId);
}

test.describe("editor — store binding sub-path (P132)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("button-first: before a store is chosen, only the 'Store auswählen' button (no path field)", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");

        await selectStoreType(page);

        // The button carries the store icon and the "auswählen" label.
        await expect(storeButton(page)).toBeVisible();
        await expect(storeButton(page)).toContainText("Store auswählen");
        await expect(storeButton(page).locator("i.fa-database")).toHaveCount(1);

        // No sub-path typedInput yet (button-first, ADR 0013 §4).
        await expect(subPathRow(page)).toHaveCount(0);
    });

    test("after selecting a store the button becomes 'Store ändern' and the NAME (not id) shows", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);

        await storeButton(page).click();
        await pickStoreRow(page, "monster");

        // Button label flips; the resolved NAME "monster" shows beside it — the
        // raw node id "monsterStore" must NOT appear.
        await expect(storeButton(page)).toContainText("Store ändern");
        await expect(storeName(page)).toHaveText("monster");
        await expect(storeName(page)).not.toContainText("monsterStore");

        // The sub-path typedInput now appears.
        await expect(subPathRow(page)).toHaveCount(1);
    });

    test("the sub-path typedInput offers exactly the 11 storePath sources, string default", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txtEd");
        await selectStoreType(page);
        await storeButton(page).click();
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
        await storeButton(page).click();
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
        await storeButton(page).click();
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
