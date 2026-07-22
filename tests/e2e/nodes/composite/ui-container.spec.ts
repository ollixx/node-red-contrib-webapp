import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 / P198 — per-node E2E specs for ui-container (composite/layout node).
 *
 * P45 covers:
 *   - Renders sl-card wrapper in the DOM (card variant).
 *   - Child ui-text node mounted inside → text visible inside card.
 *   - Multiple children render in order.
 *   - layout preset "grid": children placed in CSS grid.
 *
 * P198 covers:
 *   - All 4 variants render DISTINCTLY.
 *   - card   → <sl-card> element (Shoelace chrome).
 *   - panel  → <div> with webapp-container--panel class (border, no elevation).
 *   - section→ <div> with webapp-container--section class (spacing only).
 *   - transparent → <div> with webapp-container--transparent (NO border/padding/background).
 */

test.describe("ui-container (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-card wrapper", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnApp1", root: "ctnApp1" })
            .node("ui-container", { id: "ctnNode1", layoutId: "vertical" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toBeVisible();
    });

    test("child ui-text mounted inside container → text visible in card", async ({ page, request }) => {
        const containerId = "ctnNode2";
        const flow = new FlowBuilder()
            .app({ id: "ctnApp2", root: "ctnApp2" })
            .node("ui-container", { id: containerId, layoutId: "vertical" })
            .node("ui-text", {
                id: "ctnText2",
                text: "Hello from inside",
                // Mount inside the container using the container:<id>/<slot> format.
                mount: `container:${containerId}/content`
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toContainText("Hello from inside");
    });

    test("multiple children render inside the container", async ({ page, request }) => {
        const containerId = "ctnNode3";
        const flow = new FlowBuilder()
            .app({ id: "ctnApp3", root: "ctnApp3" })
            .node("ui-container", { id: containerId, layoutId: "vertical" })
            .node("ui-text", { id: "ctnText3a", text: "First", mount: `container:${containerId}/content` })
            .node("ui-text", { id: "ctnText3b", text: "Second", mount: `container:${containerId}/content` })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toContainText("First");
        await expect(page.locator("sl-card")).toContainText("Second");
    });

    test("layout preset 'grid' → container renders the grid layout wrapper", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnApp4", root: "ctnApp4" })
            .node("ui-container", { id: "ctnNode4", layoutId: "grid" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp4");
        await webapp.navigate("/");
        // Outcome: the "grid" preset drives a `.webapp-layout--grid` wrapper inside
        // the container's sl-card (a "vertical" container would emit
        // `.webapp-layout--vertical`). Goes red if the preset is not applied.
        await expect(page.locator("sl-card .webapp-layout--grid")).toHaveCount(1);
    });
});

test.describe("ui-container variants (P198)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("card variant renders as sl-card element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnVApp1", root: "ctnVApp1" })
            .node("ui-container", { id: "ctnV1", layoutId: "vertical", variant: "card" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnVApp1");
        await webapp.navigate("/");

        // card → <sl-card> with webapp-container--card class
        const el = page.locator("sl-card.webapp-container--card");
        await expect(el).toBeVisible();
        // Must NOT be a plain div
        await expect(page.locator("div.webapp-container--card")).not.toBeVisible();
    });

    test("panel variant renders as plain div (no sl-card)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnVApp2", root: "ctnVApp2" })
            .node("ui-container", { id: "ctnV2", layoutId: "vertical", variant: "panel" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnVApp2");
        await webapp.navigate("/");

        // panel → plain <div> with webapp-container--panel class
        const el = page.locator("div.webapp-container--panel");
        await expect(el).toBeVisible();
        // Must NOT be an sl-card
        await expect(page.locator("sl-card.webapp-container--panel")).not.toBeVisible();
        // Must have a border (panel CSS defines border: 1px solid)
        const borderStyle = await el.evaluate((node) =>
            getComputedStyle(node).borderTopWidth
        );
        expect(borderStyle).toBe("1px");
    });

    test("section variant renders as plain div with spacing only (no border)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnVApp3", root: "ctnVApp3" })
            .node("ui-container", { id: "ctnV3", layoutId: "vertical", variant: "section" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnVApp3");
        await webapp.navigate("/");

        // section → plain <div> with webapp-container--section class
        const el = page.locator("div.webapp-container--section");
        await expect(el).toBeVisible();
        // Must NOT be an sl-card
        await expect(page.locator("sl-card.webapp-container--section")).not.toBeVisible();
        // section has no border
        const borderStyle = await el.evaluate((node) =>
            getComputedStyle(node).borderTopWidth
        );
        expect(borderStyle).toBe("0px");
    });

    test("transparent variant renders as plain div with no box chrome", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnVApp4", root: "ctnVApp4" })
            .node("ui-container", { id: "ctnV4", layoutId: "vertical", variant: "transparent" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnVApp4");
        await webapp.navigate("/");

        // transparent → plain <div> with webapp-container--transparent class
        const el = page.locator("div.webapp-container--transparent");
        await expect(el).toBeVisible();
        // Must NOT be an sl-card
        await expect(page.locator("sl-card.webapp-container--transparent")).not.toBeVisible();
        // transparent: no border
        const borderWidth = await el.evaluate((node) =>
            getComputedStyle(node).borderTopWidth
        );
        expect(borderWidth).toBe("0px");
        // transparent: no padding
        const paddingTop = await el.evaluate((node) =>
            getComputedStyle(node).paddingTop
        );
        expect(paddingTop).toBe("0px");
        // transparent: no background (transparent = rgba(0,0,0,0) or "transparent")
        const bg = await el.evaluate((node) =>
            getComputedStyle(node).backgroundColor
        );
        // Both "transparent" and "rgba(0, 0, 0, 0)" mean no background
        expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(bg);
    });
});


