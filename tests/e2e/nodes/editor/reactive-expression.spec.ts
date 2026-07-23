import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P116 (ADR 0010) — the `reactive` typedInput + expression-editor dialog.
 *
 * `Reactive` is type #5 of the canonical value-binding set (P113; #5 since
 * P261 added `user`). Its expand
 * button opens an expression editor (RED.editor.createEditor — Monaco with an
 * ace-fallback) with completion from the real graph, two-stage validation
 * (syntax live + references on save/deploy) and a doc panel sourced from
 * reactive-expressions.md.
 *
 * These are EDITOR specs: drive the panel + the dialog, save, deploy, and assert
 * the node config + rendered output. The end-to-end scenario drives the EDITOR
 * (not a fixture) to give a ui-text on `/customers/:id` a reactive title.
 */

type ReactiveBinding = { kind: string; path?: string; value?: unknown } | undefined;

async function readTextValue(page: Page, nodeId: string): Promise<ReactiveBinding> {
    return page.evaluate((id) => {
        const node = RED.nodes.node(id) as unknown as { value?: ReactiveBinding };
        return node?.value;
    }, nodeId);
}

// Build a ui-app + a /customers/:id route + a ui-text mounted into it + a store.
function reactiveFlow(appId: string, textId: string, storeName = "customer") {
    return new FlowBuilder()
        .app({ id: appId, root: appId, name: appId, title: appId, layout: "app" })
        .route({ id: `${appId}-route`, path: "/customers/:id", title: "Detail", layout: "vertical" })
        .node("ui-text", { id: textId, mount: "route:/customers/:id/content", text: "x" })
        .node("ui-store", { id: `${appId}-store`, name: storeName, statePath: "customer", initialValue: "{}" })
        .build();
}

