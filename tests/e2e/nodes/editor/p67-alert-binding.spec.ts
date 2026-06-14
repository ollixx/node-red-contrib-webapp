import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P67 — ui-alert's plain-text "Message Path" field becomes a typedInput on
 * `message` (and `title`) supporting every binding kind plus the new `store`
 * kind. These are EDITOR specs: open the panel, drive the typedInput widgets,
 * save, and assert the node config round-trips the right binding.
 */

type AlertBinding = { kind: string; path?: string; value?: unknown } | undefined;

async function readAlertConfig(page: Page, nodeId: string): Promise<{ message: AlertBinding; title: AlertBinding; messagePath: unknown }> {
    return page.evaluate((id) => {
        const node = RED.nodes.node(id) as unknown as { message?: AlertBinding; title?: AlertBinding; messagePath?: unknown };
        return { message: node?.message, title: node?.title, messagePath: node?.messagePath };
    }, nodeId);
}

test.describe("editor panel — ui-alert message/title typedInput (P67)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // P113: message/title now use the ONE canonical value-binding type set
    // (ADR 0012 / ADR 0010) — Store, Query, Route-Param, Reactive, msg, JSONata,
    // str, num, bool, json, date, Flow, Global, Env. No more `literal`/`state`.
    test("message and title are typedInputs whose type set is the canonical value set", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp", root: "alertApp", name: "Alert App" })
            .node("ui-store", { id: "draftStore", statePath: "draft.customer", initialValue: "{}" })
            .node("ui-alert", { id: "alertEd", message: { kind: "literal", value: "Hi" } })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alertEd");

        // The legacy plain-text "Message Path" field is gone; message + title are
        // bindable typedInputs.
        // The typedInput widgets live on the `*Binding` fields (the `message`/
        // `title` defaults persist the binding OBJECT and have no DOM element, so
        // Node-RED's defaults auto-read cannot clobber them — see ui-alert.html).
        await editor.expectFields(["messageBinding", "titleBinding"]);

        // Both widgets expose the new `store` type alongside the literal/dynamic
        // kinds. Node-RED's `typedInput("types")` is a SETTER only (it calls
        // `types.map(...)` on its argument and throws on a bare get), so read the
        // configured type list off the widget instance stored in jQuery `.data()`
        // instead. The jQuery-UI widget bridge stores the instance via
        // `$.data(el, widgetFullName, this)` where widgetFullName is
        // `"nodered-typedInput"` — i.e. in jQuery's USER data cache (`$.data(el)`),
        // NOT the private/event cache (`$._data(el)`, which is jQuery's `dataPriv`
        // and never holds the widget instance). The instance keeps the configured
        // type definitions on `this.typeList`. Read the user-data entry by its
        // widget key, falling back to scanning all user data for a `typeList`.
        const messageTypes = await page.evaluate(() => {
            const $ = (window as unknown as {
                $: ((sel: string) => unknown) & {
                    data: ((e: Element, key: string) => unknown) & ((e: Element) => Record<string, unknown>);
                };
            }).$;
            const el = ($("#node-input-messageBinding") as unknown as { get: (i: number) => Element }).get(0);
            type Inst = { typeList?: Array<{ value?: string } | string> };
            const direct = $.data(el, "nodered-typedInput") as Inst | undefined;
            const userData = $.data(el) as Record<string, unknown>;
            const instance: Inst | undefined = (direct && Array.isArray(direct.typeList))
                ? direct
                : (Object.values(userData ?? {}).find(
                    (v): v is Inst => !!v && Array.isArray((v as Inst).typeList)
                ));
            return (instance?.typeList ?? []).map((t) => (typeof t === "string" ? t : t.value));
        });
        // P182 (ADR 0017 / ADR 0020): the scope-local `item`/`index`/`prop` kinds
        // are CONTEXT-GATED — offered ONLY when the edited node is inside a
        // ui-repeat (item/index) or a ui-component-definition (prop). This
        // ui-alert is mounted in a plain route slot — neither scope — so its
        // canonical value set is exactly the 14 global kinds, with NO item/index
        // and NO prop.
        expect(messageTypes).toEqual([
            "store", "query", "routeParam", "reactive", "msg", "jsonata",
            "str", "num", "bool", "json", "date", "flow", "global", "env"
        ]);
        expect(messageTypes).not.toContain("item");
        expect(messageTypes).not.toContain("index");
        expect(messageTypes).not.toContain("prop");
    });

    test("setting message to a store binding round-trips on save", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp", root: "alertApp", name: "Alert App" })
            .node("ui-store", { id: "draftStore", statePath: "draft.customer", initialValue: "{}" })
            .node("ui-alert", { id: "alertEd", message: { kind: "literal", value: "Hi" } })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alertEd");

        // Choose the store kind and point it at the ui-store node id.
        await editor.fillTypedInput("messageBinding", "draftStore", "store");
        // Title from the incoming message (wiring-first).
        await editor.fillTypedInput("titleBinding", "payload.heading", "msg");
        await editor.save();

        const config = await readAlertConfig(page, "alertEd");
        expect(config.message).toEqual({ kind: "store", path: "draftStore" });
        expect(config.title).toEqual({ kind: "msg", path: "payload.heading" });
        // messagePath is cleared — it no longer drives the editor.
        expect(config.messagePath === "" || config.messagePath === undefined).toBe(true);
    });

    test("a legacy messagePath is read back as a state binding in the typedInput", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp", root: "alertApp", name: "Alert App" })
            // Legacy node: no `message` binding, only the old messagePath field.
            .node("ui-alert", { id: "legacyAlert", message: undefined, messagePath: "alerts.current" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("legacyAlert");

        expect(await editor.readTypedInputType("messageBinding")).toBe("state");
        expect(await editor.readTypedInput("messageBinding")).toBe("alerts.current");
    });
});
