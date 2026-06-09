import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P106 — live model delivery on deploy (live-deploy-update.md).
 *
 * When a flow is deployed, the server pushes the freshly-compiled model to every
 * connected client over the SSE channel, tagged with a shell/topology signature
 * and the app's deploy mode. The client:
 *   development, content-only change → in-place applySnapshot (NO reload; client
 *                                      state — an unbound input value — survives).
 *   development, topology/shell change → full reload.
 *   production                        → version alert; no auto-update.
 *
 * Each test deploys a modified flow via POST /flows (the same path the editor's
 * Deploy button uses), which fires `flows:started` server-side.
 */

type FlowNode = Record<string, unknown>;

async function loadFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    return JSON.parse(await readFile(fixturePath, "utf8")) as FlowNode[];
}

function withLabel(flow: FlowNode[], value: string): FlowNode[] {
    return flow.map((n) =>
        n.id === "p106Label" ? { ...n, value: { kind: "literal", value } } : n
    );
}

const APP_PATH = "/webapp/p106App/";

test.describe("live model delivery on deploy (P106)", () => {
    // Re-deploy the pristine base fixture before EACH test so a prior test's
    // content/topology/mode change does not leak into the next one.
    test.beforeEach(async ({ request }) => {
        const flow = await loadFixture("tests/e2e/fixtures/p106-deploy.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    // Restore the customers-crud baseline so later specs see customersApp.
    test.afterAll(async ({ request }) => {
        const baseline = await loadFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a content-only deploy updates the client IN PLACE (no reload, client state survives)", async ({ page, request }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p106App/stream"));
        await page.goto(APP_PATH);
        const root = page.locator("#webapp-client-root");
        await expect(root).toContainText("before-deploy");
        await streamRequested;
        // The deploy push only targets clients connected > 500 ms before the
        // deploy — wait past that window so this client qualifies.
        await page.waitForTimeout(1200);

        // Plant client-only state that a full reload would destroy but an
        // in-place applySnapshot keeps: (a) a window flag, (b) a marker node
        // injected into <body>, OUTSIDE the re-rendered #webapp-client-root — the
        // snapshot never touches it, so it proves no reload happened.
        await page.evaluate(() => {
            (window as unknown as { __noReload?: boolean }).__noReload = true;
            const marker = document.createElement("div");
            marker.id = "client-only-marker";
            document.body.appendChild(marker);
        });

        // Deploy a content-only change (label text). Signature is unchanged → the
        // client applies the new snapshot in place.
        const baseFlow = await loadFixture("tests/e2e/fixtures/p106-deploy.flow.json");
        const changed = withLabel(baseFlow, "after-deploy");
        const deployResp = await request.post("/flows", { data: changed });
        expect(deployResp.ok()).toBeTruthy();

        // The new label appears WITHOUT a reload.
        await expect(root).toContainText("after-deploy", { timeout: 10000 });

        // Both pieces of client-only state survived → the update was in-place.
        const survived = await page.evaluate(() => ({
            noReload: (window as unknown as { __noReload?: boolean }).__noReload === true,
            marker: document.getElementById("client-only-marker") !== null
        }));
        expect(survived.noReload).toBe(true);
        expect(survived.marker).toBe(true);
    });

    test("a topology change (added route) triggers a full RELOAD", async ({ page, request }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p106App/stream"));
        await page.goto(APP_PATH);
        const root = page.locator("#webapp-client-root");
        await expect(root).toContainText("before-deploy");
        await streamRequested;
        await page.waitForTimeout(1200);

        await page.evaluate(() => {
            (window as unknown as { __noReload?: boolean }).__noReload = true;
        });

        // Deploy with an ADDED route → the route-path set (signature) changes →
        // the client cannot apply in place and does a full reload.
        const baseFlow = await loadFixture("tests/e2e/fixtures/p106-deploy.flow.json");
        const withRoute: FlowNode[] = [
            ...baseFlow,
            {
                type: "ui-route",
                id: "p106Orders",
                name: "Orders",
                parent: "p106App",
                path: "/orders",
                layoutId: "vertical",
                z: "p106flow",
                wires: [],
                x: 200,
                y: 360
            }
        ];
        const deployResp = await request.post("/flows", { data: withRoute });
        expect(deployResp.ok()).toBeTruthy();

        // A reload discards the __noReload marker. Poll until it is gone.
        await expect
            .poll(
                () => page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true),
                { timeout: 10000 }
            )
            .toBe(false);
        await expect(root).toContainText("before-deploy");
    });

    test("a hidden tab pulls the new model on RE-FOCUS (visibilitychange), robust against a missed push", async ({ page, request }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p106App/stream"));
        await page.goto(APP_PATH);
        const root = page.locator("#webapp-client-root");
        await expect(root).toContainText("before-deploy");
        await streamRequested;
        await page.waitForTimeout(1200);

        // Simulate a frozen/backgrounded tab: force visibilityState=hidden AND
        // neutralise the live SSE deploy handler so the push is "missed", exactly
        // like a Chrome-frozen tab. Recovery must come solely from the
        // visibilitychange re-focus pull.
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
            Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        });

        // Deploy a content change while the tab is "hidden".
        const baseFlow = await loadFixture("tests/e2e/fixtures/p106-deploy.flow.json");
        const changed = withLabel(baseFlow, "refocus-content");
        const deployResp = await request.post("/flows", { data: changed });
        expect(deployResp.ok()).toBeTruthy();
        await page.waitForTimeout(800);

        // Flip back to visible and fire visibilitychange → the client pulls
        // /snapshot and adopts the new model without a manual reload.
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
            Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
            document.dispatchEvent(new Event("visibilitychange"));
        });

        await expect(root).toContainText("refocus-content", { timeout: 10000 });
    });

    test("a production-mode app shows a version alert and does NOT auto-update", async ({ page, request }) => {
        // Switch the app to production first, then load the client so it hydrates
        // with mode=production.
        const baseFlow = await loadFixture("tests/e2e/fixtures/p106-deploy.flow.json");
        const prodFlow = baseFlow.map((n) => (n.id === "p106App" ? { ...n, deployMode: "production" } : n));
        const prep = await request.post("/flows", { data: prodFlow });
        expect(prep.ok()).toBeTruthy();

        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p106App/stream"));
        await page.goto(APP_PATH);
        const root = page.locator("#webapp-client-root");
        await expect(root).toContainText("before-deploy");
        await streamRequested;
        await page.waitForTimeout(1200);

        await page.evaluate(() => {
            (window as unknown as { __noReload?: boolean }).__noReload = true;
        });

        // Deploy a content change while in production. The client must NOT update
        // the label in place and must NOT reload — it shows a version alert.
        const changed = withLabel(prodFlow, "prod-after-deploy");
        const deployResp = await request.post("/flows", { data: changed });
        expect(deployResp.ok()).toBeTruthy();

        // The version alert appears.
        await expect(page.locator(".webapp-version-alert")).toBeVisible({ timeout: 10000 });
        await expect(page.locator(".webapp-version-alert")).toContainText("neue Version");

        // The label did NOT change in place and the page did NOT reload.
        await expect(root).toContainText("before-deploy");
        await expect(root).not.toContainText("prod-after-deploy");
        const survived = await page.evaluate(
            () => (window as unknown as { __noReload?: boolean }).__noReload === true
        );
        expect(survived).toBe(true);
    });
});
