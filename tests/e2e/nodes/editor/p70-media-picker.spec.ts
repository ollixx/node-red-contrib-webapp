import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P70 — editor: ui-image src binding typedInput (with the Asset type) + the
 * media picker, and the ui-app mediaStoreUrl field. The picker lists assets via
 * the app-scoped admin endpoint (GET /webapp/:appId/assets), which the editor
 * reaches without ever knowing the real store URL.
 */

test.describe("editor — ui-image media (P70)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-image src is a typedInput whose type set includes 'asset'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "mediaApp", root: "mediaApp", name: "Media App" })
            .node("ui-image", { id: "img1", name: "Logo", src: { kind: "literal", value: "https://example.com/a.png" } })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("img1");

        // The typedInput widget lives on the `srcBinding` field (the `src` default
        // persists the binding OBJECT and has no DOM element). Read the configured
        // type list off the widget instance in jQuery user-data (typedInput("types")
        // is a setter only) — mirrors the P67 alert-binding spec.
        await editor.expectFields(["srcBinding"]);
        const srcTypes = await page.evaluate(() => {
            const $ = (window as unknown as {
                $: ((sel: string) => unknown) & {
                    data: ((e: Element, key: string) => unknown) & ((e: Element) => Record<string, unknown>);
                };
            }).$;
            const el = ($("#node-input-srcBinding") as unknown as { get: (i: number) => Element }).get(0);
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
        expect(srcTypes).toEqual(expect.arrayContaining([
            "literal", "asset", "state", "query", "store", "msg"
        ]));
    });

    test("ui-app has a Media Store URL field that round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "mediaApp2", root: "mediaApp2", name: "Media App 2" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("mediaApp2");

        const field = page.locator("#node-input-mediaStoreUrl");
        await expect(field).toBeVisible();
        await field.fill("https://store.example/media");
        await editor.save();

        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("mediaApp2");
            return n ? n.mediaStoreUrl : null;
        });
        expect(saved).toBe("https://store.example/media");
    });

    test("the assets admin endpoint reports no store when none is configured", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "mediaApp3", root: "mediaApp3" })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/mediaApp3/assets");
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(body.mediaStoreConfigured).toBe(false);
        expect(Array.isArray(body.assets)).toBe(true);
    });
});
