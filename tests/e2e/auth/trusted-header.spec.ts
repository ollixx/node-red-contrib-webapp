import { expect, test, type Browser } from "@playwright/test";

import { deployFlow, resetFlow } from "../../helpers/admin-api";
import { injectMessage } from "../../helpers/admin-api";
import { FlowBuilder } from "../../helpers/flow-builder";
import { WebappPage } from "../../helpers/webapp-page";

/**
 * P261 (ADR 0041 §2/§3) — trusted-header identity: guard enforcement over all
 * app endpoints + the `user` binding source.
 *
 * REFERENCE PATTERN — faking identity in E2E (no IdP in the test loop):
 * the trusted-header source reads identity from reverse-proxy headers, so a
 * test IS the proxy: it sets the identity headers on every request.
 *   - API-level: `request.get(url, { headers: { "X-Forwarded-User": "alice" } })`
 *   - Browser-level: `browser.newContext({ extraHTTPHeaders: { ... } })` — every
 *     request of that context (page, SSE, POSTs) carries the identity, exactly
 *     like a browser behind an authenticating proxy.
 * Two identities = two browser contexts with different headers. This is the
 * documented pattern for every later auth spec (P262 guards, P263 user state).
 */

const BASE = "http://127.0.0.1:1882";

/** Flow: one trusted-header app with a ui-text bound to `user.name`. */
function trustedHeaderFlow(appId: string, extra?: (fb: FlowBuilder) => void) {
    const fb = new FlowBuilder().app({
        id: appId,
        root: appId,
        name: "Auth App",
        layout: "app",
        auth: { mode: "trusted-header" }
    });
    fb.node("ui-text", { id: `${appId}Who`, value: { kind: "user", path: "name" } });
    if (extra) {
        extra(fb);
    }
    return fb.build();
}

const alice = { "X-Forwarded-User": "alice", "X-Forwarded-Email": "alice@example.com", "X-Forwarded-Groups": "admins, sales" };
const bob = { "X-Forwarded-User": "bob" };

async function newUserPage(browser: Browser, headers: Record<string, string>) {
    const context = await browser.newContext({ extraHTTPHeaders: headers, baseURL: BASE });
    const page = await context.newPage();
    return { context, page };
}

