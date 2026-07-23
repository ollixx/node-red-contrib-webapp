import { expect, test, type Browser } from "@playwright/test";

import { deployFlow, resetFlow } from "../../helpers/admin-api";
import { FlowBuilder } from "../../helpers/flow-builder";
import { WebappPage } from "../../helpers/webapp-page";

/**
 * P262 (ADR 0041 §4) — declarative authz guards: `requiresGroup[]` on ui-route +
 * ui-dialog, server-enforced at the four central points (page render, /snapshot,
 * navigation, event dispatch).
 *
 * Identity is faked via the P261 header-fake pattern (the test IS the proxy):
 * request-level `headers`, browser-level `browser.newContext({ extraHTTPHeaders })`.
 *
 * Semantics under test: absent/empty `requiresGroup` ⇒ authentication only
 * (P261 behaviour); set ⇒ the user needs AT LEAST ONE of the groups (ANY-of).
 * "visibleIf ist UX, Guard ist Sicherheit": the menu-consistency test hides the
 * menu item via the documented reactive-`user` visibleIf pattern (UX) and proves
 * SECURITY separately by direct-URL → 403 despite the hidden item.
 */

const BASE = "http://127.0.0.1:1882";

// admin holds the required group; member is AUTHENTICATED but lacks it.
const admin = { "X-Forwarded-User": "alice", "X-Forwarded-Groups": "admins, sales" };
const member = { "X-Forwarded-User": "bob", "X-Forwarded-Groups": "sales" };

const SECRET_ROUTE_TEXT = "Secret admin content";
const SECRET_DIALOG_TEXT = "Secret dialog content";

/**
 * One trusted-header app:
 *  - home ("/") with public text, a nav button wired to a route-mode navigate
 *    ui-action, and a ui-menu whose items are built via the documented
 *    reactive-`user` pattern (the guarded entry only for group holders),
 *  - a guarded route /secret (requiresGroup "admins") with secret text and a
 *    button (the event-dispatch target),
 *  - a guarded dialog (requiresGroup "admins") with secret text.
 */
function guardedFlow(appId: string) {
    const fb = new FlowBuilder().app({
        id: appId,
        root: appId,
        name: "Guarded App",
        layout: "app",
        auth: { mode: "trusted-header" }
    });
    fb.node("ui-text", { id: `${appId}Home`, text: "Public home content" });
    // Menu-consistency (UX): the documented visibleIf recommendation — the
    // guarded entry exists only when the identity holds the group.
    fb.node("ui-menu", {
        id: `${appId}Menu`,
        items: {
            kind: "reactive",
            value: "[{ label: \"Home\", path: \"/\" }].concat((user?.groups ?? []).includes(\"admins\") ? [{ label: \"Secret\", path: \"/secret\" }] : [])"
        }
    });
    fb.node("ui-button", { id: `${appId}Go`, label: "Go secret", wires: [[`${appId}GoAction`]] });
    fb.node("ui-action", { id: `${appId}GoAction`, actionType: "navigate", targetMode: "route", route: `${appId}Secret` });
    fb.route({ id: `${appId}Secret`, path: "/secret", requiresGroup: "admins" });
    fb.node("ui-text", { id: `${appId}SecretText`, text: SECRET_ROUTE_TEXT });
    fb.node("ui-button", { id: `${appId}SecretButton`, label: "Secret action" });
    const dialogId = `${appId}Dialog`;
    fb.node("ui-dialog", {
        id: dialogId,
        title: "Secret Dialog",
        layout: "vertical",
        requiresGroup: "admins",
        mount: undefined,
        wires: [[]]
    });
    fb.node("ui-text", { id: `${appId}DialogText`, mount: `${dialogId}.content`, text: SECRET_DIALOG_TEXT });
    return fb.build();
}

async function newUserPage(browser: Browser, headers: Record<string, string>) {
    const context = await browser.newContext({ extraHTTPHeaders: headers, baseURL: BASE });
    const page = await context.newPage();
    return { context, page };
}

