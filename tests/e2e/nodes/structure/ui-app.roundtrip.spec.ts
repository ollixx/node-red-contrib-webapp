import { expect, test, type Page } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P260 (ADR 0041 §2) — editor open→save round-trip for the ui-app `auth` object.
 *
 * `auth` is stored as ONE object on the node. It deliberately has NO
 * `#node-input-auth` DOM carrier (the ADR 0031 clobber class): `oneditprepare`
 * seeds the visible auth rows (`#node-ui-app-auth-*`) from `this.auth`, and
 * `oneditsave` writes the object straight back to `this.auth`. This spec proves
 * the round-trip is lossless in both directions:
 *
 *   A. a deployed trusted-header config seeds the rows on open and survives
 *      Done unchanged (no clobber to the `{ mode: "none" }` default);
 *   B. a value change through the real rows (mode switch + header edit)
 *      persists structurally.
 *
 * The auth field is INERT until P261 — this spec proves config persistence
 * only, deliberately no behaviour.
 */

async function readAuth(page: Page, nodeId: string): Promise<Record<string, unknown>> {
    return page.evaluate((id) => {
        const node = RED.nodes.node(id) as Record<string, unknown> | null;
        return (node ? node.auth : undefined) as Record<string, unknown>;
    }, nodeId);
}

test.describe("ui-app — auth object open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("trusted-header auth survives open→Done and a change round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({
                id: "authApp",
                root: "authApp",
                auth: {
                    mode: "trusted-header",
                    headerUser: "X-My-User",
                    redirect: "/oauth2/sign_in"
                }
            })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        // ── Phase A: seeded on open + survives Done unchanged ────────────────
        await editor.openNode("authApp");

        await expect(page.locator("#node-ui-app-auth-mode")).toHaveValue("trusted-header");
        await expect(page.locator("#node-ui-app-auth-headerUser")).toHaveValue("X-My-User");
        await expect(page.locator("#node-ui-app-auth-headerEmail")).toHaveValue("");
        await expect(page.locator("#node-ui-app-auth-redirect")).toHaveValue("/oauth2/sign_in");
        // detail rows are visible for trusted-header
        await expect(page.locator("#node-ui-app-auth-headerUser")).toBeVisible();

        // dirty the panel via a field NOT under test, then Done
        await page.locator("#node-input-name").fill("Auth App ~rt");
        await editor.save();

        expect(await readAuth(page, "authApp"), "auth must survive Done unchanged (no clobber)").toEqual({
            mode: "trusted-header",
            headerUser: "X-My-User",
            redirect: "/oauth2/sign_in"
        });

        // ── Phase B: value change through the real rows round-trips ──────────
        await editor.openNode("authApp");
        await page.locator("#node-ui-app-auth-headerUser").fill("X-Other-User");
        await page.locator("#node-ui-app-auth-headerGroups").fill("X-My-Groups");
        await page.locator("#node-ui-app-auth-redirect").fill("");
        await editor.save();

        expect(await readAuth(page, "authApp"), "changed auth values must persist (blank drops the key)").toEqual({
            mode: "trusted-header",
            headerUser: "X-Other-User",
            headerGroups: "X-My-Groups"
        });
    });

    test("mode none hides the detail rows and persists as { mode: 'none' }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "authApp2", root: "authApp2" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("authApp2");

        // default mode none; detail rows hidden
        await expect(page.locator("#node-ui-app-auth-mode")).toHaveValue("none");
        await expect(page.locator("#node-ui-app-auth-headerUser")).toBeHidden();

        // switching to trusted-header reveals them; back to none hides again
        await page.locator("#node-ui-app-auth-mode").selectOption("trusted-header");
        await expect(page.locator("#node-ui-app-auth-headerUser")).toBeVisible();
        await page.locator("#node-ui-app-auth-mode").selectOption("none");
        await expect(page.locator("#node-ui-app-auth-headerUser")).toBeHidden();

        await page.locator("#node-input-name").fill("Auth App 2 ~rt");
        await editor.save();

        expect(await readAuth(page, "authApp2")).toEqual({ mode: "none" });
    });
});
