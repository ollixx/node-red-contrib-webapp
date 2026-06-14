import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P182 (ADR 0017 / ADR 0020) — the scope-local binding kinds are CONTEXT-GATED in
 * the editor's typedInput offering:
 *
 *   - `item` / `index` appear ONLY when the edited node is mounted (transitively)
 *     inside a `ui-repeat` template.
 *   - `prop` appears ONLY when the edited node is mounted inside a
 *     `ui-component-definition` template (`def:` scope).
 *   - A field outside both scopes offers NEITHER — the canonical value set is the
 *     14 global kinds only.
 *
 * These are EDITOR specs: open each node's panel and read the typedInput's
 * configured `typeList` off the live widget instance (the same technique as the
 * P67 alert spec — `typedInput("types")` is a setter-only, so we read the
 * instance stored in jQuery user-data).
 */

// Read the configured typedInput type set off the live widget instance for the
// given field. Mirrors the P67 alert spec read.
async function readTypedInputTypeSet(page: Page, fieldId: string): Promise<string[]> {
    return page.evaluate((id) => {
        const $ = (window as unknown as {
            $: ((sel: string) => unknown) & {
                data: ((e: Element, key: string) => unknown) & ((e: Element) => Record<string, unknown>);
            };
        }).$;
        const el = ($(`#node-input-${id}`) as unknown as { get: (i: number) => Element }).get(0);
        type Inst = { typeList?: Array<{ value?: string } | string> };
        const direct = $.data(el, "nodered-typedInput") as Inst | undefined;
        const userData = $.data(el) as Record<string, unknown>;
        const instance: Inst | undefined = (direct && Array.isArray(direct.typeList))
            ? direct
            : (Object.values(userData ?? {}).find(
                (v): v is Inst => !!v && Array.isArray((v as Inst).typeList)
            ));
        return (instance?.typeList ?? []).map((t) => (typeof t === "string" ? t : t.value));
    }, fieldId);
}

const BASE_VALUE_SET = [
    "store", "query", "routeParam", "reactive", "msg", "jsonata",
    "str", "num", "bool", "json", "date", "flow", "global", "env"
];

test.describe("editor — scope-local binding kinds are context-gated (P182)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a value field INSIDE a ui-repeat offers item/index (not prop)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p182App", root: "p182App", name: "P182 App" })
            // ui-repeat mounted in the app content slot; its child ui-text mounts
            // into the repeat's content slot (container:<repeatId>/content).
            .node("ui-repeat", { id: "p182Repeat", mount: "p182App.content", itemsPath: "rows" })
            .node("ui-text", { id: "p182TextInRepeat", mount: "container:p182Repeat/content", text: "Row" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p182TextInRepeat");

        const types = await readTypedInputTypeSet(page, "text");
        expect(types).toContain("item");
        expect(types).toContain("index");
        // prop is a DIFFERENT scope (component definition) — not offered here.
        expect(types).not.toContain("prop");
        // The base global kinds are all still present.
        for (const kind of BASE_VALUE_SET) {
            expect(types).toContain(kind);
        }
    });

    test("a value field INSIDE a ui-component-definition offers prop (not item/index)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p182App", root: "p182App", name: "P182 App" })
            // Off-canvas component definition (no outer mount); its child ui-text
            // mounts into the definition's content slot (def:<defId>/content).
            .node("ui-component-definition", { id: "p182Def", name: "Card", mount: "" })
            .node("ui-text", { id: "p182TextInDef", mount: "def:p182Def/content", text: "In def" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p182TextInDef");

        const types = await readTypedInputTypeSet(page, "text");
        expect(types).toContain("prop");
        // item/index are a DIFFERENT scope (ui-repeat) — not offered here.
        expect(types).not.toContain("item");
        expect(types).not.toContain("index");
        for (const kind of BASE_VALUE_SET) {
            expect(types).toContain(kind);
        }
    });

    test("a value field OUTSIDE both scopes offers neither item/index nor prop", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p182App", root: "p182App", name: "P182 App" })
            // Plain ui-text mounted directly in the app content slot.
            .node("ui-text", { id: "p182TextFree", mount: "p182App.content", text: "Free" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p182TextFree");

        const types = await readTypedInputTypeSet(page, "text");
        // Exactly the 14 global kinds — no scope-local kinds.
        expect(types).toEqual(BASE_VALUE_SET);
        expect(types).not.toContain("item");
        expect(types).not.toContain("index");
        expect(types).not.toContain("prop");
    });

    test("the SAME ui-text field gains item/index only when its mount is inside a repeat", async ({ page, request }) => {
        // Proof of the gating's dependence on mount scope alone (acceptance #4):
        // identical node, two flows — once free, once mounted inside a repeat.
        const freeFlow = new FlowBuilder()
            .app({ id: "p182App", root: "p182App", name: "P182 App" })
            .node("ui-text", { id: "p182Same", mount: "p182App.content", text: "X" })
            .build();
        await deployFlow(request, freeFlow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p182Same");
        expect(await readTypedInputTypeSet(page, "text")).not.toContain("item");
        await editor.save();

        const repeatFlow = new FlowBuilder()
            .app({ id: "p182App", root: "p182App", name: "P182 App" })
            .node("ui-repeat", { id: "p182Repeat", mount: "p182App.content", itemsPath: "rows" })
            .node("ui-text", { id: "p182Same", mount: "container:p182Repeat/content", text: "X" })
            .build();
        await deployFlow(request, repeatFlow);

        await editor.openNode("p182Same");
        const inRepeat = await readTypedInputTypeSet(page, "text");
        expect(inRepeat).toContain("item");
        expect(inRepeat).toContain("index");
    });
});
