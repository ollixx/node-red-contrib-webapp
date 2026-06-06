/**
 * P55 — Client-Logging E2E tests.
 *
 * Validates that webapp-client.js (ADR 0006):
 *   1. Logs an INFO lifecycle message when the SSE connection opens.
 *   2. Logs a DEBUG trace for outgoing /event POSTs (button click).
 *   3. Logs a DEBUG trace for incoming SSE snapshot frames.
 *   4. Logs WARN (not silently swallows) when a network failure occurs.
 *   5. Logs backend-forwarded errors received over the "webapp-error" SSE event.
 *
 * Technique: page.on("console", …) collects browser console messages.
 *   console.debug → type "debug"
 *   console.info  → type "info"
 *   console.warn  → type "warning"  (Playwright normalises this)
 *   console.error → type "error"
 *
 * All tests deploy an isolated flow via the admin API and reset afterwards.
 */

import { test, expect } from "@playwright/test";
import { deployFlow, resetFlow } from "../helpers/admin-api";
import { FlowBuilder } from "../helpers/flow-builder";
import { WebappPage } from "../helpers/webapp-page";

test.describe("P55 — client-side logging", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── lifecycle ──────────────────────────────────────────────────────────

    test("SSE connect logs an INFO lifecycle message", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "logApp1", root: "logApp1" })
            .build();
        await deployFlow(request, flow);

        const infoMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "info") {
                infoMessages.push(msg.text());
            }
        });

        const webapp = new WebappPage(page, "logApp1");
        await webapp.navigate("/");

        // webapp-client.js logs: "[webapp:logApp1] Connected to live stream"
        // on the SSE EventSource "open" event.
        await expect.poll(
            () => infoMessages.some((m) => m.includes("Connected") && m.includes("logApp1")),
            { timeout: 5000, message: "Expected INFO 'Connected' log from SSE lifecycle" }
        ).toBe(true);
    });

    // ─── outgoing DEBUG trace ────────────────────────────────────────────────

    test("button click → outgoing DEBUG trace for /event POST", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "logApp2", root: "logApp2" })
            .node("ui-button", { id: "logBtn2", label: "Click me" })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "logApp2");
        await webapp.navigate("/");

        const debugMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "debug") {
                debugMessages.push(msg.text());
            }
        });

        // Click the button, which dispatches a POST /event.
        await page.locator("sl-button").first().click();

        // Expect a DEBUG log with "POST /event" and the app id.
        await expect.poll(
            () => debugMessages.some((m) => m.includes("POST /event") && m.includes("logApp2")),
            { timeout: 5000, message: "Expected DEBUG outgoing trace for POST /event" }
        ).toBe(true);
    });

    // ─── incoming DEBUG trace ────────────────────────────────────────────────

    test("incoming SSE snapshot → DEBUG trace", async ({ page, request }) => {
        // A ui-store causes the server to push a snapshot immediately on SSE
        // connect (the standard initial-sync push). We capture the DEBUG log.
        const flow = new FlowBuilder()
            .app({ id: "logApp3", root: "logApp3" })
            .node("ui-store", { id: "logStore3", statePath: "x", initialValue: `"hello"` })
            .build();
        await deployFlow(request, flow);

        const debugMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "debug") {
                debugMessages.push(msg.text());
            }
        });

        const webapp = new WebappPage(page, "logApp3");
        await webapp.navigate("/");

        // Expect a DEBUG log mentioning "snapshot" for the incoming SSE frame.
        await expect.poll(
            () => debugMessages.some((m) => m.includes("snapshot") && m.includes("logApp3")),
            { timeout: 5000, message: "Expected DEBUG incoming trace for SSE snapshot" }
        ).toBe(true);
    });

    // ─── error instead of silent swallow ────────────────────────────────────

    test("failing /event POST logs a WARN (no silent swallow)", async ({ page, request }) => {
        // Use page.route to abort the /event fetch so it rejects with a network
        // error. The dispatch() .catch in webapp-client.js must log a warn.
        const flow = new FlowBuilder()
            .app({ id: "logApp4", root: "logApp4" })
            .node("ui-button", { id: "logBtn4", label: "Fail" })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "logApp4");
        await webapp.navigate("/");

        const warnMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "warning") {
                warnMessages.push(msg.text());
            }
        });

        // Abort the next /event POST so the fetch rejects with a network error.
        await page.route("**/webapp/logApp4/event", (route) => route.abort("failed"));
        await page.locator("sl-button").first().click();

        // The abort causes fetch to throw — the .catch in dispatch() must log a warn.
        await expect.poll(
            () => warnMessages.some((m) => m.includes("POST /event") && m.includes("logApp4")),
            { timeout: 5000, message: "Expected WARN log when POST /event fails (no silent swallow)" }
        ).toBe(true);

        await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    // ─── backend-forwarded error ─────────────────────────────────────────────

    test("backend-forwarded webapp-error SSE event is logged at the carried severity", async ({ page, request }) => {
        // P56 will push the actual backend errors over SSE. For P55, we verify
        // the client handles and logs a "webapp-error" payload at the carried
        // severity. We use the __webappClientTestHooks.handleServerError hook
        // (exposed in P55) to fire a synthetic payload without SSE interception.
        const flow = new FlowBuilder()
            .app({ id: "logApp5", root: "logApp5" })
            .build();
        await deployFlow(request, flow);

        // Install the test-hook before the page loads.
        await page.addInitScript(() => {
            (window as unknown as { __webappClientTestHooks?: Record<string, unknown> }).__webappClientTestHooks = {};
        });

        const warnMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "warning") {
                warnMessages.push(msg.text());
            }
        });

        const webapp = new WebappPage(page, "logApp5");
        await webapp.navigate("/");

        // Fire a synthetic "webapp-error" payload via the test hook.
        await page.evaluate(() => {
            const hooks = (window as unknown as {
                __webappClientTestHooks?: { handleServerError?: (e: unknown) => void }
            }).__webappClientTestHooks;
            if (hooks && hooks.handleServerError) {
                hooks.handleServerError({
                    severity: "warn",
                    code: "TEST_ERR",
                    message: "Synthetic backend warning for P55 test",
                    context: { appId: "logApp5", op: "test" }
                });
            }
        });

        await expect.poll(
            () => warnMessages.some((m) => m.includes("[server]") && m.includes("Synthetic backend warning")),
            { timeout: 5000, message: "Expected WARN log from backend-forwarded webapp-error via test hook" }
        ).toBe(true);
    });
});
