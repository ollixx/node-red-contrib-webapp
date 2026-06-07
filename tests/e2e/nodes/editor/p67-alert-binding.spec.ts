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

    test("message and title are typedInputs whose type set includes 'store'", async ({ page, request }) => {
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
        await editor.expectFields(["message", "title"]);

        // Both widgets expose the new `store` type alongside the literal/dynamic
        // kinds. Node-RED's `typedInput("types")` is a SETTER only (it calls
        // `types.map(...)` on its argument and throws on a bare get), so read the
        // configured type list off the widget instance stored in jQuery `.data()`
        // instead. The jQuery-UI bridge keys the instance by namespace+widget
        // name; probe the element's data for the entry exposing `typeList`.
        const messageTypes = await page.evaluate(() => {
            const $ = (window as unknown as { $: (sel: string) => unknown }).$;
            const el = ($("#node-input-message") as unknown as { get: (i: number) => Element }).get(0);
            const data = (($ as unknown as { _data?: (e: Element) => Record<string, unknown> })._data?.(el))
                ?? (($ as unknown as { data: (e: Element) => Record<string, unknown> }).data(el));
            const instance = Object.values(data ?? {}).find(
                (v): v is { typeList: Array<{ value?: string } | string> } =>
                    !!v && Array.isArray((v as { typeList?: unknown }).typeList)
            );
            return (instance?.typeList ?? []).map((t) => (typeof t === "string" ? t : t.value));
        });
        expect(messageTypes).toEqual(expect.arrayContaining([
            "literal", "state", "query", "routeParam", "store", "msg", "flow", "global", "jsonata", "env"
        ]));
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
        await editor.fillTypedInput("message", "draftStore", "store");
        // Title from the incoming message (wiring-first).
        await editor.fillTypedInput("title", "payload.heading", "msg");
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

        expect(await editor.readTypedInputType("message")).toBe("state");
        expect(await editor.readTypedInput("message")).toBe("alerts.current");
    });
});