/**
 * P199 — ui-container variant=span: inline text composition.
 *
 * span → <span> wrapper (not sl-card, not div); children flow inline.
 * Multiple ui-text children on ONE line (not stacked).
 */
test.describe("ui-container variant=span — inline wrapper (P199)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("span variant renders a <span> wrapper (not sl-card, not div)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnSpanApp1", root: "ctnSpanApp1" })
            .node("ui-container", { id: "ctnSpan1", layoutId: "vertical", variant: "span" })
            .node("ui-text", { id: "ctnSpanApp1Txt", text: "test", mount: "container:ctnSpan1/content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnSpanApp1");
        await webapp.navigate("/");

        // span → <span> with webapp-container--span class
        const el = page.locator("span.webapp-container--span");
        await expect(el).toBeAttached();
        await expect(el).toContainText("test");
        // Must NOT be an sl-card or a div
        await expect(page.locator("sl-card.webapp-container--span")).not.toBeAttached();
        await expect(page.locator("div.webapp-container--span")).not.toBeAttached();
    });

    test("span container with 3 ui-text children renders them inline (not stacked)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnSpanApp2", root: "ctnSpanApp2" })
            .node("ui-container", { id: "ctnSpan2", layoutId: "vertical", variant: "span" })
            .node("ui-text", { id: "ctnSpanTxt1", text: "Hello", mount: "container:ctnSpan2/content" })
            .node("ui-text", { id: "ctnSpanTxt2", text: " ", mount: "container:ctnSpan2/content" })
            .node("ui-text", { id: "ctnSpanTxt3", text: "World", mount: "container:ctnSpan2/content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnSpanApp2");
        await webapp.navigate("/");

        // All three texts visible inside the span wrapper
        const wrapper = page.locator("span.webapp-container--span");
        await expect(wrapper).toBeVisible();
        await expect(wrapper).toContainText("Hello");
        await expect(wrapper).toContainText("World");

        // ADR 0025: the per-item wrapper div is gone for display leaves — the three
        // ui-text render as bare <p>. Measure the texts themselves: all on one line
        // (top within 4px of each other), i.e. inline, not stacked.
        const items = page.locator(".webapp-text");
        await expect(items).toHaveCount(3);
        const boxes = await items.evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().top)
        );
        const minTop = Math.min(...boxes);
        const maxTop = Math.max(...boxes);
        expect(maxTop - minTop).toBeLessThan(4);
    });
});


/**
 * P255 — ui-container visibility-lifecycle events (onShow / onHide).
 *
 * A hidden container is gated OUT of the render tree server-side (the renderer
 * returns undefined for visible=false), so the client observes the container
 * appearing / disappearing across snapshot morphs and POSTs the matching /event.
 *
 * The measurement is the REAL client → server POST /event body (webapp.interceptNextEvent),
 * i.e. the event envelope the flow receives — event name + sourceId (the
 * container's node id). Both onShow (visible false→true) and onHide (true→false)
 * are driven by a ui-store-bound `visible` toggled live via inject → SSE re-render.
 */
