import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P118 (ADR 0011) — navigate target modes (wire | route | url) + addressing
 * precedence, driven end-to-end through a real browser + Node-RED.
 *
 * These exercise the ui-action node directly (the mode + typed params live on
 * its config), not raw inject messages — so the runtime addressing semantics are
 * proven through the actual node.
 */

const TAB = "e2e-flow";

// A raw inject node carrying a JSON payload, wired to `wiredTo`.
function injectPayload(id: string, wiredTo: string, payload: unknown) {
    return {
        type: "inject",
        id,
        name: id,
        props: [{ p: "payload" }],
        repeat: "",
        crontab: "",
        once: false,
        onceDelay: "0.1",
        topic: "",
        payload: JSON.stringify(payload),
        payloadType: "json",
        z: TAB,
        x: 100,
        y: 400,
        wires: [[wiredTo]]
    };
}

test.describe("P118 navigate target modes (ADR 0011)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("route mode: route reference + typed params (msg) navigates to the resolved location", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p118a", root: "p118a", name: "P118 A", layout: "vertical" })
            .node("ui-text", { id: "p118aHome", text: "Home content" })
            .route({ id: "p118aDetail", path: "/customers/:id" })
            .node("ui-text", { id: "p118aDetailText", text: "Detail content" })
            // ui-action in route mode: resolve p118aDetail's path, fill :id from msg.
            .node("ui-action", {
                id: "p118aGo",
                actionType: "navigate",
                targetMode: "route",
                route: "p118aDetail",
                params: JSON.stringify([{ name: "id", value: "payload.id", valueType: "msg" }]),
                wires: [["p118aDetail"]]
            })
            .build();
        flow.push(injectPayload("p118aInject", "p118aGo", { id: "42" }));

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p118a");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "p118aInject");
        await expect(page).toHaveURL(/\/customers\/42$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Detail content", { timeout: 10000 });
    });

    test("precedence: a route-mode action wired to a DIFFERENT route still lands on its addressed target", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p118b", root: "p118b", name: "P118 B", layout: "vertical" })
            .node("ui-text", { id: "p118bHome", text: "Home content" })
            .route({ id: "p118bDetail", path: "/customers/:id" })
            .node("ui-text", { id: "p118bDetailText", text: "Detail content" })
            .route({ id: "p118bOther", path: "/other" })
            .node("ui-text", { id: "p118bOtherText", text: "Other content" })
            // Addressed to p118bDetail (route mode) but WIRED to p118bOther — the
            // wired route must NOT hijack the addressed navigation.
            .node("ui-action", {
                id: "p118bGo",
                actionType: "navigate",
                targetMode: "route",
                route: "p118bDetail",
                params: JSON.stringify([{ name: "id", value: "payload.id", valueType: "msg" }]),
                wires: [["p118bOther"]]
            })
            .build();
        flow.push(injectPayload("p118bInject", "p118bGo", { id: "42" }));

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p118b");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "p118bInject");
        // Lands on the ADDRESSED /customers/42, not the wired /other.
        await expect(page).toHaveURL(/\/customers\/42$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Detail content", { timeout: 10000 });
    });

    test("wire mode with branching: the route that RECEIVES the message wins (both branches)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p118c", root: "p118c", name: "P118 C", layout: "vertical" })
            .node("ui-text", { id: "p118cHome", text: "Home content" })
            .route({ id: "p118cLeft", path: "/left" })
            .node("ui-text", { id: "p118cLeftText", text: "Left content" })
            .route({ id: "p118cRight", path: "/right" })
            .node("ui-text", { id: "p118cRightText", text: "Right content" })
            // A wire-mode navigate per branch: no explicit target; the route that
            // receives the message builds the location from its own path.
            .node("ui-action", { id: "p118cGoLeft", actionType: "navigate", targetMode: "wire", wires: [["p118cLeft"]] })
            .node("ui-action", { id: "p118cGoRight", actionType: "navigate", targetMode: "wire", wires: [["p118cRight"]] })
            .build();
        // A switch routing payload.dir to the matching ui-action branch.
        flow.push({
            type: "switch",
            id: "p118cSwitch",
            name: "p118cSwitch",
            property: "payload.dir",
            propertyType: "msg",
            rules: [
                { t: "eq", v: "left", vt: "str" },
                { t: "eq", v: "right", vt: "str" }
            ],
            checkall: "true",
            outputs: 2,
            z: TAB,
            x: 100,
            y: 300,
            wires: [["p118cGoLeft"], ["p118cGoRight"]]
        });
        flow.push(injectPayload("p118cInjectLeft", "p118cSwitch", { dir: "left" }));
        flow.push({ ...injectPayload("p118cInjectRight", "p118cSwitch", { dir: "right" }), y: 460 });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p118c");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "p118cInjectLeft");
        await expect(page).toHaveURL(/\/left$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Left content", { timeout: 10000 });

        await injectMessage(request, "p118cInjectRight");
        await expect(page).toHaveURL(/\/right$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Right content", { timeout: 10000 });
    });

    test("url mode: a msg-typed URL (whole path from the message) navigates the client", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p118d", root: "p118d", name: "P118 D", layout: "vertical" })
            .node("ui-text", { id: "p118dHome", text: "Home content" })
            .route({ id: "p118dDetail", path: "/customers/:id" })
            .node("ui-text", { id: "p118dDetailText", text: "Detail content" })
            // url mode: the WHOLE URL comes from the msg (typedInput `msg`). The
            // built URL carries its own values — no separate params list.
            .node("ui-action", {
                id: "p118dGo",
                actionType: "navigate",
                targetMode: "url",
                to: "dest",
                toType: "msg",
                // A configured params list must be ignored in url mode.
                params: JSON.stringify([{ name: "id", value: "ignored", valueType: "str" }]),
                wires: [["p118dDetail"]]
            })
            .build();
        flow.push(injectPayload("p118dInject", "p118dGo", { id: "42" }));
        // Override the inject to also set msg.dest = the whole target URL.
        const inject = flow.find((n) => n.id === "p118dInject") as { props: unknown[]; payload: string };
        inject.props = [{ p: "dest", v: "/customers/42", vt: "str" }];
        inject.payload = "";

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p118d");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");

        await injectMessage(request, "p118dInject");
        await expect(page).toHaveURL(/\/customers\/42$/, { timeout: 10000 });
        await expect(webapp.root()).toContainText("Detail content", { timeout: 10000 });
    });
});