test.describe("P262 guards — page render (403, no content leak)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("direct URL of a guarded route: 200 + content WITH the group, 403 page WITHOUT (HTML carries no route content)", async ({ request }) => {
        await deployFlow(request, guardedFlow("gPage"));

        const allowed = await request.get("/webapp/gPage/secret", { headers: admin });
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toContain(SECRET_ROUTE_TEXT);

        const denied = await request.get("/webapp/gPage/secret", { headers: member });
        expect(denied.status()).toBe(403);
        const html = await denied.text();
        // The defined 403 page — and NO leak of the guarded route's content.
        expect(html).toContain("Access denied");
        expect(html).not.toContain(SECRET_ROUTE_TEXT);
        expect(html).not.toContain("gPageSecretText");
        expect(html).not.toContain("webapp-client-root");
    });

    test("ANY-of semantics: holding ONE of several required groups suffices", async ({ request }) => {
        const fb = new FlowBuilder().app({
            id: "gAny",
            root: "gAny",
            name: "Any-of App",
            layout: "app",
            auth: { mode: "trusted-header" }
        });
        fb.route({ id: "gAnyRoute", path: "/either", requiresGroup: "admins, sales" });
        fb.node("ui-text", { id: "gAnyText", text: "Either-group content" });
        await deployFlow(request, fb.build());

        // member holds "sales" (not "admins") — ANY-of admits them.
        const allowed = await request.get("/webapp/gAny/either", { headers: member });
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toContain("Either-group content");

        // An authenticated user with NEITHER group is denied.
        const denied = await request.get("/webapp/gAny/either", { headers: { "X-Forwarded-User": "carol", "X-Forwarded-Groups": "ops" } });
        expect(denied.status()).toBe(403);
    });

    test("regression: a route WITHOUT requiresGroup stays open to every authenticated user (P261 behaviour)", async ({ request }) => {
        await deployFlow(request, guardedFlow("gOpen"));

        const home = await request.get("/webapp/gOpen/", { headers: member });
        expect(home.status()).toBe(200);
        expect(await home.text()).toContain("Public home content");
    });
});

test.describe("P262 guards — /snapshot excludes guarded routes/dialogs", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("snapshot of a guarded route: 403 without the group, snapshot JSON carries neither structure nor data", async ({ request }) => {
        await deployFlow(request, guardedFlow("gSnap"));

        const allowed = await request.get("/webapp/gSnap/snapshot?location=/secret", { headers: admin });
        expect(allowed.status()).toBe(200);
        expect(JSON.stringify(await allowed.json())).toContain(SECRET_ROUTE_TEXT);

        const denied = await request.get("/webapp/gSnap/snapshot?location=/secret", { headers: member });
        expect(denied.status()).toBe(403);
        const body = JSON.stringify(await denied.json());
        expect(body).not.toContain(SECRET_ROUTE_TEXT);
        expect(body).not.toContain("gSnapSecretText");
        expect(body).not.toContain("gSnapSecretButton");
    });

    test("guarded dialog: excluded from the snapshot JSON even when forced via ?dialog=", async ({ request }) => {
        await deployFlow(request, guardedFlow("gDlg"));

        const allowed = await request.get("/webapp/gDlg/snapshot?location=/&dialog=gDlgDialog", { headers: admin });
        expect(allowed.status()).toBe(200);
        expect(JSON.stringify(await allowed.json())).toContain(SECRET_DIALOG_TEXT);

        const denied = await request.get("/webapp/gDlg/snapshot?location=/&dialog=gDlgDialog", { headers: member });
        expect(denied.status()).toBe(200); // home itself is open…
        const body = JSON.stringify(await denied.json());
        // …but the guarded dialog is absent ENTIRELY — no structure, no data.
        expect(body).not.toContain(SECRET_DIALOG_TEXT);
        expect(body).not.toContain("gDlgDialogText");
    });

    test("browser: ?dialog=<guarded id> renders the dialog for the group holder, nothing for others", async ({ browser, request }) => {
        await deployFlow(request, guardedFlow("gDlgUi"));

        const adminSession = await newUserPage(browser, admin);
        const memberSession = await newUserPage(browser, member);
        try {
            await adminSession.page.goto(`/webapp/gDlgUi/?dialog=gDlgUiDialog`);
            await expect(adminSession.page.locator(".webapp-dialog")).toBeVisible();
            await expect(adminSession.page.locator(".webapp-dialog")).toContainText(SECRET_DIALOG_TEXT);

            await memberSession.page.goto(`/webapp/gDlgUi/?dialog=gDlgUiDialog`);
            const memberApp = new WebappPage(memberSession.page, "gDlgUi");
            await expect(memberApp.root()).toContainText("Public home content");
            await expect(memberSession.page.locator(".webapp-dialog")).toHaveCount(0);
            const pageHtml = await memberSession.page.content();
            expect(pageHtml).not.toContain(SECRET_DIALOG_TEXT);
        }
        finally {
            await adminSession.context.close();
            await memberSession.context.close();
        }
    });
});