test.describe("P261 trusted-header auth — guard per endpoint class", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("page GET — 401 without identity header, content with it", async ({ request }) => {
        await deployFlow(request, trustedHeaderFlow("authPage"));

        const denied = await request.get("/webapp/authPage/");
        expect(denied.status()).toBe(401);

        const allowed = await request.get("/webapp/authPage/", { headers: alice });
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toContain("webapp-client-root");
    });

    test("SPA fallback GET /webapp/:appId/* — 401 without header, route content with it", async ({ request }) => {
        await deployFlow(
            request,
            trustedHeaderFlow("authSpa", (fb) => {
                fb.route({ id: "authSpaSub", path: "/sub", layout: "vertical" });
                fb.node("ui-text", { id: "authSpaSubText", text: "Sub content" });
            })
        );

        const denied = await request.get("/webapp/authSpa/sub");
        expect(denied.status()).toBe(401);

        const allowed = await request.get("/webapp/authSpa/sub", { headers: alice });
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toContain("Sub content");
    });

    test("SSE GET /stream — 401 without identity header", async ({ request }) => {
        await deployFlow(request, trustedHeaderFlow("authSse"));

        const denied = await request.get("/webapp/authSse/stream?clientId=c1");
        expect(denied.status()).toBe(401);
        // The with-header SSE positive is proven browser-side below (the client
        // context connects its EventSource through the guard).
    });

    test("POST /event and /dynamic-state — 401 without header, guard passes with it", async ({ request }) => {
        await deployFlow(request, trustedHeaderFlow("authPost"));

        const eventDenied = await request.post("/webapp/authPost/event", { data: { clientId: "c1", event: "click", sourceId: "x" } });
        expect(eventDenied.status()).toBe(401);

        const dynDenied = await request.post("/webapp/authPost/dynamic-state", { data: { clientId: "c1", id: "x", field: "visible", value: true } });
        expect(dynDenied.status()).toBe(401);

        // With the identity header the guard passes and the HANDLER answers
        // (its own validation status — anything but the guard's 401/302).
        const eventWithHeader = await request.post("/webapp/authPost/event", {
            headers: alice,
            data: { clientId: "c1", event: "click", sourceId: "nope" }
        });
        expect(eventWithHeader.status()).not.toBe(401);
        expect(eventWithHeader.status()).not.toBe(302);

        const dynWithHeader = await request.post("/webapp/authPost/dynamic-state", {
            headers: alice,
            data: { clientId: "c1" }
        });
        expect(dynWithHeader.status()).not.toBe(401);
        expect(dynWithHeader.status()).not.toBe(302);
    });

    test("GET /asset/:id — 401 without header, handler reached with it", async ({ request }) => {
        await deployFlow(request, trustedHeaderFlow("authAsset"));

        const denied = await request.get("/webapp/authAsset/asset/some-id");
        expect(denied.status()).toBe(401);

        // No media store configured → the HANDLER's 404 proves the guard passed.
        const allowed = await request.get("/webapp/authAsset/asset/some-id", { headers: alice });
        expect(allowed.status()).toBe(404);
    });

    test("GET /snapshot — 401 without header, snapshot with resolved user content with it", async ({ request }) => {
        await deployFlow(request, trustedHeaderFlow("authSnap"));

        const denied = await request.get("/webapp/authSnap/snapshot");
        expect(denied.status()).toBe(401);

        const allowed = await request.get("/webapp/authSnap/snapshot", { headers: alice });
        expect(allowed.status()).toBe(200);
        const body = await allowed.json();
        // The ui-text bound to user.name resolves to the header identity.
        expect(JSON.stringify(body.snapshot)).toContain("alice");
    });

    test("auth.redirect — 302 to the configured target instead of 401", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({
                id: "authRedir",
                root: "authRedir",
                name: "Redirect App",
                layout: "app",
                auth: { mode: "trusted-header", redirect: "/oauth2/sign_in" }
            })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/authRedir/", { maxRedirects: 0 });
        expect(res.status()).toBe(302);
        expect(res.headers()["location"]).toBe("/oauth2/sign_in");
    });

    test("custom header names — identity read from the configured headers", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({
                id: "authCustom",
                root: "authCustom",
                name: "Custom Header App",
                layout: "app",
                auth: { mode: "trusted-header", headerUser: "Remote-User", headerEmail: "Remote-Email", headerGroups: "Remote-Groups" }
            })
            .node("ui-text", { id: "authCustomWho", value: { kind: "user", path: "name" } })
            .build();
        await deployFlow(request, flow);

        // The DEFAULT header no longer authenticates…
        const denied = await request.get("/webapp/authCustom/", { headers: alice });
        expect(denied.status()).toBe(401);
        // …the configured one does, and resolves the binding.
        const allowed = await request.get("/webapp/authCustom/", { headers: { "Remote-User": "carol" } });
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toContain("carol");
    });

    test("mode none — every endpoint class stays open without any header (regression)", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "authNone", root: "authNone", name: "Open App", layout: "app" })
            .node("ui-text", { id: "authNoneText", text: "Open content" })
            .build();
        await deployFlow(request, flow);

        const page = await request.get("/webapp/authNone/");
        expect(page.status()).toBe(200);
        expect(await page.text()).toContain("Open content");

        const snapshot = await request.get("/webapp/authNone/snapshot");
        expect(snapshot.status()).toBe(200);

        const asset = await request.get("/webapp/authNone/asset/some-id");
        expect(asset.status()).toBe(404); // handler's own 404 (no media store), not a 401

        const event = await request.post("/webapp/authNone/event", { data: { clientId: "c1", event: "click", sourceId: "nope" } });
        expect(event.status()).not.toBe(401);
    });
});

