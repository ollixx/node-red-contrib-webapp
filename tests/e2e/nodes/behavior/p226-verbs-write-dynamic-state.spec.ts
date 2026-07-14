import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P226 (ADR 0037) — ui-action show/hide write the ONE dynamic-state `visible`
 * value, and ui-alert is now a valid target.
 *
 * Two proofs, both measured on the real DOM (element presence), never on tags:
 *   1. UNBOUND alert — hide sets the alert's per-client `visible` slot to false, so
 *      the next snapshot omits it (the element detaches). show writes it back to
 *      true and the alert re-renders. No `.webapp-hidden` overlay.
 *   2. STORE-BOUND alert — hide is written THROUGH to the bound store (the same
 *      truth a direct store write would set). A ui-text bound to the SAME store
 *      slice therefore flips "true" → "false" alongside the alert disappearing —
 *      the store value changed, proven on the DOM.
 */

test.describe("ui-action verbs write dynamic-state value (P226)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── 1. Unbound alert: show/hide flip the per-client visible value ────────

    test("hide → unbound alert disappears; show → it reappears", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p226App1", root: "p226App1" })
            .node("ui-alert", { id: "p226Alert1", message: "Unbound alert" })
            .node("ui-action", { id: "p226Hide1", actionType: "hide", target: "p226Alert1" })
            .node("ui-action", { id: "p226Show1", actionType: "show", target: "p226Alert1" })
            .withInjectNode("p226HideInj1", "p226Hide1")
            .build();
        // A second inject for `show`.
        flow.push({
            type: "inject", id: "p226ShowInj1", name: "p226ShowInj1",
            props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
            topic: "", payload: "", payloadType: "date",
            z: "e2e-flow", x: 100, y: 480, wires: [["p226Show1"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p226App1");
        await webapp.navigate("/");

        const alert = page.locator('[data-webapp-node="p226Alert1"]');
        await expect(alert).toBeVisible();

        // hide → the alert's visible value is false → omitted from the snapshot.
        await injectMessage(request, "p226HideInj1");
        await expect(alert).toBeHidden({ timeout: 5000 });

        // show → visible value true again → the alert re-renders.
        await injectMessage(request, "p226ShowInj1");
        await expect(alert).toBeVisible({ timeout: 5000 });
    });

    // ─── 2. Store-bound alert: hide writes THROUGH to the store ───────────────

    test("hide on a store-bound alert changes the STORE value (and hides it); show restores both", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p226App2", root: "p226App2" })
            // The store slice `vis` is the single truth for the alert's visibility.
            .node("ui-store", { id: "p226Store2", statePath: "vis", initialValue: "true" })
            .node("ui-alert", {
                id: "p226Alert2",
                message: "Bound alert",
                visible: { kind: "store", path: "p226Store2" }
            })
            // A ui-text bound to the SAME store slice — its text mirrors the store
            // value, so a store change is observable on the DOM ("true" / "false").
            .node("ui-text", { id: "p226Vis2", value: { kind: "state", path: "vis" } })
            .node("ui-action", { id: "p226Hide2", actionType: "hide", target: "p226Alert2" })
            .node("ui-action", { id: "p226Show2", actionType: "show", target: "p226Alert2" })
            .withInjectNode("p226HideInj2", "p226Hide2")
            .build();
        flow.push({
            type: "inject", id: "p226ShowInj2", name: "p226ShowInj2",
            props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
            topic: "", payload: "", payloadType: "date",
            z: "e2e-flow", x: 100, y: 480, wires: [["p226Show2"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p226App2");
        await webapp.navigate("/");

        const alert = page.locator('[data-webapp-node="p226Alert2"]');
        const visText = page.locator('[data-webapp-node="p226Vis2"]');
        await expect(alert).toBeVisible();
        await expect(visText).toHaveText("true");

        // hide → the write goes THROUGH the store: `vis` flips to false. The bound
        // text shows "false" AND the alert disappears (its truth is the store).
        await injectMessage(request, "p226HideInj2");
        await expect(visText).toHaveText("false", { timeout: 5000 });
        await expect(alert).toBeHidden({ timeout: 5000 });

        // show → the store slice returns to true; alert and text follow.
        await injectMessage(request, "p226ShowInj2");
        await expect(visText).toHaveText("true", { timeout: 5000 });
        await expect(alert).toBeVisible({ timeout: 5000 });
    });
});
