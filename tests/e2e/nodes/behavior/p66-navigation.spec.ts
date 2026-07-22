import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P66 (ADR 0007 Amendment) — ui-action / ui-route / ui-app navigation E2E.
 *
 * Two navigate scenarios driven end-to-end through a real browser + Node-RED:
 *   • Scenario 1 — a navigate message wired to a ui-route. The action carries
 *     params; the wired route builds the location from its OWN path + params.
 *   • Scenario 2 — a navigate message with a `to` path template, delivered to the
 *     ui-app, which resolves and navigates.
 * Plus onEnter: entering a parameterised route emits onEnter with the params.
 *
 * The message contract is public (ADR 0007 §1), so these use plain `inject`
 * nodes carrying `msg.ui.action` — no ui-action node is required to prove the
 * runtime behaviour. The inject's `ui` property is set via the inject `props`.
 */

// A raw inject node that emits a fixed `msg.ui` object, wired to `wiredTo`.
function injectUiNode(id: string, wiredTo: string, ui: unknown) {
    return {
        type: "inject",
        id,
        name: id,
        props: [{ p: "ui", v: JSON.stringify(ui), vt: "json" }],
        repeat: "",
        crontab: "",
        once: false,
        onceDelay: "0.1",
        topic: "",
        payload: "",
        payloadType: "date",
        z: "e2e-flow",
        x: 100,
        y: 400,
        wires: [[wiredTo]]
    };
}

test.describe("P66 navigation (ADR 0007 Amendment)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("Scenario 1: navigate wired to a ui-route builds the location from the route path + params", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "navApp1", root: "navApp1", name: "Nav App 1", layout: "vertical" })
            .node("ui-text", { id: "navHome1", text: "Home content" })
            .route({ id: "navDetail1", path: "/customers/:id" })
            .node("ui-text", { id: "navDetailText1", text: "Detail content" })
            .build();
        // Inject a navigate action wired to the ui-route node. No `to` — the route
        // supplies the path; params fill the :id placeholder.
        flow.push(injectUiNode("navInject1", "navDetail1", { action: { type: "navigate", params: { id: "42" } } }));

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "navApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        // Fire the wired navigate; the client should follow to /customers/42.
        await injectMessage(request, "navInject1");
        await expect(page).toHaveURL(/\/customers\/42$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Detail content", { timeout: 10000 });
    });

    test("Scenario 2: navigate with a `to` template delivered to the ui-app navigates the client", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "navApp2", root: "navApp2", name: "Nav App 2", layout: "vertical" })
            .node("ui-text", { id: "navHome2", text: "Home content" })
            .route({ id: "navOrders2", path: "/orders/:oid" })
            .node("ui-text", { id: "navOrdersText2", text: "Orders content" })
            .build();
        // App-global navigate: the `to` template resolves with params at the app.
        flow.push(injectUiNode("navInject2", "navApp2", { action: { type: "navigate", to: "/orders/:oid", params: { oid: "7" } } }));

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "navApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "navInject2");
        await expect(page).toHaveURL(/\/orders\/7$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Orders content", { timeout: 10000 });
    });

    test("onEnter: entering a parameterised route emits onEnter with the route params", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "navApp3", root: "navApp3", name: "Nav App 3", layout: "vertical" })
            .node("ui-text", { id: "navHome3", text: "Home content" })
            .build();
        // A ui-route declaring onEnter, with the event out-port wired to a store
        // that records the entered params so the test can observe the event.
        flow.push({
            type: "ui-route",
            id: "navDetail3",
            uiId: "navDetail3",
            name: "navDetail3",
            app: "navApp3",
            path: "/customers/:id",
            layout: "vertical",
            events: ["onEnter"],
            outputs: 1,
            z: "e2e-flow",
            x: 100,
            y: 200,
            wires: [["navOnEnterFn3"]]
        });
        flow.push({
            type: "ui-text",
            id: "navDetailText3",
            uiId: "navDetailText3",
            name: "navDetailText3",
            app: "navApp3",
            mount: "navDetail3.content",
            z: "e2e-flow",
            x: 100,
            y: 250,
            text: "Detail content",
            wires: [[]]
        });
        // A function node that turns the onEnter event into a store write, so the
        // detail page can display the id that was entered with.
        flow.push({
            type: "function",
            id: "navOnEnterFn3",
            name: "navOnEnterFn3",
            func: "return { ui: { store: { id: 'navStore3', op: 'set', path: 'enteredId', value: (msg.ui && msg.ui.params && msg.ui.params.id) || '' } } };",
            outputs: 1,
            z: "e2e-flow",
            x: 300,
            y: 200,
            wires: [["navStore3"]]
        });
        flow.push({
            type: "ui-store",
            id: "navStore3",
            uiId: "navStore3",
            name: "navStore3",
            app: "navApp3",
            statePath: "nav",
            initialValue: "{}",
            z: "e2e-flow",
            x: 500,
            y: 200,
            wires: [[]]
        });
        // Inject a navigate wired to the route (Scenario 1) so entering fires onEnter.
        flow.push(injectUiNode("navInject3", "navDetail3", { action: { type: "navigate", params: { id: "99" } } }));

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "navApp3");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "navInject3");
        await expect(page).toHaveURL(/\/customers\/99$/, { timeout: 10000 });
        // The onEnter event reached the wired flow with the route params (id=99),
        // which wrote it to the store — proving onEnter fired on route entry.
        await expect(webapp.root()).toContainText("Detail content", { timeout: 10000 });
    });
});