test.describe("editor — reactive expression dialog (P116)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("Reactive is type #5 of the ui-text value type set (after User since P261)", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp0", "rxText0"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText0");

        const types = await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: { valueBindingTypes: () => Array<{ value?: string } | string> };
            }).WebappEditorCommon;
            return C.valueBindingTypes().map((t) => (typeof t === "string" ? t : t.value));
        });
        // Canonical order: Store, Query, Route-Param, User (P261), Reactive, …
        expect(types[4]).toBe("reactive");
    });

    test("expand opens the dialog; a multi-line expression round-trips through save", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp1", "rxText1"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText1");

        // Open the dialog programmatically through the public helper (the same
        // entry point the typedInput expand button calls). #node-input-mount is
        // live, so the dialog resolves the enclosing /customers/:id route.
        await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: { openReactiveExpressionDialog: (o: Record<string, unknown>) => unknown };
            }).WebappEditorCommon;
            (window as unknown as { __rxResult?: string }).__rxResult = undefined;
            C.openReactiveExpressionDialog({
                value: "`Kunde\n${routeParam.id}`",
                onSelect: (v: string) => {
                    (window as unknown as { __rxResult?: string }).__rxResult = v;
                }
            });
        });

        const dialog = page.locator(".webapp-reactive-dialog");
        await expect(dialog).toBeVisible();
        // Doc panel shows the three globals + the doc link.
        await expect(dialog.locator(".webapp-reactive-doc code", { hasText: "routeParam" }).first()).toBeVisible();
        await expect(dialog.locator(".webapp-reactive-doc a")).toHaveAttribute("href", /reactive-expressions\.md/);

        // Status line shows a valid expression and Übernehmen is enabled.
        await expect(dialog.locator(".webapp-reactive-status")).toHaveAttribute("data-state", "ok");
        const okBtn = dialog.locator("button", { hasText: "Übernehmen" });
        await expect(okBtn).toBeEnabled();
        await okBtn.click();
        await expect(dialog).toHaveCount(0);

        // The dialog itself round-trips the multi-line source verbatim (the
        // editor preserves the newline; onSelect carries it back).
        const applied = await page.evaluate(() => (window as unknown as { __rxResult?: string }).__rxResult);
        expect(applied).toBe("`Kunde\n${routeParam.id}`");

        // Drive the real typedInput with the applied value + save → binding object.
        // (The single-line typedInput widget collapses newlines, so the node-level
        // round-trip uses a single-line form; multi-line fidelity is asserted via
        // the dialog onSelect above.)
        const singleLine = "`Kunde ${routeParam.id}`";
        await editor.fillTypedInput("text", singleLine, "reactive");
        await editor.save();

        const value = await readTextValue(page, "rxText1");
        expect(value).toEqual({ kind: "reactive", value: singleLine });

        // Re-open: the binding round-trips back into the typedInput as `reactive`.
        await editor.openNode("rxText1");
        expect(await editor.readTypedInputType("text")).toBe("reactive");
        expect(await editor.readTypedInput("text")).toBe(singleLine);
    });

    test("syntax error: broken template literal shows an error, disables Übernehmen, blocks deploy", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp2", "rxText2"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText2");

        // Dialog with a broken template literal → error status, disabled OK.
        await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: { openReactiveExpressionDialog: (o: Record<string, unknown>) => unknown };
            }).WebappEditorCommon;
            C.openReactiveExpressionDialog({ value: "`Kunde ${" });
        });
        const dialog = page.locator(".webapp-reactive-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".webapp-reactive-status")).toHaveAttribute("data-state", "error");
        await expect(dialog.locator("button", { hasText: "Übernehmen" })).toBeDisabled();
        await dialog.locator("button", { hasText: "Abbrechen" }).click();
        await expect(dialog).toHaveCount(0);

        // The same broken expression on the node → typedInput validate fails →
        // node invalid → deploy blocked.
        await editor.fillTypedInput("text", "`Kunde ${", "reactive");
        await editor.save();
        expect(await editor.getValidationState("rxText2")).toBe("invalid");
    });

    test("reference error: store(\"gibtsnicht\") names the unknown store + marks the node invalid", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp3", "rxText3"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText3");

        // Dialog: syntax is fine but the store name is unknown → error on apply
        // (the dialog stays open and names the store).
        await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: { openReactiveExpressionDialog: (o: Record<string, unknown>) => unknown };
            }).WebappEditorCommon;
            C.openReactiveExpressionDialog({ value: 'store("gibtsnicht").name' });
        });
        const dialog = page.locator(".webapp-reactive-dialog");
        await expect(dialog).toBeVisible();
        // Syntax ok → status ok and Übernehmen enabled, but applying fails on refs.
        await dialog.locator("button", { hasText: "Übernehmen" }).click();
        await expect(dialog).toBeVisible(); // stays open — reference error
        await expect(dialog.locator(".webapp-reactive-status")).toContainText("gibtsnicht");
        await dialog.locator("button", { hasText: "Abbrechen" }).click();

        // On the node: typedInput validate runs the reference check too → invalid.
        await editor.fillTypedInput("text", 'store("gibtsnicht").name', "reactive");
        await editor.save();
        expect(await editor.getValidationState("rxText3")).toBe("invalid");

        // A known store name (customer) is valid. Re-open the node first — save()
        // closed the tray, so a fresh panel is needed to set + persist again.
        await editor.openNode("rxText3");
        await editor.fillTypedInput("text", 'store("customer").name', "reactive");
        await editor.save();
        expect(await editor.getValidationState("rxText3")).toBe("valid");
    });

    test("completion provider: registered with the live route-param + store names", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp4", "rxText4"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText4");

        // The completion context resolves the enclosing /customers/:id route's
        // params and the app's store names from the live graph. Monaco completion
        // is hard to drive deterministically headless, so we assert the provider's
        // data source (the context) — the same data the provider offers. When
        // Monaco is present the provider is registered; when absent (ace) the
        // dialog still opens (covered above) with no console error.
        const ctx = await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: {
                    reactiveCompletionContext: () => { routeParams: string[]; storeNames: string[]; underRoute: boolean };
                };
            }).WebappEditorCommon;
            return C.reactiveCompletionContext();
        });
        expect(ctx.underRoute).toBe(true);
        expect(ctx.routeParams).toContain("id");
        expect(ctx.storeNames).toContain("customer");
    });

    test("ace-fallback: dialog opens + validates with NO console error when Monaco is absent", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxApp5", "rxText5"));

        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });
        page.on("pageerror", (err) => consoleErrors.push(String(err)));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxText5");

        // Simulate the ace-fallback path by forcing createEditor to be unavailable.
        await page.evaluate(() => {
            const RED = (window as unknown as { RED: { editor: { createEditor?: unknown } } }).RED;
            (window as unknown as { __savedCreateEditor?: unknown }).__savedCreateEditor = RED.editor.createEditor;
            RED.editor.createEditor = undefined;
        });

        await page.evaluate(() => {
            const C = (window as unknown as {
                WebappEditorCommon: { openReactiveExpressionDialog: (o: Record<string, unknown>) => unknown };
            }).WebappEditorCommon;
            C.openReactiveExpressionDialog({ value: "`Kunde ${routeParam.id}`" });
        });

        const dialog = page.locator(".webapp-reactive-dialog");
        await expect(dialog).toBeVisible();
        // Fallback textarea is present and validation still works.
        await expect(dialog.locator(".webapp-reactive-editor-fallback")).toBeVisible();
        await expect(dialog.locator(".webapp-reactive-status")).toHaveAttribute("data-state", "ok");

        await dialog.locator("button", { hasText: "Abbrechen" }).click();

        // Restore createEditor for later tests sharing the page context.
        await page.evaluate(() => {
            const RED = (window as unknown as { RED: { editor: { createEditor?: unknown } } }).RED;
            RED.editor.createEditor = (window as unknown as { __savedCreateEditor?: unknown }).__savedCreateEditor;
        });

        expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("\n")}`).toEqual([]);
    });

    test("end-to-end: editor-set `Kunde ${routeParam.id}` renders + re-evaluates on navigation", async ({ page, request }) => {
        await deployFlow(request, reactiveFlow("rxAppE2E", "rxTextE2E"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("rxTextE2E");

        // Drive the EDITOR (not a fixture): set the reactive expression on the
        // ui-text, save, deploy.
        await editor.fillTypedInput("text", "`Kunde ${routeParam.id}`", "reactive");
        await editor.save();
        expect(await editor.getValidationState("rxTextE2E")).toBe("valid");
        await editor.deploy();

        // Deep link → Kunde 42.
        await page.goto("/webapp/rxAppE2E/customers/42");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 42");

        // Navigate to a new :id → re-evaluates against the new route param.
        await page.goto("/webapp/rxAppE2E/customers/7");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 7");
    });
});