test.describe("ui-container lifecycle events onShow/onHide (P255)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the container wrapper is stamped with data-webapp-lifecycle for the enabled events", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnLcMark", root: "ctnLcMark" })
            .node("ui-container", {
                id: "ctnLcMark1",
                layoutId: "vertical",
                variant: "card",
                events: ["onShow", "onHide"],
                outputs: 2
            })
            .node("ui-text", { id: "ctnLcMarkTxt", text: "content", mount: "container:ctnLcMark1/content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnLcMark");
        await webapp.navigate("/");

        // The lifecycle marker rides on the SAME wrapper as data-webapp-node, so the
        // client reads the source id and the enabled events from one element.
        const marker = page.locator('[data-webapp-node="ctnLcMark1"][data-webapp-lifecycle]');
        await expect(marker).toHaveCount(1);
        await expect(marker).toHaveAttribute("data-webapp-lifecycle", "onShow onHide");
    });

    test("visible false→true fires onShow with the container's sourceId (POST /event)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnOnShow", root: "ctnOnShow" })
            .node("ui-store", { id: "ctnShowStore", app: "ctnOnShow", statePath: "shown", initialValue: JSON.stringify(false) })
            .node("ui-container", {
                id: "ctnShow1",
                layoutId: "vertical",
                variant: "card",
                events: ["onShow"],
                outputs: 1,
                visible: { kind: "store", path: "ctnShowStore" }
            })
            .node("ui-text", { id: "ctnShowTxt", text: "lazy content", mount: "container:ctnShow1/content" })
            .withStoreInject("ctnShowInj", "ctnShowStore", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnOnShow");
        await webapp.navigate("/");

        // Initially hidden (store=false) → gated out, so no onShow on load.
        await expect(page.locator('[data-webapp-node="ctnShow1"]')).toHaveCount(0);

        // Arm the interceptor, then flip the bound store true → SSE re-render adds
        // the container → the client detects the appearance and POSTs onShow.
        const eventPromise = webapp.interceptNextEvent();
        await injectMessage(request, "ctnShowInj");

        await expect(page.locator('[data-webapp-node="ctnShow1"]')).toHaveCount(1, { timeout: 5000 });

        const body = await eventPromise;
        expect(body.event).toBe("onShow");
        expect(body.sourceId).toBe("ctnShow1");
    });

    test("visible true→false fires onHide with the container's sourceId (POST /event)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnOnHide", root: "ctnOnHide" })
            .node("ui-store", { id: "ctnHideStore", app: "ctnOnHide", statePath: "shown", initialValue: JSON.stringify(true) })
            .node("ui-container", {
                id: "ctnHide1",
                layoutId: "vertical",
                variant: "card",
                // onHide ONLY: the container is present on load but must NOT emit
                // onShow (that event is not enabled), so the next POST /event is the
                // onHide we drive below — no initial-render event to race with.
                events: ["onHide"],
                outputs: 1,
                visible: { kind: "store", path: "ctnHideStore" }
            })
            .node("ui-text", { id: "ctnHideTxt", text: "draft content", mount: "container:ctnHide1/content" })
            .withStoreInject("ctnHideInj", "ctnHideStore", false)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnOnHide");
        await webapp.navigate("/");

        // Initially shown (store=true).
        await expect(page.locator('[data-webapp-node="ctnHide1"]')).toHaveCount(1);

        // Arm the interceptor, then flip the bound store false → SSE re-render removes
        // the container → the client detects the disappearance and POSTs onHide.
        const eventPromise = webapp.interceptNextEvent();
        await injectMessage(request, "ctnHideInj");

        await expect(page.locator('[data-webapp-node="ctnHide1"]')).toHaveCount(0, { timeout: 5000 });

        const body = await eventPromise;
        expect(body.event).toBe("onHide");
        expect(body.sourceId).toBe("ctnHide1");
    });

    test("a container with NO events enabled emits no /event on a show toggle", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnNoEvt", root: "ctnNoEvt" })
            .node("ui-store", { id: "ctnNoEvtStore", app: "ctnNoEvt", statePath: "shown", initialValue: JSON.stringify(false) })
            .node("ui-container", {
                id: "ctnNoEvt1",
                layoutId: "vertical",
                variant: "card",
                visible: { kind: "store", path: "ctnNoEvtStore" }
            })
            .node("ui-text", { id: "ctnNoEvtTxt", text: "content", mount: "container:ctnNoEvt1/content" })
            .withStoreInject("ctnNoEvtInj", "ctnNoEvtStore", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnNoEvt");
        await webapp.navigate("/");

        // No lifecycle marker → the client must never POST for this container.
        await expect(page.locator('[data-webapp-lifecycle]')).toHaveCount(0);

        const eventCalls: string[] = [];
        page.on("request", (req) => {
            if (req.url().includes("/event") && req.method() === "POST") {
                eventCalls.push(req.postData() ?? "");
            }
        });

        await injectMessage(request, "ctnNoEvtInj");
        // The container becomes visible…
        await expect(page.locator('[data-webapp-node="ctnNoEvt1"]')).toHaveCount(1, { timeout: 5000 });
        // …but with no events enabled, no POST /event fires.
        await page.waitForTimeout(500);
        expect(eventCalls).toHaveLength(0);
    });
});