test.describe("P262 guards — navigation to a guarded route is rejected", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-action navigate: the group holder is moved, the other client stays put (no silent success — no navigate command)", async ({ browser, request }) => {
        await deployFlow(request, guardedFlow("gNav"));

        const adminSession = await newUserPage(browser, admin);
        const memberSession = await newUserPage(browser, member);
        try {
            const adminApp = new WebappPage(adminSession.page, "gNav");
            const memberApp = new WebappPage(memberSession.page, "gNav");

            // Group holder: click → navigate command → lands on the guarded route.
            await adminApp.navigate("/");
            await adminSession.page.getByRole("button", { name: "Go secret" }).click();
            await expect(adminSession.page).toHaveURL(/\/secret$/, { timeout: 10000 });
            await expect(adminApp.root()).toContainText(SECRET_ROUTE_TEXT, { timeout: 10000 });

            // Without the group: the click reaches the flow, but the server pushes
            // NO navigate command to this connection — the client is not moved and
            // never sees the content.
            await memberApp.navigate("/");
            await memberSession.page.getByRole("button", { name: "Go secret" }).click();
            // Deterministic wait: give a real navigate ample time to happen, then
            // assert it did NOT.
            await memberSession.page.waitForTimeout(1500);
            await expect(memberSession.page).toHaveURL(/\/webapp\/gNav\/$/);
            await expect(memberApp.root()).toContainText("Public home content");
            await expect(memberApp.root()).not.toContainText(SECRET_ROUTE_TEXT);
        }
        finally {
            await adminSession.context.close();
            await memberSession.context.close();
        }
    });
});

test.describe("P262 guards — event dispatch to guarded components is rejected", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("POST /event on a component of a guarded route: 403 structured error without the group, accepted with it", async ({ request }) => {
        await deployFlow(request, guardedFlow("gEvt"));

        const denied = await request.post("/webapp/gEvt/event", {
            headers: member,
            data: { clientId: "c1", event: "click", sourceId: "gEvtSecretButton", location: "/secret" }
        });
        expect(denied.status()).toBe(403);
        const body = await denied.json();
        // Structured error per logs-errors.md (severity/code/message/context).
        expect(body.error.code).toBe("server.auth.event-denied");
        expect(body.error.severity).toBe("warn");
        expect(body.error.origin).toBe("server");
        expect(body.error.context.nodeId).toBe("gEvtSecretButton");

        const allowed = await request.post("/webapp/gEvt/event", {
            headers: admin,
            data: { clientId: "c1", event: "click", sourceId: "gEvtSecretButton", location: "/secret" }
        });
        expect(allowed.status()).toBe(200);
    });

    test("POST /event on a component of a guarded dialog: 403 without the group", async ({ request }) => {
        await deployFlow(request, guardedFlow("gEvtD"));

        // The ui-text inside the guarded dialog is a valid event target shape —
        // ownership walks the mount chain up to the guarded dialog.
        const denied = await request.post("/webapp/gEvtD/event", {
            headers: member,
            data: { clientId: "c1", event: "click", sourceId: "gEvtDDialogText", location: "/" }
        });
        expect(denied.status()).toBe(403);
        const body = await denied.json();
        expect(body.error.code).toBe("server.auth.event-denied");
    });
});

test.describe("P262 guards — menu consistency: visibleIf is UX, the guard is security", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the guarded menu item is hidden via the documented reactive-user pattern (UX) — and the direct URL still 403s (security)", async ({ browser, request }) => {
        await deployFlow(request, guardedFlow("gMenu"));

        const adminSession = await newUserPage(browser, admin);
        const memberSession = await newUserPage(browser, member);
        try {
            const adminApp = new WebappPage(adminSession.page, "gMenu");
            const memberApp = new WebappPage(memberSession.page, "gMenu");

            // Group holder: both menu entries.
            await adminApp.navigate("/");
            const adminItems = adminSession.page.locator("sl-menu sl-menu-item");
            await expect(adminItems).toHaveCount(2);
            await expect(adminItems.nth(1)).toContainText("Secret");

            // Without the group: the guarded entry is hidden (UX)…
            await memberApp.navigate("/");
            const memberItems = memberSession.page.locator("sl-menu sl-menu-item");
            await expect(memberItems).toHaveCount(1);
            await expect(memberItems.nth(0)).toContainText("Home");
            await expect(memberSession.page.locator("sl-menu")).not.toContainText("Secret");

            // …but hiding is NOT the security: the direct URL is 403 regardless.
            const direct = await memberSession.page.goto("/webapp/gMenu/secret");
            expect(direct?.status()).toBe(403);
            const html = await memberSession.page.content();
            expect(html).toContain("Access denied");
            expect(html).not.toContain(SECRET_ROUTE_TEXT);
        }
        finally {
            await adminSession.context.close();
            await memberSession.context.close();
        }
    });
});
