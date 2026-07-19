import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { injectMessage } from "../../../helpers/admin-api";

/**
 * P209 (ADR 0028) — ui-store-read: on-demand, NON-mutating store reader.
 *
 * Flow: a CLIENT-ONLY ui-store `entity` (initial {name:'A', city:'X'}); a
 * ui-store-read referencing it; three list triggers all carrying the browser
 * clientId:
 *   - SETB     → patch entity.name='B' per-client
 *   - READALL  → read whole slice (no path)          → stringified into a result store
 *   - READNAME → read with msg.path='name' (override) → stringified into a result store
 * A ui-text binds store(result).text and displays the emitted read payload.
 *
 * MEASURED on the EMITTED read message (surfaced via the result store), not on
 * node registration:
 *   - after SETB, READALL emits payload = {name:'B', city:'X'} (current per-client state)
 *   - READNAME emits payload = 'B' (path override)
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-store-read on-demand reader (P209)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p209-store-read.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("read emits the current per-client slice, and msg.path overrides it", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p209App/stream"));
        await page.goto("/webapp/p209App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const readout = page.locator(".webapp-text").first();

        // Edit per-client state: name A → B (city untouched).
        await page.locator("li.webapp-list-item").filter({ hasText: "SETB" }).click();
        await page.waitForTimeout(300);

        // READALL: the reader emits the WHOLE current per-client slice.
        await page.locator("li.webapp-list-item").filter({ hasText: "READALL" }).click();
        await expect(readout).toHaveText('{"name":"B","city":"X"}', { timeout: 10000 });

        // READNAME: msg.path='name' override → the reader emits just 'B'.
        await page.locator("li.webapp-list-item").filter({ hasText: "READNAME" }).click();
        await expect(readout).toHaveText("B", { timeout: 10000 });
    });
});

/**
 * P242 (ADR 0028) — scope-violation lifted to the integration level.
 *
 * The scope guard in storeReadInputHandler (nodes/webapp.js ~5625) rejects a
 * CLIENT-ONLY store read that carries NO clientId with the structured code
 * `server.store.scope-violation` (webapp.js ~5629) and, crucially, does NOT
 * send — the read is short-circuited before any output.
 *
 * Flow (tests/e2e/fixtures/p242-store-read-scope.flow.json): a client-only store
 * `entity`, a ui-store-read referencing it wired to a result store + readout, a
 * ui-log panel, and an inject → function that fires a read after stripping any
 * clientId. The ui-app opts into error forwarding (forwardErrorsToClient +
 * forwardErrorMinSeverity="error"), so the structured error is pushed over the
 * SSE "error" channel and the client renders its code into the ui-log panel as
 * `.webapp-log-code`.
 *
 * MEASURED (not DOM-presence of the read):
 *   - the EMITTED error code, read off the forwarded structured error rendered in
 *     the log panel: `.webapp-log-code` === "server.store.scope-violation".
 *   - NO read output: the result readout is never written (stays at "NONE"), i.e.
 *     the handler short-circuited before send().
 */
test.describe("ui-store-read scope-violation is observable end-to-end (P242)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p242-store-read-scope.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("client-only read WITHOUT clientId emits server.store.scope-violation and no read output", async ({ page, request }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p242App/stream"));
        await page.goto("/webapp/p242App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const readout = page.locator(".webapp-text").first();
        // Baseline: the result store shows its sentinel — no read has happened yet.
        await expect(readout).toHaveText("NONE", { timeout: 10000 });

        // Fire a read whose message carries NO clientId against the client-only
        // store. The scope guard rejects it with server.store.scope-violation.
        await injectMessage(request, "p242Inject");

        // MEASURED: the forwarded structured error's CODE, rendered by the client
        // into the ui-log panel as the .webapp-log-code span.
        const logCode = page.locator("[data-webapp-log] .webapp-log-entry .webapp-log-code").first();
        await expect(logCode).toHaveText("server.store.scope-violation", { timeout: 10000 });

        // MEASURED: NO read output — the handler short-circuited before send(), so
        // the result readout is still the sentinel (never overwritten by a payload).
        await expect(readout).toHaveText("NONE");
    });
});
