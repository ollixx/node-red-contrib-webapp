/**
 * P56 — backend→frontend error forwarding E2E (ADR 0006 §4).
 *
 * A real backend framework error (a ui-store update with an unknown op, which
 * makes applyStoreOperation throw) is reported via reportRuntimeError. When the
 * owning ui-app has forwardErrorsToClient ENABLED, the structured error is pushed
 * to the connected browser over the SSE "error" event and logged there by the P55
 * client logger (console.error, "[server]" prefix). When forwarding is DISABLED
 * (the secure default), the same error never reaches the browser.
 *
 * The bad store op is delivered via an inject → function pipeline:
 *   inject (fire) → function (sets msg.ui.store = { id, op:"explode" }) → ui-store
 */

import { test, expect } from "@playwright/test";
import type { NodeDef } from "../helpers/admin-api";
import { deployFlow, resetFlow, injectMessage } from "../helpers/admin-api";
import { FlowBuilder } from "../helpers/flow-builder";
import { WebappPage } from "../helpers/webapp-page";

const TAB_ID = "e2e-flow";

// Build a flow: ui-app (+ forwarding config) + ui-store + inject→function that
// fires an unknown store op, which the runtime rejects with a structured error.
function buildFlow(appId: string, forward: boolean): NodeDef[] {
    const storeId = `${appId}Store`;
    const injectId = `${appId}Inject`;
    const funcId = `${appId}Fn`;

    const flow = new FlowBuilder()
        .app({
            id: appId,
            root: appId,
            forwardErrorsToClient: forward,
            forwardErrorMinSeverity: "error"
        })
        .node("ui-store", { id: storeId, statePath: "x", initialValue: `"init"` })
        .build();

    // Append the inject → function → store pipeline (FlowBuilder.withStoreInject
    // hardcodes op:"replace"; we need an UNKNOWN op to trigger the error path).
    flow.push({
        type: "inject",
        id: injectId,
        name: injectId,
        props: [{ p: "payload" }],
        repeat: "",
        crontab: "",
        once: false,
        onceDelay: "0.1",
        topic: "",
        payload: "",
        payloadType: "date",
        z: TAB_ID,
        x: 100,
        y: 420,
        wires: [[funcId]]
    } as unknown as NodeDef);
    flow.push({
        type: "function",
        id: funcId,
        name: funcId,
        func: `msg.ui = { store: { id: "${storeId}", op: "explode" } }; return msg;`,
        outputs: 1,
        z: TAB_ID,
        x: 300,
        y: 420,
        wires: [[storeId]]
    } as unknown as NodeDef);

    return flow;
}

test.describe("P56 — backend→frontend error forwarding", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("forwarding ENABLED: a backend error reaches the browser console", async ({ page, request }) => {
        const appId = "errFwdOn";
        await deployFlow(request, buildFlow(appId, true));

        const errorMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                errorMessages.push(msg.text());
            }
        });

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");

        // Fire the inject → function → ui-store(explode) pipeline. The runtime
        // rejects the unknown op with server.store.operation-failed and — because
        // forwarding is ON — pushes it over the SSE "error" channel.
        await injectMessage(request, `${appId}Inject`);

        // The P55 client logs forwarded server errors at console.error with a
        // "[server]" prefix and the structured message.
        await expect.poll(
            () => errorMessages.some((m) => m.includes("[server]") && m.includes("ui-store operation failed")),
            { timeout: 8000, message: "Expected a forwarded backend error in the browser console" }
        ).toBe(true);
    });

    test("forwarding DISABLED (default): the backend error never reaches the browser", async ({ page, request }) => {
        const appId = "errFwdOff";
        await deployFlow(request, buildFlow(appId, false));

        const serverErrorMessages: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error" && msg.text().includes("[server]")) {
                serverErrorMessages.push(msg.text());
            }
        });

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");

        // Fire the same bad store op. The runtime still logs it server-side, but
        // with forwarding OFF it must NOT be pushed to the browser.
        await injectMessage(request, `${appId}Inject`);

        // Give any (erroneous) forwarding a generous window to arrive, then assert
        // nothing server-originated was logged.
        await page.waitForTimeout(2000);
        expect(serverErrorMessages).toEqual([]);
    });
});