test.describe("P261 trusted-header auth — user binding in the browser", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a ui-text bound to user.name shows the header identity; groups parse tolerantly", async ({ browser, request }) => {
        await deployFlow(
            request,
            trustedHeaderFlow("authBind", (fb) => {
                // Tolerant groups parsing: " admins, sales" → ["admins","sales"];
                // groups.0 renders the first entry.
                fb.node("ui-text", { id: "authBindGroup", value: { kind: "user", path: "groups.0" } });
            })
        );

        const { context, page } = await newUserPage(browser, alice);
        try {
            const webapp = new WebappPage(page, "authBind");
            await webapp.navigate("/");
            await expect(webapp.root()).toContainText("alice");
            await expect(webapp.root()).toContainText("admins");
        }
        finally {
            await context.close();
        }
    });

    test("two clients with different header users each see THEIR name — also through an SSE broadcast re-render", async ({ browser, request }) => {
        await deployFlow(
            request,
            trustedHeaderFlow("authIso", (fb) => {
                fb.node("ui-store", { id: "authIsoStore", statePath: "iso", initialValue: JSON.stringify("start") });
                fb.node("ui-text", { id: "authIsoStoreText", value: { kind: "store", path: "authIsoStore" } });
                fb.withStoreInject("authIsoInject", "authIsoStore", "updated");
            })
        );

        const aliceSession = await newUserPage(browser, alice);
        const bobSession = await newUserPage(browser, bob);
        try {
            const aliceApp = new WebappPage(aliceSession.page, "authIso");
            const bobApp = new WebappPage(bobSession.page, "authIso");
            await aliceApp.navigate("/");
            await bobApp.navigate("/");

            // Initial render: each client sees its own identity.
            await expect(aliceApp.root()).toContainText("alice");
            await expect(bobApp.root()).toContainText("bob");
            await expect(aliceApp.root()).not.toContainText("bob");
            await expect(bobApp.root()).not.toContainText("alice");

            // Broadcast store write → the server re-renders EVERY connected
            // client over its SSE connection. The re-render must use the
            // identity bound to EACH connection — no leak between them.
            await injectMessage(request, "authIsoInject");
            await expect(aliceApp.root()).toContainText("updated");
            await expect(bobApp.root()).toContainText("updated");
            await expect(aliceApp.root()).toContainText("alice");
            await expect(bobApp.root()).toContainText("bob");
            await expect(aliceApp.root()).not.toContainText("bob");
            await expect(bobApp.root()).not.toContainText("alice");
        }
        finally {
            await aliceSession.context.close();
            await bobSession.context.close();
        }
    });

    test("clientId stays device identity — two sessions of the SAME user keep separate clientIds", async ({ browser, request }) => {
        await deployFlow(request, trustedHeaderFlow("authDev"));

        const first = await newUserPage(browser, alice);
        const second = await newUserPage(browser, alice);
        try {
            const firstApp = new WebappPage(first.page, "authDev");
            const secondApp = new WebappPage(second.page, "authDev");
            await firstApp.navigate("/");
            await secondApp.navigate("/");

            // Same user identity on both…
            await expect(firstApp.root()).toContainText("alice");
            await expect(secondApp.root()).toContainText("alice");

            // …but each browser session keeps its OWN device identity (P87):
            // `user` is additional context, clientId is untouched by auth.
            const firstClientId = await first.page.evaluate(() => localStorage.getItem("webapp:clientId:authDev"));
            const secondClientId = await second.page.evaluate(() => localStorage.getItem("webapp:clientId:authDev"));
            expect(firstClientId).toBeTruthy();
            expect(secondClientId).toBeTruthy();
            expect(firstClientId).not.toBe(secondClientId);
        }
        finally {
            await first.context.close();
            await second.context.close();
        }
    });
});
